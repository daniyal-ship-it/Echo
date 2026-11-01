-- ECHO catalog/data-presence preflight. No DDL, DML, temp objects or migrations.
-- Run the entire file as the application's database role against the verified
-- Supabase project/database. Keep the JSON result; never include a connection URL.
-- Different dashboard/admin roles do not prove the application's permissions.
-- If any query fails, issue ROLLBACK; do not weaken read-only mode to retry.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

WITH
expected(name) AS (VALUES
 ('schema_migrations'), ('users'), ('workspaces'), ('sessions'),
 ('auth_attempts'), ('data_sources'), ('memory_nodes'), ('memory_versions'),
 ('memory_edges'), ('embeddings'), ('import_jobs'), ('agent_runs'),
 ('retrieval_citations'), ('audit_events'), ('memory_chunks'),
 ('embedding_cache'), ('chunk_embeddings'), ('intelligence_jobs'),
 ('intelligence_operations'), ('analysis_parts'), ('memory_analyses'),
 ('query_embeddings')
),
application_namespaces AS (
 SELECT oid, nspname, nspowner, nspacl
 FROM pg_catalog.pg_namespace
 WHERE nspname <> 'information_schema' AND nspname !~ '^pg_'
),
relations AS (
 SELECT c.oid, n.nspname AS schema_name, c.relname AS name, c.relkind,
   pg_catalog.pg_get_userbyid(c.relowner) AS owner,
   c.relrowsecurity, c.relforcerowsecurity, c.reltuples AS estimated_rows,
   c.relacl,
   EXISTS (SELECT 1 FROM expected e WHERE e.name=c.relname) AS echo_table_name,
   n.nspname=current_schema() AS in_migration_target
 FROM pg_catalog.pg_class c JOIN application_namespaces n ON n.oid=c.relnamespace
),
row_presence AS (
 SELECT schema_name, name, relkind, in_migration_target,
   pg_catalog.has_table_privilege(oid,'SELECT') AS can_select,
   pg_catalog.row_security_active(oid) AS rls_applies_to_inspector,
   CASE WHEN pg_catalog.has_table_privilege(oid,'SELECT') THEN
     ((pg_catalog.xpath('//has_rows/text()', pg_catalog.query_to_xml(
       format('SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1) AS has_rows',
              schema_name,name),false,false,'')))[1])::text::boolean
   ELSE NULL END AS has_visible_rows
 FROM relations
 WHERE echo_table_name AND relkind IN ('r','p')
   AND schema_name IN ('public',current_schema())
),
history AS (
 SELECT r.schema_name, r.relkind, r.in_migration_target,
   pg_catalog.has_table_privilege(r.oid,'SELECT') AS can_select,
   CASE WHEN r.relkind IN ('r','p')
     AND pg_catalog.has_table_privilege(r.oid,'SELECT')
     AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
       WHERE a.attrelid=r.oid AND a.attname='version' AND a.attnum>0 AND NOT a.attisdropped)
   THEN pg_catalog.query_to_xml(format(
     'SELECT count(*) AS total_records,
       count(*) FILTER (WHERE version::text=%L) AS foundation_records,
       count(*) FILTER (WHERE version::text=%L) AS intelligence_records
      FROM %I.%I', '001_foundation','002_memory_intelligence',r.schema_name,r.name),
     false,false,'')::text
   ELSE NULL END AS counts_xml
 FROM relations r WHERE r.name='schema_migrations'
),
columns AS (
 SELECT r.schema_name,r.name AS table_name,a.attname AS column_name,
   pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
   a.attnotnull AS not_null,a.attgenerated AS generated
 FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid
 WHERE r.echo_table_name AND a.attnum>0 AND NOT a.attisdropped
),
constraints AS (
 SELECT n.nspname AS schema_name,c.conname AS name,c.contype AS type,
   c.conrelid::regclass::text AS relation,c.convalidated AS validated
 FROM pg_catalog.pg_constraint c JOIN application_namespaces n ON n.oid=c.connamespace
),
types AS (
 SELECT n.nspname AS schema_name,t.typname AS name,t.typtype AS kind
 FROM pg_catalog.pg_type t JOIN application_namespaces n ON n.oid=t.typnamespace
),
functions AS (
 SELECT n.nspname AS schema_name,p.proname AS name,
   pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
   pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer
 FROM pg_catalog.pg_proc p JOIN application_namespaces n ON n.oid=p.pronamespace
 WHERE p.proname='invalidate_memory_intelligence'
),
triggers AS (
 SELECT r.schema_name,r.name AS table_name,t.tgname AS name,t.tgenabled AS enabled
 FROM pg_catalog.pg_trigger t JOIN relations r ON r.oid=t.tgrelid
 WHERE NOT t.tgisinternal
),
default_acls AS (
 SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner,
   CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname END AS schema_name,
   d.defaclobjtype AS object_kind,d.defaclacl::text AS acl
 FROM pg_catalog.pg_default_acl d
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
),
policies AS (
 SELECT schemaname,tablename,policyname,permissive,roles,cmd
 FROM pg_catalog.pg_policies
 WHERE schemaname IN ('public',current_schema())
)
SELECT jsonb_build_object(
 'identity',jsonb_build_object(
   'database',current_database(),'role',current_user,'session_role',session_user,
   'server_version',current_setting('server_version'),
   'server_version_num',current_setting('server_version_num'),
   'search_path',current_setting('search_path'),'resolved_search_path',current_schemas(false),
   'migration_target_schema',current_schema(),
   'transaction_read_only',current_setting('transaction_read_only'),
   'transaction_isolation',current_setting('transaction_isolation'),
   'project_ref_if_published',current_setting('supabase.project_ref',true),
   'connection_ssl',(SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid())
 ),
 'permissions',jsonb_build_object(
   'database_create',pg_catalog.has_database_privilege(current_database(),'CREATE'),
   'schema_usage',pg_catalog.has_schema_privilege(current_schema(),'USAGE'),
   'schema_create',pg_catalog.has_schema_privilege(current_schema(),'CREATE'),
   'role_flags',(SELECT jsonb_build_object('superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit)
                 FROM pg_catalog.pg_roles WHERE rolname=current_user),
   'supautils_privileged_extensions',current_setting('supautils.privileged_extensions',true),
   'supautils_privileged_role',current_setting('supautils.privileged_role',true),
   'english_fts_available',EXISTS (SELECT 1 FROM pg_catalog.pg_ts_config c
     JOIN pg_catalog.pg_namespace n ON n.oid=c.cfgnamespace
     WHERE n.nspname='pg_catalog' AND c.cfgname='english')
 ),
 'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'name',nspname,'owner',pg_catalog.pg_get_userbyid(nspowner),'acl',nspacl::text,
   'usage',pg_catalog.has_schema_privilege(oid,'USAGE'),
   'create',pg_catalog.has_schema_privilege(oid,'CREATE')) ORDER BY nspname),'[]'::jsonb)
   FROM application_namespaces),
 'relations',(SELECT coalesce(jsonb_agg(to_jsonb(r)-'oid' ORDER BY schema_name,name),'[]'::jsonb) FROM relations r),
 'echo_row_presence',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY schema_name,name),'[]'::jsonb) FROM row_presence r),
 'migration_history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY schema_name),'[]'::jsonb) FROM history h),
 'echo_columns',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY schema_name,table_name,column_name),'[]'::jsonb) FROM columns c),
 'constraints',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY schema_name,name),'[]'::jsonb) FROM constraints c),
 'types',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY schema_name,name),'[]'::jsonb) FROM types t),
 'matching_functions',(SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) FROM functions f),
 'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name,name),'[]'::jsonb) FROM triggers t),
 'installed_extensions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'name',e.extname,'version',e.extversion,'schema',n.nspname,
   'owner',pg_catalog.pg_get_userbyid(e.extowner)) ORDER BY e.extname),'[]'::jsonb)
   FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace),
 'available_vector_versions',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb)
   FROM pg_catalog.pg_available_extension_versions v WHERE name='vector'),
 'default_privileges',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM default_acls d),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM policies p),
 'data_api_schemas_if_published',current_setting('pgrst.db_schemas',true),
 'limitations','Project reference and Data API exposure may require dashboard confirmation. No row values are returned. Row-presence false cannot prove emptiness when RLS applies. Estimated row counts are not exact. Views/foreign tables are inventoried but not executed.'
) AS echo_database_preflight;

ROLLBACK;

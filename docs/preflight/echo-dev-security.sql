-- ECHO-DEV ONLY: dtcxlxehqiuhmhuypqbm, org rttaltwkawyehzqregon.
-- Open that project's SQL Editor and verify project ref BEFORE running.
-- The reference label below cannot prove the connection target by itself.
-- Metadata only, READ ONLY transactions. No extension trial or migration.
-- Dashboard settings must be inspected separately; do not click Save/change them.
-- Remaining checks after the owner's empty-public-schema inspection.
-- Metadata only. Run through the existing connected Supabase account, as the
-- proposed migration role. Do not provide connection strings or credentials.
-- Dashboard-only checks: Enable Data API, exposed schemas, Automatically expose
-- new tables. An absent SQL setting does not establish the dashboard state.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

WITH roles AS (
 SELECT oid,rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin
 FROM pg_catalog.pg_roles
 WHERE rolname IN ('postgres','anon','authenticated','service_role','authenticator')
), defaults AS (
 SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS creator,
   CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname END AS schema_name,
   d.defaclobjtype AS kind,d.defaclacl::text AS privileges
 FROM pg_catalog.pg_default_acl d
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclnamespace=0 OR n.nspname IN ('public','extensions')
), membership AS (
 SELECT parent.rolname AS parent_role,member.rolname AS member_role,m.admin_option,m.inherit_option,m.set_option
 FROM pg_catalog.pg_auth_members m
 JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid
 JOIN pg_catalog.pg_roles member ON member.oid=m.member
 -- Include all edges so indirect memberships can also be reviewed.
), permissions AS (
 SELECT rolname,
   pg_catalog.has_schema_privilege(rolname,'public','USAGE') AS public_usage,
   pg_catalog.has_schema_privilege(rolname,'public','CREATE') AS public_create,
   pg_catalog.has_database_privilege(rolname,current_database(),'CREATE') AS database_create,
   pg_catalog.pg_has_role(rolname,'postgres','MEMBER') AS member_of_postgres,
   pg_catalog.pg_has_role(rolname,'postgres','USAGE') AS inherits_postgres
 FROM roles
)
SELECT jsonb_build_object(
 'expected_project_ref','dtcxlxehqiuhmhuypqbm',
 'identity',jsonb_build_object(
   'database',current_database(),'role',current_user,'session_role',session_user,
   'postgres_version',current_setting('server_version'),
   'postgres_13_or_newer',current_setting('server_version_num')::integer>=130000,
   'search_path',current_setting('search_path'),
   'resolved_search_path',current_schemas(false),'creation_schema',current_schema(),
   'read_only',current_setting('transaction_read_only'),
   'note','Expected project reference is a label, not independently verified by this SQL. Compare the dashboard project. SQL Editor role/search_path does not prove Vercel runtime identity.'
 ),
 'roles',(SELECT jsonb_agg(to_jsonb(r)-'oid') FROM roles r),
 'role_memberships',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) FROM membership m),
 'role_permissions',(SELECT jsonb_agg(to_jsonb(p)) FROM permissions p),
 'default_privileges',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM defaults d),
 'postgres_builtin_function_acl_fallback',
   (SELECT pg_catalog.acldefault('f',oid)::text FROM roles WHERE rolname='postgres'),
 'available_vector_versions',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb)
   FROM pg_catalog.pg_available_extension_versions v WHERE name='vector'),
 'installed_vector',(SELECT jsonb_build_object('version',e.extversion,'schema',n.nspname)
   FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
   WHERE e.extname='vector'),
 'supautils_privileged_extensions',current_setting('supautils.privileged_extensions',true),
 'supautils_privileged_role',current_setting('supautils.privileged_role',true),
 'plpgsql_installed',EXISTS(SELECT 1 FROM pg_catalog.pg_language WHERE lanname='plpgsql'),
 'english_fts_available',EXISTS(SELECT 1 FROM pg_catalog.pg_ts_config c
   JOIN pg_catalog.pg_namespace n ON n.oid=c.cfgnamespace
   WHERE n.nspname='pg_catalog' AND c.cfgname='english'),
 'data_api_schemas_if_published',current_setting('pgrst.db_schemas',true),
 'limitations','No trial extension install or application migration ran. Default ACLs and memberships require interpretation; no current objects exist to test future grants. Confirm Data API settings separately in the dashboard.'
) AS echo_remaining_security_prerequisites;

ROLLBACK;

-- Run through the already connected Supabase account as the intended migration
-- role. Metadata only; this does NOT establish the deployed backend's identity.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database, current_user AS execution_role,
       session_user AS session_role, current_setting('search_path') AS search_path,
       current_schemas(false) AS resolved_path,
       (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
       current_setting('shared_preload_libraries',true) AS shared_libraries,
       current_setting('session_preload_libraries',true) AS session_libraries,
       current_setting('supautils.privileged_extensions',true) AS privileged_extensions,
       current_setting('supautils.privileged_role',true) AS privileged_role,
       current_setting('supautils.default_extension_install_schema',true) AS default_extension_schema,
       CASE WHEN nullif(current_setting('supautils.extensions_parameter_overrides',true),'') IS NOT NULL
         THEN current_setting('supautils.extensions_parameter_overrides')::jsonb -> 'vector'
         ELSE NULL END AS vector_schema_override;
SELECT name,version,superuser,trusted,relocatable,schema,requires
FROM pg_available_extension_versions WHERE name='vector' AND version='0.8.2';
ROLLBACK;

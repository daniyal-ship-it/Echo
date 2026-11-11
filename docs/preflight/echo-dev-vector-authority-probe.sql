-- PROPOSED ONLY. Requires explicit approval: this performs transactional DDL.
-- Select echo-dev / dtcxlxehqiuhmhuypqbm in the connected SQL Editor FIRST.
-- Database name postgres cannot prove project identity. Never use old bindings.
-- Run the COMPLETE submission on one session, without selections/autocommit splits.
-- On any error: issue ROLLBACK on that session, then inspect from a fresh session.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(68182041);
DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
     OR session_user <> 'postgres' OR current_schema() <> 'public'
     OR current_schemas(false) <> ARRAY['public','extensions']::name[] THEN
    RAISE EXCEPTION 'Unexpected echo-dev inspection identity or search path';
  END IF;
  IF nullif(current_setting('supabase.project_ref',true),'') IS NOT NULL
     AND current_setting('supabase.project_ref',true) <> 'dtcxlxehqiuhmhuypqbm' THEN
    RAISE EXCEPTION 'Wrong project reference';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector')
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') THEN
    RAISE EXCEPTION 'Preflight state changed; stop without installing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions
                 WHERE name='vector' AND default_version='0.8.2') THEN
    RAISE EXCEPTION 'Default vector version changed; review before probe';
  END IF;
END
$guard$;
-- Exactly the extension statement in unchanged migration 001.
CREATE EXTENSION IF NOT EXISTS vector;
SELECT e.extname, e.extversion, n.nspname AS installed_schema,
       pg_get_userbyid(e.extowner) AS extension_owner,
       current_user AS execution_role, session_user AS session_role,
       current_schemas(false) AS effective_search_path,
       to_regtype('vector') IS NOT NULL AS vector_visible
FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
WHERE e.extname='vector';
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                 WHERE e.extname='vector' AND e.extversion='0.8.2'
                   AND n.nspname=ANY(current_schemas(false)))
     OR to_regtype('vector') IS NULL THEN
    RAISE EXCEPTION 'Vector version or visibility does not satisfy migration';
  END IF;
END
$verify$;
-- Harmless expression only: verifies type dimension and cosine operator resolution.
SELECT vector_dims('[1,0,0]'::vector(3)) AS dimensions,
       '[1,0,0]'::vector(3) <=> '[1,0,0]'::vector(3) AS cosine_distance;
ROLLBACK;
-- Repeat these metadata queries in a FRESH read-only session to confirm cleanup.
BEGIN READ ONLY;
SELECT NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') AS vector_absent,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS public_relations,
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AS public_functions,
       to_regclass('public.schema_migrations') IS NULL AS migration_history_absent;
ROLLBACK;

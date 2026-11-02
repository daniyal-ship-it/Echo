-- Object-scoped security; executed in the same transaction as 001/002.
-- Shared public schema/default ACLs and extension objects are deliberately untouched.
DO $security$
DECLARE
  table_name text; role_name text; columns_sql text; object_id oid;
  privileges text := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    privileges := privileges || ',MAINTAIN';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['schema_migrations','users','workspaces','sessions','auth_attempts','data_sources','memory_nodes','memory_versions','memory_edges','embeddings','import_jobs','agent_runs','retrieval_citations','audit_events','memory_chunks','embedding_cache','chunk_embeddings','intelligence_jobs','intelligence_operations','analysis_parts','memory_analyses','query_embeddings'] LOOP
    object_id := to_regclass(format('public.%I',table_name));
    IF object_id IS NULL OR NOT EXISTS (SELECT 1 FROM pg_class
      WHERE oid=object_id AND relkind='r' AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) THEN
      RAISE EXCEPTION 'ECHO security requires expected tables owned by the migration/backend role';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid=object_id) THEN
      RAISE EXCEPTION 'Unexpected policy on ECHO table';
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    SELECT string_agg(format('%I',attname),',') INTO columns_sql
      FROM pg_attribute WHERE attrelid=object_id AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',table_name);
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC',columns_sql,columns_sql,columns_sql,columns_sql,table_name);
    FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',table_name,role_name);
      EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM %I',columns_sql,columns_sql,columns_sql,columns_sql,table_name,role_name);
      IF has_table_privilege(role_name,object_id,privileges)
        OR has_any_column_privilege(role_name,object_id,'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'ECHO effective privileges remain through inherited or other grants';
      END IF;
    END LOOP;
  END LOOP;
  REVOKE ALL ON FUNCTION public.invalidate_memory_intelligence() FROM PUBLIC;
  ALTER FUNCTION public.invalidate_memory_intelligence() SECURITY INVOKER;
  ALTER FUNCTION public.invalidate_memory_intelligence() SET search_path = pg_catalog, public;
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.invalidate_memory_intelligence() FROM %I',role_name);
    IF has_function_privilege(role_name,'public.invalidate_memory_intelligence()','EXECUTE') THEN
      RAISE EXCEPTION 'ECHO function execution remains through inherited grants';
    END IF;
  END LOOP;
END
$security$;
INSERT INTO schema_migrations(version) VALUES ('003_server_only_access');

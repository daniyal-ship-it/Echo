-- Additive server-only collaboration storage. Runner wraps all DDL and ACLs atomically.
-- No changes to existing memories, shared schema grants, roles or default ACLs.
CREATE TABLE collaboration_threads (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,idempotency_key)
);
CREATE TABLE collaboration_turns (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 100),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  question text NOT NULL CHECK(length(question) BETWEEN 2 AND 2000),
  mode text NOT NULL CHECK(mode IN ('parallel','deliberate')),
  config jsonb NOT NULL CHECK(jsonb_typeof(config)='object'),
  citations jsonb NOT NULL CHECK(jsonb_typeof(citations)='array'),
  history jsonb NOT NULL CHECK(jsonb_typeof(history)='array'),
  prompt_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','running','awaiting-next-step','completed','failed','cancelled','uncertain')),
  stage text NOT NULL CHECK(stage IN ('analysis','review','synthesis')),
  error text,
  lease_token uuid,
  lease_until timestamptz,
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,thread_id) REFERENCES collaboration_threads(workspace_id,id) ON DELETE CASCADE,
  UNIQUE(workspace_id,id), UNIQUE(thread_id,ordinal), UNIQUE(thread_id,idempotency_key)
);
CREATE TABLE collaboration_calls (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  stage text NOT NULL CHECK(stage IN ('analysis','review','synthesis')),
  provider text NOT NULL CHECK(provider IN ('openai','anthropic')),
  model text NOT NULL,
  attempt integer NOT NULL CHECK(attempt BETWEEN 1 AND 8),
  status text NOT NULL CHECK(status IN ('planned','dispatched','completed','failed','uncertain','withheld')),
  billing text NOT NULL CHECK(billing IN ('not-sent','unknown','reported','rejected')),
  output jsonb CHECK(output IS NULL OR jsonb_typeof(output)='object'),
  result jsonb CHECK(result IS NULL OR jsonb_typeof(result)='object'),
  error text,
  retryable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  FOREIGN KEY(workspace_id,turn_id) REFERENCES collaboration_turns(workspace_id,id) ON DELETE CASCADE,
  UNIQUE(turn_id,stage,provider,attempt)
);
CREATE TABLE collaboration_steps (
  workspace_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(turn_id,idempotency_key),
  FOREIGN KEY(workspace_id,turn_id) REFERENCES collaboration_turns(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX collaboration_threads_workspace_created ON collaboration_threads(workspace_id,created_at DESC,id);
CREATE INDEX collaboration_calls_turn ON collaboration_calls(workspace_id,turn_id,created_at,id);
-- Object-scoped revocation removes unsafe Supabase defaults without changing them.
-- Effective inherited/column grants are verified; unsafe ownership fails closed.
DO $security$
DECLARE
  table_name text; role_name text; columns_sql text; object_id oid;
  privileges text := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    privileges := privileges || ',MAINTAIN';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['collaboration_threads','collaboration_turns','collaboration_calls','collaboration_steps'] LOOP
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
    FOR role_name IN SELECT r.rolname FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated','service_role','authenticator')
         OR pg_has_role((SELECT oid FROM pg_roles WHERE rolname='authenticator'), r.oid, 'MEMBER') LOOP
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',table_name,role_name);
      EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM %I',columns_sql,columns_sql,columns_sql,columns_sql,table_name,role_name);
      IF has_table_privilege(role_name,object_id,privileges)
        OR has_any_column_privilege(role_name,object_id,'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'ECHO effective privileges remain through inherited or other grants';
      END IF;
    END LOOP;
  END LOOP;
END
$security$;
INSERT INTO schema_migrations(version) VALUES ('004_collaboration');

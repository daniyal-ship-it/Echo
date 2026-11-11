-- ECHO echo-dev migration bundle: 001_foundation + 002_memory_intelligence + 003_server_only_access
-- TARGET: Supabase project echo-dev (dtcxlxehqiuhmhuypqbm) ONLY.
-- The guard below binds execution to echo-dev's PostgreSQL cluster identifier, so this
-- file aborts with no changes if run against any other database, including the original
-- ECHO project (pyidklztsnowarqumtki).
-- One transaction: any failure, including the final verification, leaves the database unchanged.
-- Source sha256:
--   001 e2aa042caac73f5c9bfcc6670e1d2ebaf02fd16663af32cb92865d54965ec8d5
--   002 03a8133818c74bc51882a2c91f1b57019ae5080ab11a4b61e233e59da28d26c7
--   003 a480f12bad249982de869b4a992601edbd14a7d3e0a116d2badc75f707e01a78 (includes authenticator hardening)
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '10s';
-- >>> GUARD
DO $guard$
BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283' THEN
    RAISE EXCEPTION 'ECHO bundle guard: this is not the echo-dev cluster';
  END IF;
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
     OR current_setting('server_version_num')::int/10000 <> 17 THEN
    RAISE EXCEPTION 'ECHO bundle guard: unexpected database, role or PostgreSQL major version';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
     OR EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') THEN
    RAISE EXCEPTION 'ECHO bundle guard: echo-dev is not in the expected empty state';
  END IF;
END
$guard$;
-- <<< GUARD

-- ===== 001_foundation =====
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (id uuid PRIMARY KEY, owner_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_attempts (key text PRIMARY KEY, count integer NOT NULL, started_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE data_sources (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, provider text NOT NULL, source_key text NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(workspace_id,provider,source_key));
CREATE TABLE memory_nodes (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  title text NOT NULL, summary text NOT NULL, content text NOT NULL,
  source text NOT NULL, kind text NOT NULL,
  region text NOT NULL CHECK (region IN ('frontal','parietal','temporal','occipital')),
  tags text[] NOT NULL DEFAULT '{}', importance real NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
  position jsonb NOT NULL, anchor integer NOT NULL,
  version integer NOT NULL DEFAULT 1, is_demo boolean NOT NULL DEFAULT false,
  indexing_status text NOT NULL DEFAULT 'keyword', privacy text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(), source_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english',title),'A') || setweight(to_tsvector('english',content),'B')) STORED,
  UNIQUE(workspace_id,source_id), UNIQUE(workspace_id,anchor), UNIQUE(workspace_id,id)
);
CREATE INDEX memories_search ON memory_nodes USING gin(search_vector);
CREATE INDEX memories_workspace_date ON memory_nodes(workspace_id,created_at DESC);
CREATE INDEX memories_tags ON memory_nodes USING gin(tags);
CREATE TABLE memory_versions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  version integer NOT NULL, fingerprint text NOT NULL, raw jsonb NOT NULL,
  content text NOT NULL, messages jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(memory_id,version), UNIQUE(memory_id,fingerprint)
);
CREATE TABLE memory_edges (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id uuid NOT NULL, target_id uuid NOT NULL,
  relationship text NOT NULL, evidence text NOT NULL, confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  strength real NOT NULL DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1), method text NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','confirmed','dismissed')),
  pinned boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), validated_at timestamptz DEFAULT now(),
  CHECK(source_id <> target_id), UNIQUE(workspace_id,source_id,target_id),
  FOREIGN KEY(workspace_id,source_id) REFERENCES memory_nodes(workspace_id,id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,target_id) REFERENCES memory_nodes(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE embeddings (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id uuid PRIMARY KEY REFERENCES memory_nodes(id) ON DELETE CASCADE,
  model text NOT NULL, content_hash text NOT NULL, embedding vector(1536) NOT NULL, created_at timestamptz DEFAULT now()
);
CREATE TABLE import_jobs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  filename text NOT NULL, fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
  items jsonb NOT NULL, original bytea NOT NULL, total integer NOT NULL,
  processed integer NOT NULL DEFAULT 0, added integer NOT NULL DEFAULT 0, duplicates integer NOT NULL DEFAULT 0,
  error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,fingerprint)
);
CREATE TABLE agent_runs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question text NOT NULL, status text NOT NULL, outputs jsonb NOT NULL DEFAULT '[]',
  tokens integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE retrieval_citations (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  memory_id uuid NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  excerpt text NOT NULL, version integer NOT NULL
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action text NOT NULL, resource_id text, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES ('001_foundation');

-- ===== 002_memory_intelligence =====
-- Originals remain immutable. All derived rows are scoped and cascade on deletion.
ALTER TABLE memory_versions ADD CONSTRAINT versions_workspace_memory_version UNIQUE(workspace_id,memory_id,version);
CREATE TABLE memory_chunks (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, memory_id uuid NOT NULL, source_version integer NOT NULL,
 ordinal integer NOT NULL, message_id text, message_index integer, role text, source_timestamp text,
 active boolean NOT NULL, start_offset integer NOT NULL, end_offset integer NOT NULL,
 content text NOT NULL, content_hash text NOT NULL, chunker_version text NOT NULL,
 search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english',content)) STORED,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,memory_id,source_version,ordinal),
 FOREIGN KEY(workspace_id,memory_id,source_version) REFERENCES memory_versions(workspace_id,memory_id,version) ON DELETE CASCADE
);
CREATE INDEX chunks_search ON memory_chunks USING gin(search_vector);
CREATE INDEX chunks_source ON memory_chunks(workspace_id,memory_id,source_version);
CREATE TABLE embedding_cache (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, memory_id uuid NOT NULL,
 content_hash text NOT NULL, provider text NOT NULL, model text NOT NULL, dimensions integer NOT NULL CHECK(dimensions=1536),
 api_version text NOT NULL, embedding vector(1536) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,memory_id,content_hash,model,dimensions),
 FOREIGN KEY(workspace_id,memory_id) REFERENCES memory_nodes(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE chunk_embeddings (
 workspace_id uuid NOT NULL, chunk_id uuid NOT NULL, cache_id uuid NOT NULL,
 PRIMARY KEY(workspace_id,chunk_id),
 FOREIGN KEY(workspace_id,chunk_id) REFERENCES memory_chunks(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,cache_id) REFERENCES embedding_cache(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE intelligence_jobs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, memory_id uuid NOT NULL, source_version integer NOT NULL,
 config jsonb NOT NULL, config_hash text NOT NULL, source_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('queued','running','retry_wait','uncertain','failed','cancelled','completed','superseded')),
 total_chunks integer NOT NULL, embedded integer NOT NULL DEFAULT 0, analysed integer NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz,
 error text, consent_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,memory_id,source_version,config_hash),
 FOREIGN KEY(workspace_id,memory_id,source_version) REFERENCES memory_versions(workspace_id,memory_id,version) ON DELETE CASCADE
);
CREATE TABLE intelligence_operations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, job_id uuid NOT NULL, step text NOT NULL, attempt integer NOT NULL,
 status text NOT NULL CHECK(status IN ('sent','succeeded','retryable','failed','uncertain')),
 result jsonb, reserved_tokens integer NOT NULL, usage_tokens integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(job_id,step,attempt),
 FOREIGN KEY(workspace_id,job_id) REFERENCES intelligence_jobs(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE analysis_parts (
 workspace_id uuid NOT NULL, job_id uuid NOT NULL, batch_index integer NOT NULL, chunk_ids jsonb NOT NULL, result jsonb NOT NULL,
 PRIMARY KEY(job_id,batch_index),
 FOREIGN KEY(workspace_id,job_id) REFERENCES intelligence_jobs(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE memory_analyses (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, memory_id uuid NOT NULL, source_version integer NOT NULL,
 job_id uuid NOT NULL UNIQUE, provider text NOT NULL, model text NOT NULL, prompt_version text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,job_id) REFERENCES intelligence_jobs(workspace_id,id) ON DELETE CASCADE,
 FOREIGN KEY(workspace_id,memory_id,source_version) REFERENCES memory_versions(workspace_id,memory_id,version) ON DELETE CASCADE
);
ALTER TABLE retrieval_citations ADD COLUMN chunk_id uuid REFERENCES memory_chunks(id) ON DELETE CASCADE;
ALTER TABLE memory_edges ADD COLUMN semantic_evidence jsonb;
CREATE TABLE query_embeddings (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, query_hash text NOT NULL, model text NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','uncertain')), lease_token uuid NOT NULL, lease_until timestamptz NOT NULL,
 embedding vector(1536), tokens integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,query_hash,model)
);
-- Superseded chunks remain available to historical citations but leave the active index.
CREATE FUNCTION invalidate_memory_intelligence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version <> OLD.version THEN
  DELETE FROM chunk_embeddings WHERE workspace_id=NEW.workspace_id AND chunk_id IN
   (SELECT id FROM memory_chunks WHERE workspace_id=NEW.workspace_id AND memory_id=NEW.id);
  UPDATE intelligence_jobs SET status='superseded',lease_token=NULL,lease_until=NULL,updated_at=now()
   WHERE workspace_id=NEW.workspace_id AND memory_id=NEW.id AND status NOT IN ('completed','cancelled','superseded');
  DELETE FROM memory_edges WHERE workspace_id=NEW.workspace_id AND (source_id=NEW.id OR target_id=NEW.id)
   AND method='semantic' AND status='candidate';
  UPDATE memory_edges SET semantic_evidence=jsonb_set(semantic_evidence,'{stale}','true'::jsonb)
   WHERE workspace_id=NEW.workspace_id AND (source_id=NEW.id OR target_id=NEW.id) AND semantic_evidence IS NOT NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_memory_intelligence AFTER UPDATE OF version ON memory_nodes
 FOR EACH ROW EXECUTE FUNCTION invalidate_memory_intelligence();
INSERT INTO schema_migrations(version) VALUES ('002_memory_intelligence');

-- ===== 003_server_only_access =====
-- Object-scoped security; executed in the same transaction as 001/002.
-- Shared public schema/default ACLs and extension objects are deliberately untouched.
-- Covers the API login role (authenticator) and every role it can reach by membership
-- or SET ROLE, so a future grant path through authenticator fails the migration.
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
  REVOKE ALL ON FUNCTION public.invalidate_memory_intelligence() FROM PUBLIC;
  ALTER FUNCTION public.invalidate_memory_intelligence() SECURITY INVOKER;
  ALTER FUNCTION public.invalidate_memory_intelligence() SET search_path = pg_catalog, public;
  FOR role_name IN SELECT r.rolname FROM pg_roles r
      WHERE r.rolname IN ('anon','authenticated','service_role','authenticator')
         OR pg_has_role((SELECT oid FROM pg_roles WHERE rolname='authenticator'), r.oid, 'MEMBER') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.invalidate_memory_intelligence() FROM %I',role_name);
    IF has_function_privilege(role_name,'public.invalidate_memory_intelligence()','EXECUTE') THEN
      RAISE EXCEPTION 'ECHO function execution remains through inherited grants';
    END IF;
  END LOOP;
END
$security$;
INSERT INTO schema_migrations(version) VALUES ('003_server_only_access');

-- Final verification inside the transaction; any failure aborts everything.
DO $verify$
DECLARE n int; bad text;
BEGIN
  SELECT count(*) INTO n FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r';
  IF n <> 22 THEN RAISE EXCEPTION 'ECHO verify: expected 22 tables, found %', n; END IF;
  SELECT count(*) INTO n FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND NOT c.relrowsecurity;
  IF n <> 0 THEN RAISE EXCEPTION 'ECHO verify: % tables without row level security', n; END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'ECHO verify: unexpected policy present';
  END IF;
  SELECT string_agg(r.rolname||':'||c.relname, ', ') INTO bad
    FROM pg_class c, pg_roles r
    WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
      AND r.rolname IN ('anon','authenticated','service_role','authenticator')
      AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'ECHO verify: API role privileges remain: %', bad; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','authenticator')
             AND has_function_privilege(r.oid,'public.invalidate_memory_intelligence()','EXECUTE')) THEN
    RAISE EXCEPTION 'ECHO verify: API role can execute the trigger function';
  END IF;
  SELECT count(*) INTO n FROM schema_migrations
    WHERE version IN ('001_foundation','002_memory_intelligence','003_server_only_access');
  IF n <> 3 THEN RAISE EXCEPTION 'ECHO verify: expected 3 migration records, found %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') THEN
    RAISE EXCEPTION 'ECHO verify: vector not installed';
  END IF;
END
$verify$;
COMMIT;

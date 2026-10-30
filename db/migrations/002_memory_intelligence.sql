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

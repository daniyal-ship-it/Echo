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

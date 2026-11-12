import { test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { createDatabase, managedPostgresOptions, type Database } from '../lib/db';
import { storeMemory } from '../lib/memories';
import { hybridRetrieve, assertCitationAccess } from '../lib/retrieval';
import {
  enqueueIntelligence,
  controlIntelligence,
  type IntelligenceServices,
} from '../lib/intelligence';
import { getPassage } from '../lib/chunks';
import { uuid } from '../lib/security';
import { CHUNKER_VERSION, PROMPT_VERSION } from '../lib/intelligence-types';

// This database is CREATED FOR TESTS and destroyed with the Docker container.
// Never aim this at a configured application database, even echo-dev.
const url = process.env.ECHO_TEST_POSTGRES_URL;
test(
  'real PostgreSQL/pgvector: hardened migrations, immutable JSON citations, isolation and reopen persistence',
  { skip: !url },
  async () => {
    const target = new URL(url!);
    assert.ok(
      ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname),
      'Tests require disposable loopback PostgreSQL',
    );
    assert.equal(target.pathname, '/echo_json_test');
    const savedUrl = process.env.DATABASE_URL,
      savedSSL = process.env.DATABASE_SSL;
    process.env.DATABASE_URL = url;
    process.env.DATABASE_SSL = 'disable';
    let db: Database | undefined;
    const setup = postgres(url!, managedPostgresOptions());
    try {
      await setup.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator NOINHERIT;
      GRANT anon,authenticated,service_role TO authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`);
      db = await createDatabase(undefined, { applyManagedMigrations: true });
      const [{ extversion }] = await db.query<{ extversion: string }>(
        "SELECT extversion FROM pg_extension WHERE extname='vector'",
      );
      assert.equal(extversion, '0.8.2');
      const [{ count }] = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity",
      );
      assert.equal(count, 22);
      const owner = uuid(),
        workspace = uuid();
      await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
        owner,
        `${owner}@example.test`,
        'PG fixture',
        'not-a-login',
      ]);
      await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
        workspace,
        owner,
        'PG fixture',
      ]);
      const message = {
        id: 'actual-message',
        role: 'user',
        content: 'The iridescent notebook remains in the cabinet.',
        timestamp: null,
        parent: null,
        active: true,
      };
      const item = {
        source: 'note',
        sourceId: 'real-pg',
        title: 'Notebook',
        content: message.content,
        raw: { text: message.content },
        messages: [message],
        sourceAt: null,
        kind: 'note',
        tags: [],
      };
      const memory = await db.transaction((tx) => storeMemory(tx, workspace, item));
      assert.equal(
        (await db.transaction((tx) => storeMemory(tx, workspace, item))).duplicate,
        true,
      );
      const services: IntelligenceServices = {
        config: async () => ({
          embeddingModel: 'text-embedding-3-small',
          dimensions: 1536,
          summaryProvider: 'openai',
          summaryModel: 'not-dispatched',
          promptVersion: PROMPT_VERSION,
          chunkerVersion: CHUNKER_VERSION,
        }),
        embed: async () => {
          throw new Error('No provider calls permitted');
        },
        analyse: async () => {
          throw new Error('No provider calls permitted');
        },
      };
      const job = await enqueueIntelligence(db, workspace, memory.id, 'openai', services);
      assert.equal(job.config.promptVersion, PROMPT_VERSION);
      const citation = (await hybridRetrieve(db, workspace, 'iridescent notebook')).citations[0];
      assert.equal(citation.brainNodeId, memory.id);
      assert.equal(citation.speakerRole, 'user');
      await assertCitationAccess(db, workspace, [citation]);
      // The assistant publication transaction shares this lock with original edits.
      await db.transaction(async (tx) => {
        await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspace]);
        await assertCitationAccess(tx, workspace, [citation]);
        await assert.rejects(
          setup.unsafe('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE NOWAIT', [workspace]),
          (error: unknown) => (error as { code?: string }).code === '55P03',
        );
      });
      await assert.rejects(assertCitationAccess(db, uuid(), [citation]), /available/);
      await assert.rejects(
        assertCitationAccess(db, workspace, [{ ...citation, speakerRole: 'assistant' }]),
        /passage/,
      );
      await db.close();
      db = await createDatabase();
      assert.equal(
        (await getPassage(db, workspace, memory.id, citation.chunkId!)).content,
        message.content,
      );
      await controlIntelligence(db, workspace, job.id, 'cancel');
      await db.transaction((tx) =>
        storeMemory(tx, workspace, {
          ...item,
          content: 'The notebook moved.',
          messages: [],
          raw: { text: 'changed' },
        }),
      );
      await assert.rejects(assertCitationAccess(db, workspace, [citation]), /changed/);
      assert.equal(
        (await getPassage(db, workspace, memory.id, citation.chunkId!)).source_version,
        1,
      );
      const privileges = await db.query<{
        unsafe: boolean;
      }>(`SELECT has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS unsafe
      FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname IN ('anon','authenticated','service_role','authenticator') AND c.relnamespace='public'::regnamespace AND c.relkind='r'`);
      assert.equal(privileges.length, 88);
      assert.ok(privileges.every((p) => !p.unsafe));
    } finally {
      await db?.close();
      await setup.end();
      if (savedUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = savedUrl;
      if (savedSSL === undefined) delete process.env.DATABASE_SSL;
      else process.env.DATABASE_SSL = savedSSL;
    }
  },
);

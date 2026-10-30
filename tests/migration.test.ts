import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { createDatabase, type Database } from '../lib/db';
import { memoryDetail } from '../lib/memories';
import { uuid } from '../lib/security';
test('additive migration upgrades an existing foundation database without changing originals or anchors', async () => {
  const dir = await mkdtemp('/tmp/echo-migration-'),
    owner = uuid(),
    workspace = uuid(),
    source = uuid(),
    memory = uuid();
  let old: PGlite | undefined, current: Database | undefined;
  try {
    old = await PGlite.create({ dataDir: dir, extensions: { vector } });
    await old.exec(await readFile('db/migrations/001_foundation.sql', 'utf8'));
    await old.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      owner,
      'upgrade@example.test',
      'Existing fixture',
      'unused',
    ]);
    await old.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
      workspace,
      owner,
      'Existing workspace',
    ]);
    await old.query(
      'INSERT INTO data_sources(id,workspace_id,provider,source_key) VALUES($1,$2,$3,$4)',
      [source, workspace, 'note', 'existing'],
    );
    await old.query(
      "INSERT INTO memory_nodes(id,workspace_id,source_id,title,summary,content,source,kind,region,position,anchor) VALUES($1,$2,$3,'Existing original','Extract','Original before upgrade','note','note','frontal','[1,2,3]',42)",
      [memory, workspace, source],
    );
    await old.query(
      "INSERT INTO memory_versions(id,workspace_id,memory_id,version,fingerprint,raw,content) VALUES($1,$2,$3,1,'existing-hash','{\"preserve\":true}','Original before upgrade')",
      [uuid(), workspace, memory],
    );
    await old.close();
    old = undefined;
    current = await createDatabase(dir);
    const detail = await memoryDetail(current, workspace, memory);
    assert.equal(detail.content, 'Original before upgrade');
    assert.deepEqual(detail.raw, { preserve: true });
    assert.deepEqual(detail.position, [1, 2, 3]);
    assert.equal(detail.anchor, 42);
    assert.equal(detail.version, 1);
    assert.equal((await current.query('SELECT * FROM schema_migrations')).length, 2);
    await current.close();
    current = await createDatabase(dir);
    assert.equal((await current.query('SELECT * FROM schema_migrations')).length, 2);
  } finally {
    await old?.close();
    await current?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

import { getDb } from '../lib/db';
async function main() {
  const db = await getDb();
  const rows = await db.query('SELECT version FROM schema_migrations ORDER BY version');
  console.log('Applied migrations:', rows.map((r) => r.version).join(', '));
  await db.close();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

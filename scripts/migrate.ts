import { createDatabase } from '../lib/db';
import { logDatabaseError, newDiagnosticId } from '../lib/database-diagnostics';
async function main() {
  // Managed schema changes require an explicit operator action and prior approval.
  const db = await createDatabase(undefined, {
    applyManagedMigrations: process.argv.includes('--apply'),
  });
  const rows = await db.query('SELECT version FROM schema_migrations ORDER BY version');
  console.log('Applied migrations:', rows.map((r) => r.version).join(', '));
  await db.close();
}
main().catch((error) => {
  logDatabaseError(error, newDiagnosticId(), 'migration.apply');
  process.exitCode = 1;
});

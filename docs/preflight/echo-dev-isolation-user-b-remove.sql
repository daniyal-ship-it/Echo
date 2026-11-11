-- ECHO hosted isolation test: remove temporary user B from echo-dev (dtcxlxehqiuhmhuypqbm) ONLY.
-- Safe to run at any point and more than once. Deleting the user cascades to its workspace,
-- sessions, notes, versions, edges, jobs and audit events. Also removes any leftover test notes
-- (title 'Isolation test A|B zq…') that an interrupted run left in user A's workspace, and
-- user B's login rate-limit row. Nothing else is touched.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
-- >>> GUARD
DO $guard$
BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283' THEN
    RAISE EXCEPTION 'ECHO isolation guard: this is not the echo-dev cluster';
  END IF;
END
$guard$;
-- <<< GUARD
DELETE FROM users WHERE email='isolation-b@example.test';
DELETE FROM memory_nodes WHERE source='note' AND title ~ '^Isolation test [AB] zq[a-z]{14}$';
DELETE FROM auth_attempts WHERE key = encode(sha256(convert_to('login:isolation-b@example.test','UTF8')),'hex');
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email='isolation-b@example.test')
     OR EXISTS (SELECT 1 FROM workspaces WHERE name='Isolation Test B’s memory')
     OR EXISTS (SELECT 1 FROM sessions s WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id=s.user_id))
     OR EXISTS (SELECT 1 FROM memory_nodes WHERE title ~ '^Isolation test [AB] zq[a-z]{14}$') THEN
    RAISE EXCEPTION 'ECHO isolation: user B or its data still present';
  END IF;
END
$post$;
COMMIT;

-- ECHO hosted isolation test: create temporary user B on echo-dev (dtcxlxehqiuhmhuypqbm) ONLY.
-- One transaction. Requires exactly one existing user (user A, registered through the app).
-- {{USER_ID}}, {{WORKSPACE_ID}} and {{PASSWORD_HASH}} are filled in at execution time.
-- The hash is produced by the application's own hashPassword() (scrypt); no password is stored here.
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
DO $pre$
BEGIN
  IF (SELECT count(*) FROM users) <> 1 THEN
    RAISE EXCEPTION 'ECHO isolation: expected exactly one existing user (user A), found %', (SELECT count(*) FROM users);
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE email='isolation-b@example.test') THEN
    RAISE EXCEPTION 'ECHO isolation: user B already exists';
  END IF;
END
$pre$;
INSERT INTO users(id,email,name,password_hash)
  VALUES ('{{USER_ID}}','isolation-b@example.test','Isolation Test B','{{PASSWORD_HASH}}');
INSERT INTO workspaces(id,owner_id,name)
  VALUES ('{{WORKSPACE_ID}}','{{USER_ID}}','Isolation Test B’s memory');
INSERT INTO audit_events(id,workspace_id,action,resource_id)
  VALUES (gen_random_uuid(),'{{WORKSPACE_ID}}','account.created','{{USER_ID}}');
DO $post$
BEGIN
  IF (SELECT count(*) FROM users) <> 2 OR (SELECT count(*) FROM workspaces) <> 2
     OR NOT EXISTS (SELECT 1 FROM users u JOIN workspaces w ON w.owner_id=u.id
                    WHERE u.email='isolation-b@example.test' AND w.id='{{WORKSPACE_ID}}') THEN
    RAISE EXCEPTION 'ECHO isolation: unexpected state after creating user B';
  END IF;
END
$post$;
COMMIT;

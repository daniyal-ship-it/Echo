-- ECHO: repair jsonb values that the managed driver stored double-encoded, on echo-dev
-- (dtcxlxehqiuhmhuypqbm) ONLY. Run AFTER the driver fix is deployed, or new writes will be
-- double-encoded again.
-- A double-encoded value is a jsonb *string* whose text is the intended array or object.
-- Every column listed holds only arrays or objects by design, so any string is damage.
-- The repair unwraps one level per pass and repeats until none remain. It changes no other
-- column, deletes nothing, and is safe to run more than once. One transaction.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
-- >>> GUARD
DO $guard$
BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283' THEN
    RAISE EXCEPTION 'ECHO repair guard: this is not the echo-dev cluster';
  END IF;
END
$guard$;
-- <<< GUARD
DO $repair$
DECLARE
  target text[];
  changed bigint;
  remaining bigint;
  pass int;
BEGIN
  FOREACH target SLICE 1 IN ARRAY ARRAY[
    ['memory_nodes','position'], ['memory_versions','raw'], ['memory_versions','messages'],
    ['memory_edges','semantic_evidence'], ['import_jobs','items'], ['agent_runs','outputs'],
    ['intelligence_jobs','config'], ['intelligence_operations','result'],
    ['analysis_parts','chunk_ids'], ['analysis_parts','result'], ['memory_analyses','result']
  ] LOOP
    FOR pass IN 1..5 LOOP
      EXECUTE format(
        'UPDATE public.%1$I SET %2$I = (%2$I #>> ''{}'')::jsonb WHERE jsonb_typeof(%2$I) = ''string''',
        target[1], target[2]);
      GET DIAGNOSTICS changed = ROW_COUNT;
      EXIT WHEN changed = 0;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE jsonb_typeof(%I) = ''string''', target[1], target[2])
      INTO remaining;
    IF remaining > 0 THEN
      RAISE EXCEPTION 'ECHO repair: % rows in %.% are still strings', remaining, target[1], target[2];
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM memory_nodes WHERE jsonb_typeof(position) <> 'array' OR jsonb_array_length(position) <> 3) THEN
    RAISE EXCEPTION 'ECHO repair: a memory position is not a three-number array';
  END IF;
  IF EXISTS (SELECT 1 FROM memory_versions WHERE jsonb_typeof(messages) <> 'array') THEN
    RAISE EXCEPTION 'ECHO repair: a version has messages that are not an array';
  END IF;
END
$repair$;
COMMIT;

-- STEP 2 — Run AFTER the function exists (STEP 1 succeeded).
-- NOT applied by git push; run in SQL Editor as its own execution.
--
-- If CREATE EXTENSION fails: Dashboard → Database → Extensions → enable "pg_cron",
-- then run only the SELECT cron.schedule(...) part, or run this whole file again.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid
  FROM cron.job j
  WHERE j.jobname = 'close-stale-game-sessions';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END
$$;

-- Daily at 00:05 UTC
SELECT cron.schedule(
  'close-stale-game-sessions',
  '5 0 * * *',
  $$SELECT public.close_stale_game_sessions();$$
);

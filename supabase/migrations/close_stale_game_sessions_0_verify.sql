-- STEP 0 — Run this alone in SQL Editor. If anything here fails, fix that before other files.
-- Paste the ERROR text from Supabase if you need help (it pinpoints the problem).

-- 1) Confirm the table exists (should return one row: game_sessions)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'game_sessions';

-- 2) List columns (you need at least: status, and a timestamp for "last activity")
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'game_sessions'
ORDER BY ordinal_position;

-- 3) Quick read test (should not error). Add updated_at/created_at only if step 2 listed them.
SELECT id, status
FROM public.game_sessions
LIMIT 3;

-- 4) Optional: plain UPDATE without a function — if THIS fails, the function will fail too.
--    Run only after checking (2) shows the columns you expect.
--    Comment out if you only want diagnostics.

-- UPDATE public.game_sessions
-- SET status = 'abandoned'
-- WHERE status IN ('active', 'waiting')
--   AND COALESCE(updated_at, created_at) < (now() - interval '3 hours')
-- RETURNING id, status;

-- Optional data cleanup — run in Supabase SQL Editor (one section at a time).
-- NOT auto-applied by git push. Read each block before running.
-- Prefer running SELECT / preview queries first; wrap destructive changes in BEGIN; … ROLLBACK; to test.

-- =============================================================================
-- 1) Stale multiplayer sessions (same logic as close_stale_game_sessions)
-- =============================================================================
-- Preview how many rows would change:
SELECT id, status, updated_at, created_at
FROM public.game_sessions
WHERE status IN ('active', 'waiting')
  AND COALESCE(updated_at, created_at) < (now() - interval '3 hours');

-- Apply (uncomment when ready):
-- UPDATE public.game_sessions
-- SET status = 'abandoned'
-- WHERE status IN ('active', 'waiting')
--   AND COALESCE(updated_at, created_at) < (now() - interval '3 hours');

-- Or call your existing function:
-- SELECT public.close_stale_game_sessions();


-- =============================================================================
-- 2) Matchmaking queue — stuck rows (optional)
-- =============================================================================
-- See who is waiting:
-- SELECT * FROM public.matchmaking_queue;

-- Remove everyone from quick-match queue (they can queue again in the app):
-- DELETE FROM public.matchmaking_queue;

-- Or only rows with no game and older than 1 day (adjust interval):
-- DELETE FROM public.matchmaking_queue
-- WHERE game_id IS NULL
--   AND created_at < (now() - interval '1 day');


-- =============================================================================
-- 3) Inventory rows pointing at deleted / missing cards
-- =============================================================================
-- Preview bad rows:
SELECT ui.user_id, ui.card_id, ui.quantity
FROM public.user_inventory ui
LEFT JOIN public.cards c ON c.id = ui.card_id
WHERE c.id IS NULL;

-- Remove orphan inventory lines (uncomment when ready):
-- DELETE FROM public.user_inventory ui
-- WHERE NOT EXISTS (SELECT 1 FROM public.cards c WHERE c.id = ui.card_id);


-- =============================================================================
-- 4) Decks that reference unknown card IDs (breaks multiplayer validation)
-- =============================================================================
-- This app stores card_ids as PostgreSQL integer[] (or bigint[]) — use unnest(), not jsonb.

-- Preview bad decks:
SELECT d.id, d.user_id, d.name, d.card_ids
FROM public.decks d
WHERE EXISTS (
  SELECT 1
  FROM unnest(d.card_ids) AS cid
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cards c WHERE c.id = cid
  )
);

-- Delete those decks (uncomment when ready):
-- DELETE FROM public.decks d
-- WHERE EXISTS (
--   SELECT 1 FROM unnest(d.card_ids) AS cid
--   WHERE NOT EXISTS (SELECT 1 FROM public.cards c WHERE c.id = cid)
-- );

-- --- Only if your column is actually jsonb (not integer[]), use this instead ---
-- SELECT d.id, d.user_id, d.name, d.card_ids
-- FROM public.decks d
-- WHERE EXISTS (
--   SELECT 1 FROM jsonb_array_elements(d.card_ids::jsonb) AS t(value)
--   WHERE NOT EXISTS (
--     SELECT 1 FROM public.cards c WHERE c.id = (t.value::text)::int
--   )
-- );


-- =============================================================================
-- 5) Full reset for ONE user (replace the UUID)
-- =============================================================================
-- Use after deleting them from Authentication, or to wipe an old account row.
-- Order matters if foreign keys exist; delete children before parent profile.

-- :user_id := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- DELETE FROM public.matchmaking_queue WHERE user_id = :user_id;
-- DELETE FROM public.game_sessions
--   WHERE player1_id = :user_id OR player2_id = :user_id;
-- DELETE FROM public.decks WHERE user_id = :user_id;
-- DELETE FROM public.user_inventory WHERE user_id = :user_id;
-- DELETE FROM public.user_journey_progress WHERE user_id = :user_id;
-- DELETE FROM public.user_profiles WHERE user_id = :user_id;
-- DELETE FROM public.bug_reports WHERE user_id = :user_id;  -- if column exists

-- If a table references user_id and fails, check FK order or use CASCADE in schema later.


-- =============================================================================
-- 6) App cron (Vercel) — already hits abandoned active games by updated_at
-- =============================================================================
-- GET https://your-app.vercel.app/api/cron/cleanup-games
-- Header: Authorization: Bearer YOUR_CRON_SECRET
-- (Uses 20-minute inactivity; your Supabase daily job uses 3 hours.)

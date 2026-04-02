-- STEP 1 — Run AFTER close_stale_game_sessions_0_verify.sql succeeds.
-- NOT applied by git push; run in Supabase → SQL Editor (one execution).
--
-- Uses COALESCE(updated_at, created_at) so it still works if updated_at is null
-- for some rows. If your table has neither column, add updated_at in Dashboard
-- or change the WHERE clause to match your schema.

CREATE OR REPLACE FUNCTION public.close_stale_game_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  -- Avoid RLS blocking the maintenance job when the definer is not table owner
  SET LOCAL row_security = off;

  UPDATE public.game_sessions
  SET status = 'abandoned'
  WHERE status IN ('active', 'waiting')
    AND COALESCE(updated_at, created_at) < (now() - interval '3 hours');

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Test (should return a small integer, not an error)
-- SELECT public.close_stale_game_sessions();

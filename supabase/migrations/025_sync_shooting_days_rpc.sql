-- RPC for write-through of shooting_day from schedule + call-sheet
-- uploads into the scenes table.
--
-- Background: schedule_data.days[] and call_sheet_data.parsed_data.scenes[]
-- both list the scenes filming on a given production day. Pre-RPC, the
-- prep client would have had to issue one UPDATE per scene reference
-- (171 round-trips for a feature film) or one UPDATE per day with
-- per-day .in() lists. Either way the matching of scene_number +
-- number_suffix had to happen JS-side, and NULL-safe matching on
-- number_suffix needed a branch in JS to choose `.eq()` vs `.is()`.
--
-- This function takes a single JSONB array of assignments and applies
-- them in one transaction:
--
--   [{ "n": "176", "s": "A",  "d": 13 },
--    { "n": "4",   "s": null, "d": 1  }]
--
-- where n = scene_number (text — `scenes.scene_number` is a TEXT
-- column, so we keep the value as text and compare text-to-text;
-- this also lets legitimate non-numeric scene numbers like "P1" or
-- "TBC" round-trip cleanly), s = number_suffix (nullable),
-- d = shooting_day. The match is project-scoped and NULL-safe via
-- `IS NOT DISTINCT FROM` so the same SQL handles both suffixed and
-- unsuffixed rows.
--
-- Returns the number of rows actually updated so the caller can
-- compare it against the input length and log unmatched references.
--
-- Used by both the schedule write-through (saveSchedule) and the
-- call-sheet write-through (uploadCallSheetToStorage) in
-- prep/src/services/supabaseSync.ts.

CREATE OR REPLACE FUNCTION public.sync_shooting_days(
  p_project_id uuid,
  p_assignments jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_updated integer;
BEGIN
  WITH a AS (
    SELECT
      (elem->>'n')            AS scene_num,
      NULLIF(elem->>'s', '')  AS suffix,
      (elem->>'d')::integer   AS shooting_day
    FROM jsonb_array_elements(p_assignments) AS elem
  ),
  upd AS (
    UPDATE scenes s
       SET shooting_day = a.shooting_day
      FROM a
     WHERE s.project_id   = p_project_id
       AND s.scene_number = a.scene_num
       AND s.number_suffix IS NOT DISTINCT FROM a.suffix
    RETURNING s.id
  )
  SELECT count(*)::integer INTO v_updated FROM upd;

  RETURN v_updated;
END;
$$;

-- Authenticated users may invoke. Row-level security on `scenes`
-- still applies because the function runs as the caller (SECURITY
-- INVOKER), so users can only update scenes they have write access
-- to. Anonymous role gets no access.
GRANT EXECUTE ON FUNCTION public.sync_shooting_days(uuid, jsonb) TO authenticated;

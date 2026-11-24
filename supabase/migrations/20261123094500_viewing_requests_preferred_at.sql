-- Viewing requests: one preferred day and time instead of 1–3 days plus a part of the day
-- (Mos 23 Nov 2026: one day, a 7-day strip plus a calendar, a time every 30 minutes 08:00–20:00, not today).
-- Impact set approved by Mos on 23 Nov 2026, including doing it in one round: the table has never reached
-- develop or prod, so no running code reads the old columns (exception to supabase/AGENTS.md rule 2.6).
-- Rows written by 20261123040000 (local / branch databases only) are converted: the first preferred day at the
-- start of its part of the day (morning 09:00, afternoon 13:00, evening 17:00, any 10:00), Bangkok time.
-- "Not today" and "at most 60 days ahead" depend on the clock, so the API checks them, not this table.
-- Undo: ALTER TABLE public.viewing_requests ADD COLUMN preferred_dates date[], ADD COLUMN preferred_slot varchar(10);
--       UPDATE public.viewing_requests SET preferred_dates = ARRAY[(preferred_at AT TIME ZONE 'Asia/Bangkok')::date],
--         preferred_slot = CASE WHEN (preferred_at AT TIME ZONE 'Asia/Bangkok')::time < '12:00' THEN 'morning'
--                               WHEN (preferred_at AT TIME ZONE 'Asia/Bangkok')::time < '17:00' THEN 'afternoon' ELSE 'evening' END;
--       then set both NOT NULL, put back chk_viewing_requests_slot / chk_viewing_requests_dates, drop preferred_at.
--       (Days 2–3 of converted rows are not kept by this file and cannot come back.)
ALTER TABLE public.viewing_requests ADD COLUMN preferred_at timestamptz;

UPDATE public.viewing_requests
SET preferred_at = (preferred_dates[1] + CASE preferred_slot
    WHEN 'morning' THEN time '09:00'
    WHEN 'afternoon' THEN time '13:00'
    WHEN 'evening' THEN time '17:00'
    ELSE time '10:00'
  END) AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE public.viewing_requests ALTER COLUMN preferred_at SET NOT NULL;

ALTER TABLE public.viewing_requests DROP CONSTRAINT chk_viewing_requests_slot;
ALTER TABLE public.viewing_requests DROP CONSTRAINT chk_viewing_requests_dates;
ALTER TABLE public.viewing_requests DROP COLUMN preferred_slot;
ALTER TABLE public.viewing_requests DROP COLUMN preferred_dates;

-- 08:00–20:00 Bangkok time on the hour or half hour (same text as the entity's @Check).
ALTER TABLE public.viewing_requests ADD CONSTRAINT chk_viewing_requests_preferred_at CHECK (date_part('second', preferred_at AT TIME ZONE 'Asia/Bangkok') = 0 AND date_part('minute', preferred_at AT TIME ZONE 'Asia/Bangkok') IN (0, 30) AND (preferred_at AT TIME ZONE 'Asia/Bangkok')::time BETWEEN '08:00' AND '20:00');

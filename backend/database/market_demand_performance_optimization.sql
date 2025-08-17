-- Market Demand Performance Optimization
-- Adds batch RPC function to eliminate N+1 query problems

-- One RPC to fetch all signals per date for a room type + location
CREATE OR REPLACE FUNCTION market_signals_by_date(
  _room_type_id UUID,
  _location_id UUID,
  _start DATE,
  _end DATE
) RETURNS TABLE (
  dt DATE,
  total_units INT,
  occupied_units INT,
  pickup_7d INT,
  events_weight NUMERIC,
  comp_price_median NUMERIC
)
LANGUAGE sql STABLE AS $$
WITH dates AS (
  SELECT generate_series(_start, _end, interval '1 day')::date dt
),
-- total units (per room_type): prefer room_types.total_units, else count room_units
units AS (
  SELECT COALESCE(NULLIF(rt.total_units,0),
         (SELECT COUNT(*) FROM room_units ru WHERE ru.room_type_id=rt.id AND COALESCE(ru.is_active,true))
        ,0)::int AS total_units
  FROM room_types rt
  WHERE rt.id = _room_type_id
),
-- occupancy (booked units per date)
occ AS (
  SELECT d.dt, COUNT(*)::int AS occupied_units
  FROM dates d
  JOIN reservations r
    ON r.check_in_date <= d.dt
   AND r.check_out_date  > d.dt
   AND r.status IN ('new','confirmed','checked_in','completed','paid','booked')
   AND (r.room_type_id = _room_type_id OR
        EXISTS (SELECT 1 FROM room_units u WHERE u.id=r.room_unit_id AND u.room_type_id=_room_type_id))
  GROUP BY d.dt
),
-- pickup in last 7 days (new bookings created within last 7 days for that stay date)
pickup AS (
  SELECT d.dt, COUNT(*)::int AS pickup_7d
  FROM dates d
  JOIN reservations r
    ON r.check_in_date <= d.dt
   AND r.check_out_date  > d.dt
   AND r.status IN ('new','confirmed','checked_in','completed','paid','booked')
   AND r.created_at >= NOW() - interval '7 days'
   AND (r.room_type_id = _room_type_id OR
        EXISTS (SELECT 1 FROM room_units u WHERE u.id=r.room_unit_id AND u.room_type_id=_room_type_id))
  GROUP BY d.dt
),
-- events weight (multiply holidays & events overlapping)
holiday_w AS (
  SELECT h.dt, EXP(SUM(LN(COALESCE(NULLIF(h.weight,0),1))))::numeric AS w
  FROM holidays h
  WHERE (h.location_id = _location_id OR h.location_id IS NULL)
    AND h.dt BETWEEN _start AND _end
    AND COALESCE(h.is_active,true)
  GROUP BY h.dt
),
event_w AS (
  SELECT d.dt,
         EXP(SUM(LN(COALESCE(NULLIF(e.weight,0),1))))::numeric AS w
  FROM dates d
  JOIN events e
    ON e.start_date <= d.dt AND e.end_date > d.dt
   AND (e.location_id = _location_id OR e.location_id IS NULL)
   AND COALESCE(e.is_active,true)
  GROUP BY d.dt
),
events_all AS (
  SELECT d.dt,
         COALESCE(hw.w,1) * COALESCE(ew.w,1) AS events_weight
  FROM dates d
  LEFT JOIN holiday_w hw ON hw.dt=d.dt
  LEFT JOIN event_w   ew ON ew.dt=d.dt
),
-- competitor median (price-only)
comp_set AS (
  SELECT id FROM comp_sets
  WHERE location_id = _location_id AND COALESCE(is_active,true)
  ORDER BY created_at ASC
  LIMIT 1
),
comp AS (
  SELECT cd.dt, cd.price_median
  FROM comp_set cs
  JOIN comp_daily cd ON cd.comp_set_id = cs.id
  WHERE cd.dt BETWEEN _start AND _end
)
SELECT
  d.dt,
  u.total_units,
  COALESCE(o.occupied_units,0) AS occupied_units,
  COALESCE(p.pickup_7d,0) AS pickup_7d,
  COALESCE(e.events_weight,1.0) AS events_weight,
  c.price_median AS comp_price_median
FROM dates d
CROSS JOIN units u
LEFT JOIN occ o ON o.dt=d.dt
LEFT JOIN pickup p ON p.dt=d.dt
LEFT JOIN events_all e ON e.dt=d.dt
LEFT JOIN comp c ON c.dt=d.dt
ORDER BY d.dt;
$$;

-- Performance indexes for the new function
CREATE INDEX IF NOT EXISTS idx_reservations_room_type_dates ON reservations(room_type_id, check_in_date, check_out_date) WHERE status IN ('new','confirmed','checked_in','completed','paid','booked');
CREATE INDEX IF NOT EXISTS idx_reservations_room_unit_dates ON reservations(room_unit_id, check_in_date, check_out_date) WHERE status IN ('new','confirmed','checked_in','completed','paid','booked');
CREATE INDEX IF NOT EXISTS idx_reservations_created_dates ON reservations(created_at, check_in_date, check_out_date) WHERE status IN ('new','confirmed','checked_in','completed','paid','booked');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Market demand performance optimization completed successfully';
  RAISE NOTICE 'Added market_signals_by_date() RPC function for batch processing';
  RAISE NOTICE 'Added performance indexes for reservation queries';
END
$$;

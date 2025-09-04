-- Fix get_calendar_timeline RPC function to include group booking fields
-- This migration updates the function to return group booking information needed for calendar display

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_calendar_timeline(uuid, date, date);

-- Recreate the function with group booking fields
CREATE OR REPLACE FUNCTION public.get_calendar_timeline(
    p_property_id uuid, 
    p_start_date date DEFAULT (CURRENT_DATE - '1 day'::interval), 
    p_end_date date DEFAULT (CURRENT_DATE + '29 days'::interval)
) RETURNS TABLE(
    room_type_id uuid,
    room_type_name text,
    room_type_order integer,
    room_unit_id uuid,
    room_unit_number text,
    reservation_id uuid,
    segment_id uuid,
    booking_name text,
    start_date date,
    end_date date,
    status text,
    color text,
    label text,
    is_segment boolean,
    -- Group booking fields
    group_room_count integer,
    is_group_master boolean,
    booking_group_master_id text,
    booking_group_ids jsonb
)
LANGUAGE sql STABLE
AS $$
    -- First get ALL room units for the property (including those with no reservations)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        ru.id as room_unit_id,
        ru.unit_number as room_unit_number,
        NULL::uuid as reservation_id,
        NULL::uuid as segment_id,
        NULL::text as booking_name,
        NULL::date as start_date,
        NULL::date as end_date,
        NULL::text as status,
        NULL::text as color,
        NULL::text as label,
        false as is_segment,
        -- Group booking fields (NULL for empty room rows)
        NULL::integer as group_room_count,
        NULL::boolean as is_group_master,
        NULL::text as booking_group_master_id,
        NULL::jsonb as booking_group_ids
    FROM room_types rt
    JOIN room_units ru ON rt.id = ru.room_type_id
    WHERE rt.property_id = p_property_id
    AND rt.is_active = true
    AND ru.is_active = true
    AND NOT EXISTS (
        -- Only include empty room rows if there are no reservations for this room in date range
        SELECT 1 FROM reservations r 
        WHERE r.room_unit_id = ru.id 
        AND r.check_in_date <= p_end_date
        AND r.check_out_date > p_start_date
        AND r.status::text <> 'cancelled'
        AND NOT EXISTS (
            SELECT 1 FROM reservation_segments rs WHERE rs.reservation_id = r.id
        )
        UNION ALL
        SELECT 1 FROM reservation_segments rs
        JOIN reservations r2 ON rs.reservation_id = r2.id
        WHERE rs.room_unit_id = ru.id
        AND rs.start_date <= p_end_date
        AND rs.end_date > p_start_date
        AND r2.status::text <> 'cancelled'
    )
    
    UNION ALL
    
    -- Then get regular reservations (not split into segments)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        ru.id as room_unit_id,
        ru.unit_number as room_unit_number,
        r.id as reservation_id,
        NULL::uuid as segment_id,
        r.booking_name,
        r.check_in_date as start_date,
        r.check_out_date as end_date,
        r.status::text,
        CASE r.status::text
            WHEN 'confirmed' THEN '#3b82f6'
            WHEN 'checked_in' THEN '#10b981'
            WHEN 'checked_out' THEN '#6b7280'
            WHEN 'cancelled' THEN '#ef4444'
            ELSE '#b5945a'
        END as color,
        r.booking_name as label,
        false as is_segment,
        -- Group booking fields from reservations table
        r.group_room_count,
        r.is_group_master,
        r.booking_group_master_id,
        r.booking_group_ids
    FROM reservations r
    JOIN room_units ru ON r.room_unit_id = ru.id
    JOIN room_types rt ON ru.room_type_id = rt.id
    WHERE rt.property_id = p_property_id
    AND r.check_in_date <= p_end_date
    AND r.check_out_date > p_start_date
    AND r.status::text <> 'cancelled'
    AND NOT EXISTS (
        -- Exclude reservations that have been split into segments
        SELECT 1 FROM reservation_segments rs 
        WHERE rs.reservation_id = r.id
    )
    
    UNION ALL
    
    -- Then get reservation segments (for split reservations)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        ru.id as room_unit_id,
        ru.unit_number as room_unit_number,
        r.id as reservation_id,
        rs.id as segment_id,
        r.booking_name,
        rs.start_date,
        rs.end_date,
        r.status::text,
        COALESCE(rs.color, 
            CASE r.status::text
                WHEN 'confirmed' THEN '#3b82f6'
                WHEN 'checked_in' THEN '#10b981'
                WHEN 'checked_out' THEN '#6b7280'
                WHEN 'cancelled' THEN '#ef4444'
                ELSE '#b5945a'
            END
        ) as color,
        COALESCE(rs.label, r.booking_name) as label,
        true as is_segment,
        -- Group booking fields from parent reservation
        r.group_room_count,
        r.is_group_master,
        r.booking_group_master_id,
        r.booking_group_ids
    FROM reservation_segments rs
    JOIN reservations r ON rs.reservation_id = r.id
    JOIN room_units ru ON rs.room_unit_id = ru.id
    JOIN room_types rt ON ru.room_type_id = rt.id
    WHERE rt.property_id = p_property_id
    AND rs.start_date <= p_end_date
    AND rs.end_date > p_start_date
    AND r.status::text <> 'cancelled'
    
    UNION ALL
    
    -- Finally get unassigned reservations (room_unit_id IS NULL)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        NULL::uuid as room_unit_id,
        'UNASSIGNED' as room_unit_number,
        r.id as reservation_id,
        NULL::uuid as segment_id,
        r.booking_name,
        r.check_in_date as start_date,
        r.check_out_date as end_date,
        r.status::text,
        '#f59e0b' as color, -- Orange color for unassigned
        r.booking_name as label,
        false as is_segment,
        -- Group booking fields from reservations table
        r.group_room_count,
        r.is_group_master,
        r.booking_group_master_id,
        r.booking_group_ids
    FROM reservations r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE rt.property_id = p_property_id
    AND r.room_unit_id IS NULL
    AND r.check_in_date <= p_end_date
    AND r.check_out_date > p_start_date
    AND r.status::text <> 'cancelled'
    AND NOT EXISTS (
        -- Exclude reservations that have been split into segments
        SELECT 1 FROM reservation_segments rs 
        WHERE rs.reservation_id = r.id
    )
    
    ORDER BY room_type_name, room_unit_number, start_date;
$$;

-- Add comment to document the fix
COMMENT ON FUNCTION public.get_calendar_timeline(uuid, date, date) IS 'Calendar timeline function with group booking fields support - returns reservation and room data for calendar display';

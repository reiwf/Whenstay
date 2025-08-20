-- Migration: Remove old guest columns from reservations table
-- This script removes the guest-related columns that have been migrated to reservation_guests table
-- IMPORTANT: Only run this AFTER confirming that the migration was successful and all systems are working

-- Safety check: Verify that reservation_guests table exists and has data
DO $safety_check$ 
BEGIN
    -- Check if reservation_guests table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reservation_guests') THEN
        RAISE EXCEPTION 'reservation_guests table does not exist. Migration may not have been completed.';
    END IF;
    
    -- Check if reservation_guests has data
    IF NOT EXISTS (SELECT 1 FROM reservation_guests LIMIT 1) THEN
        RAISE EXCEPTION 'reservation_guests table is empty. Migration may not have been completed.';
    END IF;
    
    -- Check that reservation_guests has same or more records than reservations with guest data
    IF (SELECT COUNT(*) FROM reservation_guests WHERE is_primary_guest = true) <
       (SELECT COUNT(*) FROM reservations WHERE guest_firstname IS NOT NULL OR checkin_submitted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'reservation_guests table has fewer primary guest records than expected. Migration may be incomplete.';
    END IF;
    
    RAISE NOTICE 'Safety checks passed. Proceeding with column removal...';
END $safety_check$;

-- Step 1: Drop any triggers or functions that reference the old columns
-- (We may need to recreate some of these after column removal)

-- Drop triggers that might reference old guest columns
DROP TRIGGER IF EXISTS reservation_pricing_trigger ON public.reservations;

-- Step 2: Remove the old guest-related columns from reservations table
ALTER TABLE public.reservations 
    DROP COLUMN IF EXISTS guest_firstname,
    DROP COLUMN IF EXISTS guest_lastname,
    DROP COLUMN IF EXISTS guest_contact,
    DROP COLUMN IF EXISTS guest_mail,
    DROP COLUMN IF EXISTS passport_url,
    DROP COLUMN IF EXISTS guest_address,
    DROP COLUMN IF EXISTS estimated_checkin_time,
    DROP COLUMN IF EXISTS travel_purpose,
    DROP COLUMN IF EXISTS emergency_contact_name,
    DROP COLUMN IF EXISTS emergency_contact_phone,
    DROP COLUMN IF EXISTS agreement_accepted,
    DROP COLUMN IF EXISTS checkin_submitted_at,
    DROP COLUMN IF EXISTS admin_verified,
    DROP COLUMN IF EXISTS verified_at,
    DROP COLUMN IF EXISTS verified_by;

-- Step 3: Recreate the pricing trigger (if it was dropped)
CREATE TRIGGER reservation_pricing_trigger 
    AFTER INSERT OR DELETE OR UPDATE ON public.reservations 
    FOR EACH ROW 
    EXECUTE FUNCTION public.trigger_pricing_recalculation();

-- Step 4: Update any database functions that might still reference old columns
-- Note: Most functions should already be updated to use reservation_guests table

-- Update the reservations_details view to ensure it's using the new structure
-- (This should already be done, but we'll refresh it to be safe)
DROP VIEW IF EXISTS public.reservations_details;
CREATE VIEW public.reservations_details AS
 SELECT 
    -- Core reservation data
    r.id,
    r.beds24_booking_id,
    r.property_id,
    r.room_type_id,
    r.room_unit_id,
    r.booking_name,
    r.booking_email,
    r.booking_phone,
    r.check_in_date,
    r.check_out_date,
    r.num_guests,
    r.total_amount,
    r.currency,
    r.status,
    r.booking_source,
    r.num_adults,
    r.num_children,
    r.special_requests,
    r.check_in_token,
    r.created_at,
    r.updated_at,
    r."apiReference",
    r.booking_lastname,
    r."rateDescription",
    r.commission,
    r."apiMessage",
    r."bookingTime",
    r.comments,
    r.price,
    r."timeStamp",
    r.lang,
    r.access_read,
    
    -- Primary guest data (guest #1) - for backward compatibility
    pg.guest_firstname,
    pg.guest_lastname,
    pg.guest_contact,
    pg.guest_mail,
    pg.passport_url,
    pg.guest_address,
    pg.estimated_checkin_time,
    pg.travel_purpose,
    pg.emergency_contact_name,
    pg.emergency_contact_phone,
    pg.agreement_accepted,
    pg.checkin_submitted_at,
    pg.admin_verified,
    pg.verified_at,
    pg.verified_by,
    
    -- Multi-guest check-in completion status
    CASE 
        WHEN r.num_guests <= 1 THEN 
            CASE WHEN pg.checkin_submitted_at IS NOT NULL THEN true ELSE false END
        ELSE
            (SELECT COUNT(*) FROM reservation_guests rg_check 
             WHERE rg_check.reservation_id = r.id 
             AND rg_check.checkin_submitted_at IS NOT NULL) = COALESCE(r.num_guests, 1)
    END AS all_guests_checked_in,
    
    -- Count of completed guest check-ins
    (SELECT COUNT(*) FROM reservation_guests rg_count 
     WHERE rg_count.reservation_id = r.id 
     AND rg_count.checkin_submitted_at IS NOT NULL) AS completed_guest_checkins,
    
    -- Property information
    p.name AS property_name,
    p.address AS property_address,
    p.owner_id AS property_owner_id,
    p.description,
    p.property_type,
    p.wifi_name AS property_wifi_name,
    p.wifi_password AS property_wifi_password,
    p.house_rules,
    p.check_in_instructions,
    p.emergency_contact AS property_emergency_contact,
    p.property_amenities,
    p.location_info,
    p.is_active AS property_is_active,
    p.created_at AS property_created_at,
    p.updated_at AS property_updated_at,
    p.access_time,
    p.default_cleaner_id,
    p.beds24_property_id,
    
    -- Room type information
    rt.name AS room_type_name,
    rt.description AS room_type_description,
    rt.max_guests AS room_type_max_guests,
    rt.base_price,
    rt.currency AS room_type_currency,
    rt.room_amenities AS room_type_amenities,
    rt.bed_configuration,
    rt.room_size_sqm,
    rt.has_balcony AS room_type_has_balcony,
    rt.has_kitchen AS room_type_has_kitchen,
    rt.is_accessible AS room_type_is_accessible,
    rt.is_active AS room_type_is_active,
    rt.created_at AS room_type_created_at,
    rt.updated_at AS room_type_updated_at,
    rt.beds24_roomtype_id,
    
    -- Room unit information
    ru.unit_number,
    ru.floor_number,
    ru.access_code,
    ru.access_instructions,
    ru.wifi_name AS unit_wifi_name,
    ru.wifi_password AS unit_wifi_password,
    ru.unit_amenities,
    ru.maintenance_notes,
    ru.is_active AS unit_is_active,
    ru.created_at AS unit_created_at,
    ru.updated_at AS unit_updated_at,
    ru.beds24_unit_id,
    
    -- User who verified (for primary guest)
    up.first_name AS verified_by_name,
    up.last_name AS verified_by_lastname
 FROM 
    public.reservations r
    -- Join with primary guest (guest #1) for backward compatibility
    LEFT JOIN public.reservation_guests pg ON (r.id = pg.reservation_id AND pg.guest_number = 1)
    LEFT JOIN public.properties p ON (r.property_id = p.id)
    LEFT JOIN public.room_types rt ON (r.room_type_id = rt.id)
    LEFT JOIN public.room_units ru ON (r.room_unit_id = ru.id)
    LEFT JOIN public.user_profiles up ON (pg.verified_by = up.id);

-- Add comment for documentation
COMMENT ON VIEW public.reservations_details IS 'Comprehensive view of reservations with property, room, and primary guest information. Updated to use reservation_guests table.';

-- Step 5: Clean up any old indexes that referenced guest columns
-- (Most indexes should be automatically dropped when columns are dropped)

-- Step 6: Verify the cleanup was successful
DO $verification$ 
DECLARE
    old_columns_count INTEGER;
BEGIN
    -- Check that old guest columns no longer exist
    SELECT COUNT(*) INTO old_columns_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reservations'
    AND column_name IN (
        'guest_firstname', 'guest_lastname', 'guest_contact', 'guest_mail',
        'passport_url', 'guest_address', 'estimated_checkin_time', 'travel_purpose',
        'emergency_contact_name', 'emergency_contact_phone', 'agreement_accepted',
        'checkin_submitted_at', 'admin_verified', 'verified_at', 'verified_by'
    );
    
    IF old_columns_count > 0 THEN
        RAISE EXCEPTION 'Some old guest columns still exist in reservations table. Cleanup may have failed.';
    END IF;
    
    -- Verify that reservation_guests table still works
    IF NOT EXISTS (SELECT 1 FROM reservation_guests LIMIT 1) THEN
        RAISE EXCEPTION 'reservation_guests table appears to be empty after cleanup. Something went wrong.';
    END IF;
    
    -- Verify that the view still works
    IF NOT EXISTS (SELECT 1 FROM reservations_details LIMIT 1) THEN
        RAISE EXCEPTION 'reservations_details view is not working after cleanup. Something went wrong.';
    END IF;
    
    RAISE NOTICE 'Column cleanup completed successfully!';
    RAISE NOTICE 'Old guest columns have been removed from reservations table.';
    RAISE NOTICE 'Guest data is now stored in reservation_guests table.';
    RAISE NOTICE 'Views and functions have been updated to use the new structure.';
END $verification$;

-- Final status report
SELECT 
    'Migration Complete' as status,
    COUNT(DISTINCT r.id) as total_reservations,
    COUNT(DISTINCT rg.reservation_id) as reservations_with_guests,
    COUNT(rg.id) as total_guest_records,
    COUNT(CASE WHEN rg.is_primary_guest THEN 1 END) as primary_guests,
    COUNT(CASE WHEN rg.guest_number > 1 THEN 1 END) as additional_guests
FROM reservations r
LEFT JOIN reservation_guests rg ON r.id = rg.reservation_id;

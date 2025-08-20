-- Migration: Migrate existing guest data from reservations to reservation_guests
-- This script safely migrates guest data while handling multi-guest scenarios

-- Step 1: Create a function to migrate guest data for a single reservation
CREATE OR REPLACE FUNCTION migrate_reservation_guest_data()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    reservation_record RECORD;
    guest_count integer;
    i integer;
BEGIN
    -- Loop through all reservations that have guest data
    FOR reservation_record IN 
        SELECT 
            id,
            num_guests,
            guest_firstname,
            guest_lastname,
            guest_contact,
            guest_mail,
            passport_url,
            guest_address,
            estimated_checkin_time,
            travel_purpose,
            emergency_contact_name,
            emergency_contact_phone,
            agreement_accepted,
            checkin_submitted_at,
            admin_verified,
            verified_at,
            verified_by,
            created_at
        FROM reservations
        WHERE id IS NOT NULL -- All reservations
    LOOP
        -- Get the number of guests for this reservation (default to 1 if null)
        guest_count := COALESCE(reservation_record.num_guests, 1);
        
        -- Ensure guest_count is at least 1
        IF guest_count < 1 THEN
            guest_count := 1;
        END IF;
        
        -- Create guest records for this reservation
        FOR i IN 1..guest_count LOOP
            -- Insert guest record
            INSERT INTO reservation_guests (
                reservation_id,
                guest_number,
                is_primary_guest,
                guest_firstname,
                guest_lastname,
                guest_contact,
                guest_mail,
                passport_url,
                guest_address,
                estimated_checkin_time,
                travel_purpose,
                emergency_contact_name,
                emergency_contact_phone,
                agreement_accepted,
                checkin_submitted_at,
                admin_verified,
                verified_at,
                verified_by,
                created_at
            ) VALUES (
                reservation_record.id,
                i,
                (i = 1), -- is_primary_guest is true only for guest #1
                -- For guest #1, use existing data; for others, use placeholders
                CASE 
                    WHEN i = 1 THEN reservation_record.guest_firstname 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.guest_lastname 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.guest_contact 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.guest_mail 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.passport_url 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.guest_address 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.estimated_checkin_time 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.travel_purpose 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.emergency_contact_name 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.emergency_contact_phone 
                    ELSE NULL 
                END,
                -- Check-in process fields - only for guest #1 initially
                CASE 
                    WHEN i = 1 THEN COALESCE(reservation_record.agreement_accepted, false) 
                    ELSE false 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.checkin_submitted_at 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN COALESCE(reservation_record.admin_verified, false) 
                    ELSE false 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.verified_at 
                    ELSE NULL 
                END,
                CASE 
                    WHEN i = 1 THEN reservation_record.verified_by 
                    ELSE NULL 
                END,
                reservation_record.created_at
            );
        END LOOP;
        
        -- Log progress every 100 reservations
        IF reservation_record.id::text ~ '00$' THEN
            RAISE NOTICE 'Migrated reservation % with % guests', reservation_record.id, guest_count;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Guest data migration completed successfully';
END;
$$;

-- Step 2: Execute the migration
DO $migration$ 
BEGIN
    RAISE NOTICE 'Starting guest data migration...';
    
    -- Check if reservation_guests table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reservation_guests') THEN
        RAISE EXCEPTION 'reservation_guests table does not exist. Please run create_reservation_guests_table.sql first.';
    END IF;
    
    -- Check if there's already data in reservation_guests
    IF EXISTS (SELECT 1 FROM reservation_guests LIMIT 1) THEN
        RAISE EXCEPTION 'reservation_guests table already contains data. Migration may have already been run.';
    END IF;
    
    -- Run the migration
    PERFORM migrate_reservation_guest_data();
    
    -- Get migration statistics
    RAISE NOTICE 'Migration Statistics:';
    RAISE NOTICE '- Total reservations processed: %', (SELECT COUNT(*) FROM reservations);
    RAISE NOTICE '- Total guest records created: %', (SELECT COUNT(*) FROM reservation_guests);
    RAISE NOTICE '- Primary guest records: %', (SELECT COUNT(*) FROM reservation_guests WHERE is_primary_guest = true);
    RAISE NOTICE '- Additional guest records (placeholders): %', (SELECT COUNT(*) FROM reservation_guests WHERE is_primary_guest = false);
    RAISE NOTICE '- Multi-guest reservations: %', (SELECT COUNT(DISTINCT reservation_id) FROM reservation_guests WHERE reservation_id IN (SELECT reservation_id FROM reservation_guests GROUP BY reservation_id HAVING COUNT(*) > 1));
    
END $migration$;

-- Step 3: Clean up the migration function
DROP FUNCTION IF EXISTS migrate_reservation_guest_data();

-- Step 4: Verification queries (commented out, uncomment to run verification)
/*
-- Verify migration results
SELECT 
    'Total reservations' as metric,
    COUNT(*) as count
FROM reservations
UNION ALL
SELECT 
    'Total guest records',
    COUNT(*)
FROM reservation_guests
UNION ALL
SELECT 
    'Primary guests',
    COUNT(*)
FROM reservation_guests 
WHERE is_primary_guest = true
UNION ALL
SELECT 
    'Placeholder guests',
    COUNT(*)
FROM reservation_guests 
WHERE is_primary_guest = false
UNION ALL
SELECT 
    'Multi-guest reservations',
    COUNT(DISTINCT reservation_id)
FROM reservation_guests 
WHERE reservation_id IN (
    SELECT reservation_id 
    FROM reservation_guests 
    GROUP BY reservation_id 
    HAVING COUNT(*) > 1
);

-- Check for any reservations missing guest records
SELECT r.id, r.beds24_booking_id, r.booking_name, r.num_guests
FROM reservations r
LEFT JOIN reservation_guests rg ON r.id = rg.reservation_id
WHERE rg.reservation_id IS NULL;

-- Sample of migrated data
SELECT 
    r.beds24_booking_id,
    r.booking_name,
    r.num_guests,
    rg.guest_number,
    rg.is_primary_guest,
    rg.guest_firstname,
    rg.guest_lastname
FROM reservations r
JOIN reservation_guests rg ON r.id = rg.reservation_id
ORDER BY r.created_at DESC, rg.guest_number
LIMIT 10;
*/

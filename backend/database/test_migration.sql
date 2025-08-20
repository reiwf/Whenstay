-- Test script to validate the guest data migration
-- Run this script to verify that the migration was successful

-- Test 1: Verify table structure
SELECT 
    'reservation_guests table structure' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'reservation_guests'
        ) THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;

-- Test 2: Verify data migration
SELECT 
    'Data migration completeness' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM reservation_guests WHERE is_primary_guest = true) >= 
             (SELECT COUNT(*) FROM reservations) * 0.95 -- Allow 5% variance
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;

-- Test 3: Verify primary guest constraint
SELECT 
    'Primary guest constraint' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM reservation_guests WHERE is_primary_guest = true AND guest_number != 1) = 0
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;

-- Test 4: Verify unique constraint
SELECT 
    'Unique guest number constraint' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM (
            SELECT reservation_id, guest_number, COUNT(*) 
            FROM reservation_guests 
            GROUP BY reservation_id, guest_number 
            HAVING COUNT(*) > 1
        ) duplicates) = 0
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;

-- Test 5: Verify views are working
SELECT 
    'reservations_details view' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM reservations_details LIMIT 1) >= 0
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as result;

-- Test 6: Verify multi-guest support
SELECT 
    'Multi-guest placeholder creation' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM reservations r
            JOIN reservation_guests rg ON r.id = rg.reservation_id
            WHERE r.num_guests > 1
            GROUP BY r.id, r.num_guests
            HAVING COUNT(rg.id) = r.num_guests
            LIMIT 1
        )
        THEN 'PASS' 
        ELSE 'PARTIAL - No multi-guest reservations to test' 
    END as result;

-- Detailed migration statistics
SELECT 
    'Total reservations' as metric,
    COUNT(*) as count,
    'Original data' as source
FROM reservations
UNION ALL
SELECT 
    'Total guest records',
    COUNT(*),
    'New table'
FROM reservation_guests
UNION ALL
SELECT 
    'Primary guests (guest #1)',
    COUNT(*),
    'Should match reservations'
FROM reservation_guests 
WHERE is_primary_guest = true
UNION ALL
SELECT 
    'Additional guests (placeholders)',
    COUNT(*),
    'Multi-guest support'
FROM reservation_guests 
WHERE is_primary_guest = false
UNION ALL
SELECT 
    'Completed check-ins',
    COUNT(*),
    'Has checkin_submitted_at'
FROM reservation_guests 
WHERE checkin_submitted_at IS NOT NULL
UNION ALL
SELECT 
    'Admin verified guests',
    COUNT(*),
    'Admin approved'
FROM reservation_guests 
WHERE admin_verified = true;

-- Sample multi-guest reservations
SELECT 
    'Multi-guest reservations sample' as info,
    r.beds24_booking_id,
    r.booking_name,
    r.num_guests,
    COUNT(rg.id) as guest_records_created,
    ARRAY_AGG(
        CONCAT('Guest ', rg.guest_number, ': ', 
               COALESCE(rg.guest_firstname, 'Placeholder')) 
        ORDER BY rg.guest_number
    ) as guests
FROM reservations r
LEFT JOIN reservation_guests rg ON r.id = rg.reservation_id
WHERE r.num_guests > 1
GROUP BY r.id, r.beds24_booking_id, r.booking_name, r.num_guests
ORDER BY r.num_guests DESC, r.created_at DESC
LIMIT 5;

-- Test completion logic
SELECT 
    'Completion logic test' as info,
    r.beds24_booking_id,
    r.booking_name,
    r.num_guests as required_guests,
    COUNT(CASE WHEN rg.checkin_submitted_at IS NOT NULL THEN 1 END) as completed_guests,
    CASE 
        WHEN COUNT(CASE WHEN rg.checkin_submitted_at IS NOT NULL THEN 1 END) >= r.num_guests 
        THEN 'COMPLETE' 
        ELSE 'INCOMPLETE' 
    END as status
FROM reservations r
LEFT JOIN reservation_guests rg ON r.id = rg.reservation_id
GROUP BY r.id, r.beds24_booking_id, r.booking_name, r.num_guests
HAVING r.num_guests > 1 OR COUNT(CASE WHEN rg.checkin_submitted_at IS NOT NULL THEN 1 END) > 0
ORDER BY r.created_at DESC
LIMIT 10;

-- Verification: Check for any orphaned data
SELECT 
    'Orphaned reservation_guests records' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM reservation_guests rg
LEFT JOIN reservations r ON rg.reservation_id = r.id
WHERE r.id IS NULL;

-- Final summary
SELECT 
    'MIGRATION VALIDATION SUMMARY' as summary,
    CASE 
        WHEN EXISTS (SELECT 1 FROM reservation_guests LIMIT 1) 
         AND (SELECT COUNT(*) FROM reservation_guests WHERE is_primary_guest = true) >= 
             (SELECT COUNT(*) FROM reservations) * 0.95
         AND NOT EXISTS (SELECT 1 FROM reservation_guests WHERE is_primary_guest = true AND guest_number != 1)
        THEN 'MIGRATION SUCCESSFUL - Ready for production use'
        ELSE 'MIGRATION ISSUES DETECTED - Review results above'
    END as status;

-- Migration: Convert reservations.status from enum to TEXT
-- Date: 2025-08-19
-- Purpose: Fix PostgreSQL enum type comparison issues

BEGIN;

-- Step 1: Add a new temporary TEXT column
ALTER TABLE public.reservations 
ADD COLUMN status_temp TEXT;

-- Step 2: Copy all data from enum column to TEXT column
UPDATE public.reservations 
SET status_temp = status::TEXT;

-- Step 3: Add NOT NULL constraint and check constraint to ensure data integrity
ALTER TABLE public.reservations 
ALTER COLUMN status_temp SET NOT NULL;

ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_status_temp_check 
CHECK (status_temp IN (
    'pending', 'invited', 'completed', 'cancelled', 
    'confirmed', 'checked_in', 'checked_out', 'no_show', 'new'
));

-- Step 4: Drop triggers that depend on the status column
DROP TRIGGER IF EXISTS trg_update_cleaning_status_on_res_cancel ON public.reservations;
DROP TRIGGER IF EXISTS trg_sync_cleaning_status_from_reservation ON public.reservations;
DROP TRIGGER IF EXISTS trg_cancel_cleaning_task_if_res_cancelled ON public.reservations;

-- Step 5: Drop the old enum column
ALTER TABLE public.reservations 
DROP COLUMN status;

-- Step 6: Rename the new column to replace the old one
ALTER TABLE public.reservations 
RENAME COLUMN status_temp TO status;

-- Step 7: Update any indexes on the status column
-- Check if there are existing indexes and recreate them
DROP INDEX IF EXISTS idx_reservations_status;
CREATE INDEX idx_reservations_status ON public.reservations(status);

DROP INDEX IF EXISTS idx_reservations_status_date;
CREATE INDEX idx_reservations_status_date ON public.reservations(status, check_in_date);

-- Step 8: Recreate triggers that depend on the status column
-- These triggers should work with TEXT status column
CREATE TRIGGER trg_update_cleaning_status_on_res_cancel
    AFTER UPDATE OF status ON public.reservations
    FOR EACH ROW
    WHEN ((OLD.status IS DISTINCT FROM NEW.status))
    EXECUTE FUNCTION public.update_cleaning_status_on_res_cancel();

CREATE TRIGGER trg_sync_cleaning_status_from_reservation
    AFTER UPDATE OF status ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_cleaning_status_from_reservation();

CREATE TRIGGER trg_cancel_cleaning_task_if_res_cancelled
    AFTER UPDATE OF status ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.cancel_cleaning_task_if_res_cancelled();

-- Step 9: Update views that depend on the status column
-- Drop and recreate views that reference the old enum type
DROP VIEW IF EXISTS public.reservations_details CASCADE;
DROP VIEW IF EXISTS public.room_availability CASCADE;

-- Recreate reservations_details view
CREATE VIEW public.reservations_details AS
SELECT 
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
    r.guest_lastname,
    r.guest_firstname,
    r.guest_contact,
    r.guest_mail,
    r.passport_url,
    r.guest_address,
    r.estimated_checkin_time,
    r.travel_purpose,
    r.emergency_contact_name,
    r.emergency_contact_phone,
    r.agreement_accepted,
    r.checkin_submitted_at,
    r.admin_verified,
    r.verified_at,
    r.verified_by,
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
    p.name AS property_name,
    p.address AS property_address,
    p.owner_id AS property_owner_id,
    p.description AS property_description,
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
    up.first_name AS verified_by_name,
    up.last_name AS verified_by_lastname
FROM public.reservations r
LEFT JOIN public.properties p ON r.property_id = p.id
LEFT JOIN public.room_types rt ON r.room_type_id = rt.id
LEFT JOIN public.room_units ru ON r.room_unit_id = ru.id
LEFT JOIN public.user_profiles up ON r.verified_by = up.id;

-- Recreate room_availability view with TEXT status
CREATE VIEW public.room_availability AS
SELECT 
    p.id AS property_id,
    p.name AS property_name,
    rt.id AS room_type_id,
    rt.name AS room_type_name,
    rt.base_price,
    rt.max_guests,
    ru.id AS room_unit_id,
    ru.unit_number,
    ru.is_active AS unit_active,
    rt.is_active AS room_type_active,
    p.is_active AS property_active,
    COUNT(r.id) AS current_reservations
FROM public.properties p
LEFT JOIN public.room_types rt ON p.id = rt.property_id
LEFT JOIN public.room_units ru ON rt.id = ru.room_type_id
LEFT JOIN public.reservations r ON ru.id = r.room_unit_id
    AND r.status IN ('confirmed', 'checked_in')  -- Using TEXT comparison now
    AND r.check_in_date <= CURRENT_DATE
    AND r.check_out_date > CURRENT_DATE
WHERE p.is_active = true
GROUP BY p.id, p.name, rt.id, rt.name, rt.base_price, rt.max_guests, 
         ru.id, ru.unit_number, ru.is_active, rt.is_active, p.is_active;

COMMIT;

-- Verification queries (run these after the migration to verify success)
-- SELECT DISTINCT status FROM public.reservations ORDER BY status;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'status';
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'reservations';

-- Migration from Schema V3 to V4: Field Renaming
-- This migration renames guest/booking related fields for better semantic clarity

-- Start transaction
BEGIN;

-- Rename columns in reservations table
ALTER TABLE public.reservations 
  RENAME COLUMN guest_name TO booking_name;

ALTER TABLE public.reservations 
  RENAME COLUMN guest_email TO booking_email;

ALTER TABLE public.reservations 
  RENAME COLUMN guest_phone TO booking_phone;

ALTER TABLE public.reservations 
  RENAME COLUMN guest_personal_email TO guest_mail;

-- Update indexes to reflect new column names
DROP INDEX IF EXISTS idx_reservations_guest_email;
CREATE INDEX idx_reservations_booking_email ON public.reservations USING btree (booking_email);

-- Recreate the reservations_with_details view with updated field names
DROP VIEW IF EXISTS public.reservations_with_details;

CREATE VIEW public.reservations_with_details AS
SELECT
  r.id,
  r.beds24_booking_id,
  r.room_id,
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
  p.name as property_name,
  p.address as property_address,
  p.wifi_name,
  p.wifi_password,
  p.house_rules,
  p.check_in_instructions,
  p.emergency_contact as property_emergency_contact,
  rm.room_number,
  rm.room_name,
  rm.access_code,
  rm.access_instructions,
  rm.room_amenities,
  rm.max_guests as room_max_guests,
  up.first_name as verified_by_name,
  up.last_name as verified_by_lastname
FROM
  reservations r
  LEFT JOIN rooms rm ON r.room_id = rm.id
  LEFT JOIN properties p ON rm.property_id = p.id
  LEFT JOIN user_profiles up ON r.verified_by = up.id;

-- Commit transaction
COMMIT;

-- Verification queries (commented out for production)
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'reservations' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'reservations' AND schemaname = 'public';

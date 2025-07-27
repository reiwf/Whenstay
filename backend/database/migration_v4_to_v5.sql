-- Migration from Schema V4 to V5: Property/Room Type/Room Unit Restructure
-- This migration implements the new hierarchy: properties → room_types → room_units

BEGIN;

-- Step 1: Rename total_rooms to rooms in properties table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'properties' AND column_name = 'total_rooms') THEN
        ALTER TABLE properties RENAME COLUMN total_rooms TO rooms;
    END IF;
END $$;

-- Step 2: Create room_types table
CREATE TABLE IF NOT EXISTS public.room_types (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid not null,
  name character varying(255) not null,
  description text null,
  max_guests integer not null default 2,
  base_price numeric(10,2) null,
  currency character varying(3) null default 'USD'::character varying,
  room_amenities jsonb null,
  bed_configuration character varying(255) null,
  room_size_sqm integer null,
  has_balcony boolean null default false,
  has_kitchen boolean null default false,
  is_accessible boolean null default false,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint room_types_pkey primary key (id),
  constraint room_types_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE,
  constraint room_types_property_name_unique unique (property_id, name)
);

-- Step 3: Create room_units table (this will replace the rooms table)
CREATE TABLE IF NOT EXISTS public.room_units (
  id uuid not null default extensions.uuid_generate_v4 (),
  room_type_id uuid not null,
  unit_number character varying(50) not null,
  floor_number integer null,
  access_code character varying(50) null,
  access_instructions text null,
  wifi_name character varying(255) null,
  wifi_password character varying(255) null,
  unit_amenities jsonb null,
  maintenance_notes text null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint room_units_pkey primary key (id),
  constraint room_units_room_type_id_fkey foreign KEY (room_type_id) references room_types (id) on delete CASCADE,
  constraint room_units_type_unit_unique unique (room_type_id, unit_number)
);

-- Step 4: Add new foreign key columns to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS property_id uuid,
ADD COLUMN IF NOT EXISTS room_type_id uuid,
ADD COLUMN IF NOT EXISTS room_unit_id uuid;

-- Step 5: Add new foreign key columns to property_images table
ALTER TABLE property_images 
ADD COLUMN IF NOT EXISTS room_type_id uuid,
ADD COLUMN IF NOT EXISTS room_unit_id uuid;

-- Step 6: Add foreign key constraints for new columns
DO $$ 
BEGIN
    -- Add foreign key constraints if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'reservations_property_id_fkey') THEN
        ALTER TABLE reservations 
        ADD CONSTRAINT reservations_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'reservations_room_type_id_fkey') THEN
        ALTER TABLE reservations 
        ADD CONSTRAINT reservations_room_type_id_fkey 
        FOREIGN KEY (room_type_id) REFERENCES room_types (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'reservations_room_unit_id_fkey') THEN
        ALTER TABLE reservations 
        ADD CONSTRAINT reservations_room_unit_id_fkey 
        FOREIGN KEY (room_unit_id) REFERENCES room_units (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'property_images_room_type_id_fkey') THEN
        ALTER TABLE property_images 
        ADD CONSTRAINT property_images_room_type_id_fkey 
        FOREIGN KEY (room_type_id) REFERENCES room_types (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'property_images_room_unit_id_fkey') THEN
        ALTER TABLE property_images 
        ADD CONSTRAINT property_images_room_unit_id_fkey 
        FOREIGN KEY (room_unit_id) REFERENCES room_units (id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 7: Create indexes for new tables and columns
CREATE INDEX IF NOT EXISTS idx_room_types_property_id ON public.room_types USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_room_types_active ON public.room_types USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_room_types_name ON public.room_types USING btree (name);

CREATE INDEX IF NOT EXISTS idx_room_units_room_type_id ON public.room_units USING btree (room_type_id);
CREATE INDEX IF NOT EXISTS idx_room_units_active ON public.room_units USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_room_units_unit_number ON public.room_units USING btree (unit_number);
CREATE INDEX IF NOT EXISTS idx_room_units_floor ON public.room_units USING btree (floor_number);

CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON public.reservations USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_type_id ON public.reservations USING btree (room_type_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_unit_id ON public.reservations USING btree (room_unit_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property_date ON public.reservations USING btree (property_id, check_in_date);

CREATE INDEX IF NOT EXISTS idx_property_images_room_type_id ON public.property_images USING btree (room_type_id);
CREATE INDEX IF NOT EXISTS idx_property_images_room_unit_id ON public.property_images USING btree (room_unit_id);

-- Step 8: Create triggers for new tables
CREATE TRIGGER IF NOT EXISTS update_room_types_updated_at 
  BEFORE UPDATE ON room_types 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_room_units_updated_at 
  BEFORE UPDATE ON room_units 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Data Migration (Manual Process)
-- Note: This migration requires manual setup of room types and room units
-- The following are example queries that can be used as templates:

/*
-- Example: Create room types based on existing room data
-- This should be customized based on your specific needs

INSERT INTO room_types (property_id, name, description, max_guests, base_price, room_amenities, bed_configuration, room_size_sqm, has_balcony, has_kitchen, is_accessible)
SELECT DISTINCT 
    r.property_id,
    COALESCE(r.room_type, 'Standard Room') as name,
    'Migrated from existing room data' as description,
    r.max_guests,
    100.00 as base_price, -- Set appropriate base price
    r.room_amenities,
    r.bed_configuration,
    r.room_size_sqm,
    r.has_balcony,
    r.has_kitchen,
    r.is_accessible
FROM rooms r
WHERE r.property_id IS NOT NULL
GROUP BY r.property_id, r.room_type, r.max_guests, r.room_amenities, r.bed_configuration, r.room_size_sqm, r.has_balcony, r.has_kitchen, r.is_accessible;

-- Example: Migrate existing rooms to room_units
-- This links existing rooms to the newly created room types

INSERT INTO room_units (room_type_id, unit_number, floor_number, access_code, access_instructions, wifi_name, wifi_password, unit_amenities)
SELECT 
    rt.id as room_type_id,
    r.room_number as unit_number,
    r.floor_number,
    r.access_code,
    r.access_instructions,
    r.wifi_name,
    r.wifi_password,
    r.room_amenities as unit_amenities
FROM rooms r
JOIN room_types rt ON rt.property_id = r.property_id 
    AND rt.name = COALESCE(r.room_type, 'Standard Room')
WHERE r.property_id IS NOT NULL;

-- Example: Update reservations to link to new structure
-- This populates the new foreign key columns in reservations

UPDATE reservations 
SET 
    property_id = (SELECT property_id FROM rooms WHERE rooms.id = reservations.room_id),
    room_type_id = (
        SELECT rt.id 
        FROM rooms r 
        JOIN room_types rt ON rt.property_id = r.property_id 
            AND rt.name = COALESCE(r.room_type, 'Standard Room')
        WHERE r.id = reservations.room_id
    ),
    room_unit_id = (
        SELECT ru.id 
        FROM rooms r 
        JOIN room_types rt ON rt.property_id = r.property_id 
            AND rt.name = COALESCE(r.room_type, 'Standard Room')
        JOIN room_units ru ON ru.room_type_id = rt.id 
            AND ru.unit_number = r.room_number
        WHERE r.id = reservations.room_id
    )
WHERE room_id IS NOT NULL;

-- Example: Update property_images to link to new structure
-- This populates the new foreign key columns in property_images

UPDATE property_images 
SET 
    room_type_id = (
        SELECT rt.id 
        FROM rooms r 
        JOIN room_types rt ON rt.property_id = r.property_id 
            AND rt.name = COALESCE(r.room_type, 'Standard Room')
        WHERE r.id = property_images.room_id
    ),
    room_unit_id = (
        SELECT ru.id 
        FROM rooms r 
        JOIN room_types rt ON rt.property_id = r.property_id 
            AND rt.name = COALESCE(r.room_type, 'Standard Room')
        JOIN room_units ru ON ru.room_type_id = rt.id 
            AND ru.unit_number = r.room_number
        WHERE r.id = property_images.room_id
    )
WHERE room_id IS NOT NULL;
*/

-- Step 10: Create/Update Views
CREATE OR REPLACE VIEW public.reservations_with_full_details AS
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
  -- Property details
  p.name as property_name,
  p.address as property_address,
  p.wifi_name as property_wifi_name,
  p.wifi_password as property_wifi_password,
  p.house_rules,
  p.check_in_instructions,
  p.emergency_contact as property_emergency_contact,
  p.property_amenities,
  p.location_info,
  -- Room type details
  rt.name as room_type_name,
  rt.description as room_type_description,
  rt.max_guests as room_type_max_guests,
  rt.base_price,
  rt.room_amenities as room_type_amenities,
  rt.bed_configuration,
  rt.room_size_sqm,
  rt.has_balcony as room_type_has_balcony,
  rt.has_kitchen as room_type_has_kitchen,
  rt.is_accessible as room_type_is_accessible,
  -- Room unit details
  ru.unit_number,
  ru.floor_number,
  ru.access_code,
  ru.access_instructions,
  ru.wifi_name as unit_wifi_name,
  ru.wifi_password as unit_wifi_password,
  ru.unit_amenities,
  ru.maintenance_notes,
  -- Verified by details
  up.first_name as verified_by_name,
  up.last_name as verified_by_lastname
FROM reservations r
LEFT JOIN properties p ON r.property_id = p.id
LEFT JOIN room_types rt ON r.room_type_id = rt.id
LEFT JOIN room_units ru ON r.room_unit_id = ru.id
LEFT JOIN user_profiles up ON r.verified_by = up.id;

-- Create new utility views
CREATE OR REPLACE VIEW public.room_availability AS
SELECT 
  p.id as property_id,
  p.name as property_name,
  rt.id as room_type_id,
  rt.name as room_type_name,
  rt.base_price,
  rt.max_guests,
  ru.id as room_unit_id,
  ru.unit_number,
  ru.is_active as unit_active,
  rt.is_active as room_type_active,
  p.is_active as property_active,
  COUNT(r.id) as current_reservations
FROM properties p
LEFT JOIN room_types rt ON p.id = rt.property_id
LEFT JOIN room_units ru ON rt.id = ru.room_type_id
LEFT JOIN reservations r ON ru.id = r.room_unit_id 
  AND r.status IN ('confirmed', 'checked_in')
  AND r.check_in_date <= CURRENT_DATE 
  AND r.check_out_date > CURRENT_DATE
WHERE p.is_active = true
GROUP BY p.id, p.name, rt.id, rt.name, rt.base_price, rt.max_guests, 
         ru.id, ru.unit_number, ru.is_active, rt.is_active, p.is_active;

CREATE OR REPLACE VIEW public.property_summary AS
SELECT 
  p.id,
  p.name,
  p.address,
  p.property_type,
  p.is_active,
  COUNT(DISTINCT rt.id) as total_room_types,
  COUNT(DISTINCT ru.id) as total_room_units,
  COUNT(DISTINCT CASE WHEN ru.is_active = true THEN ru.id END) as active_room_units,
  MIN(rt.base_price) as min_price,
  MAX(rt.base_price) as max_price,
  SUM(rt.max_guests) as total_capacity
FROM properties p
LEFT JOIN room_types rt ON p.id = rt.property_id AND rt.is_active = true
LEFT JOIN room_units ru ON rt.id = ru.room_type_id
GROUP BY p.id, p.name, p.address, p.property_type, p.is_active;

-- Step 11: Drop old view that references the old structure
DROP VIEW IF EXISTS public.reservations_with_details;

COMMIT;

-- Post-migration notes:
-- 1. The old 'rooms' table is preserved for now to allow for data verification
-- 2. The 'room_id' column in reservations and property_images is preserved for rollback capability
-- 3. Manual data migration is required to populate room_types and room_units
-- 4. After successful migration and verification, the old tables and columns can be dropped:
--    - DROP TABLE rooms;
--    - ALTER TABLE reservations DROP COLUMN room_id;
--    - ALTER TABLE property_images DROP COLUMN room_id;

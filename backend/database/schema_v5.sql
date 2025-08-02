-- Schema V5: Property/Room Type/Room Unit Restructure
-- This version implements a proper hierarchy: properties → room_types → room_units

-- First, let's create the necessary types and functions if they don't exist
DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'owner', 'cleaner', 'guest');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or replace the generate_checkin_token function
CREATE OR REPLACE FUNCTION generate_checkin_token()
RETURNS TRIGGER AS $$
BEGIN
    NEW.check_in_token = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or replace the update_checkin_status function
CREATE OR REPLACE FUNCTION update_checkin_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.checkin_submitted_at IS NOT NULL AND OLD.checkin_submitted_at IS NULL THEN
        NEW.status = 'checked_in';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or replace the update_verified_at function
CREATE OR REPLACE FUNCTION update_verified_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.admin_verified = true AND OLD.admin_verified = false THEN
        NEW.verified_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid not null,
  role public.user_role not null,
  first_name character varying(255) not null,
  last_name character varying(255) not null,
  phone character varying(50) null,
  company_name character varying(255) null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
);

-- Properties Table (modified - renamed total_rooms to rooms)
create table public.properties (
  id uuid not null default extensions.uuid_generate_v4 (),
  name character varying(255) not null,
  address text not null,
  owner_id uuid null,
  description text null,
  property_type character varying(100) null default 'apartment'::character varying,
  wifi_name character varying(255) null,
  wifi_password character varying(255) null,
  house_rules text null,
  check_in_instructions text null,
  emergency_contact character varying(255) null,
  property_amenities jsonb null,
  location_info jsonb null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  access_time time without time zone null,
  default_cleaner_id uuid null,
  constraint properties_pkey primary key (id),
  constraint properties_default_cleaner_id_fkey foreign KEY (default_cleaner_id) references user_profiles (id) on delete set null,
  constraint properties_owner_id_fkey foreign KEY (owner_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_properties_default_cleaner_id on public.properties using btree (default_cleaner_id) TABLESPACE pg_default;

create index IF not exists idx_properties_owner_id on public.properties using btree (owner_id) TABLESPACE pg_default;

create index IF not exists idx_properties_active on public.properties using btree (is_active) TABLESPACE pg_default;

create trigger update_properties_updated_at BEFORE
update on properties for EACH row
execute FUNCTION update_updated_at_column ();

-- Room Types Table (NEW)
CREATE TABLE IF NOT EXISTS public.room_types (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid not null,
  name character varying(255) not null, -- "Double Room", "Twin Room", "Suite"
  description text null,
  max_guests integer not null default 2,
  base_price numeric(10,2) null, -- Base pricing at room type level
  currency character varying(3) null default 'USD'::character varying,
  room_amenities jsonb null, -- Amenities common to this room type
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

-- Room Units Table (replaces rooms table)
CREATE TABLE IF NOT EXISTS public.room_units (
  id uuid not null default extensions.uuid_generate_v4 (),
  room_type_id uuid not null,
  unit_number character varying(50) not null, -- "201", "A-1", "Suite 5"
  floor_number integer null,
  access_code character varying(50) null,
  access_instructions text null,
  wifi_name character varying(255) null, -- Unit-specific WiFi if different
  wifi_password character varying(255) null,
  unit_amenities jsonb null, -- Unit-specific amenities (in addition to room type)
  maintenance_notes text null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint room_units_pkey primary key (id),
  constraint room_units_room_type_id_fkey foreign KEY (room_type_id) references room_types (id) on delete CASCADE,
  constraint room_units_type_unit_unique unique (room_type_id, unit_number)
);

-- Reservations Table (updated with new foreign keys)
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid not null default extensions.uuid_generate_v4 (),
  --Booking Details
  beds24_booking_id character varying(255) not null,
  property_id uuid null, -- NEW: Direct reference to property
  room_type_id uuid null, -- NEW: Reference to room type
  room_unit_id uuid null, -- NEW: Reference to specific room unit
  room_id uuid null, -- DEPRECATED: Will be removed after migration
  booking_name character varying(255) not null,
  booking_email character varying(255) not null,
  booking_phone character varying(50) null,
  check_in_date date not null,
  check_out_date date not null,
  num_guests integer null default 1,
  total_amount numeric(10, 2) null,
  currency character varying(3) null default 'USD'::character varying,
  status public.reservation_status null default 'pending'::reservation_status,
  booking_source text null,
  num_adults integer null,
  num_children integer null,
  special_requests text null,

  --Check-in Details
  check_in_token character varying(8) null,
  guest_lastname character varying(255) null,
  guest_firstname character varying(255) null,
  guest_contact character varying(50) null,
  guest_mail character varying(255) null,
  passport_url text null,
  guest_address text null,
  estimated_checkin_time time without time zone null,
  travel_purpose character varying(255) null,
  emergency_contact_name character varying(255) null,
  emergency_contact_phone character varying(50) null,
  agreement_accepted boolean null default false,
  checkin_submitted_at timestamp with time zone null,
  admin_verified boolean null default false,
  verified_at timestamp with time zone null,
  verified_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  
  constraint reservations_pkey primary key (id),
  constraint reservations_beds24_booking_id_key unique (beds24_booking_id),
  constraint reservations_check_in_token_key unique (check_in_token),
  constraint reservations_property_id_fkey foreign KEY (property_id) references properties (id) on delete set null,
  constraint reservations_room_type_id_fkey foreign KEY (room_type_id) references room_types (id) on delete set null,
  constraint reservations_room_unit_id_fkey foreign KEY (room_unit_id) references room_units (id) on delete set null,
  constraint reservations_verified_by_fkey foreign KEY (verified_by) references user_profiles (id) on delete set null
);

-- Property Images Table (updated to reference room_units instead of rooms)
CREATE TABLE IF NOT EXISTS public.property_images (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid null,
  room_type_id uuid null, -- NEW: Reference to room type
  room_unit_id uuid null, -- NEW: Reference to room unit
  room_id uuid null, -- DEPRECATED: Will be removed after migration
  image_url text not null,
  image_type character varying(50) null default 'general'::character varying,
  caption character varying(255) null,
  display_order integer null default 0,
  is_primary boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint property_images_pkey primary key (id),
  constraint property_images_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE,
  constraint property_images_room_type_id_fkey foreign KEY (room_type_id) references room_types (id) on delete CASCADE,
  constraint property_images_room_unit_id_fkey foreign KEY (room_unit_id) references room_units (id) on delete CASCADE
);

-- Indexes for Properties
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_active ON public.properties USING btree (is_active);

-- Indexes for Room Types
CREATE INDEX IF NOT EXISTS idx_room_types_property_id ON public.room_types USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_room_types_active ON public.room_types USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_room_types_name ON public.room_types USING btree (name);

-- Indexes for Room Units
CREATE INDEX IF NOT EXISTS idx_room_units_room_type_id ON public.room_units USING btree (room_type_id);
CREATE INDEX IF NOT EXISTS idx_room_units_active ON public.room_units USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_room_units_unit_number ON public.room_units USING btree (unit_number);
CREATE INDEX IF NOT EXISTS idx_room_units_floor ON public.room_units USING btree (floor_number);

-- Indexes for Reservations
CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON public.reservations USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_type_id ON public.reservations USING btree (room_type_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_unit_id ON public.reservations USING btree (room_unit_id);
CREATE INDEX IF NOT EXISTS idx_reservations_beds24_booking_id ON public.reservations USING btree (beds24_booking_id);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in_token ON public.reservations USING btree (check_in_token);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations USING btree (status);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in_date ON public.reservations USING btree (check_in_date);
CREATE INDEX IF NOT EXISTS idx_reservations_booking_email ON public.reservations USING btree (booking_email);
CREATE INDEX IF NOT EXISTS idx_reservations_admin_verified ON public.reservations USING btree (admin_verified);
CREATE INDEX IF NOT EXISTS idx_reservations_checkin_submitted ON public.reservations USING btree (checkin_submitted_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status_date ON public.reservations USING btree (status, check_in_date);
CREATE INDEX IF NOT EXISTS idx_reservations_property_date ON public.reservations USING btree (property_id, check_in_date);

-- Indexes for Property Images
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON public.property_images USING btree (property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_room_type_id ON public.property_images USING btree (room_type_id);
CREATE INDEX IF NOT EXISTS idx_property_images_room_unit_id ON public.property_images USING btree (room_unit_id);

-- Indexes for User Profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON public.user_profiles USING btree (is_active);

-- Triggers
CREATE TRIGGER IF NOT EXISTS update_properties_updated_at 
  BEFORE UPDATE ON properties 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_room_types_updated_at 
  BEFORE UPDATE ON room_types 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_room_units_updated_at 
  BEFORE UPDATE ON room_units 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS set_checkin_token 
  BEFORE INSERT ON reservations 
  FOR EACH ROW 
  WHEN (new.check_in_token is null)
  EXECUTE FUNCTION generate_checkin_token();

CREATE TRIGGER IF NOT EXISTS update_reservations_checkin_status 
  BEFORE UPDATE ON reservations 
  FOR EACH ROW
  EXECUTE FUNCTION update_checkin_status();

CREATE TRIGGER IF NOT EXISTS update_reservations_verified_at 
  BEFORE UPDATE ON reservations 
  FOR EACH ROW
  EXECUTE FUNCTION update_verified_at();

-- Updated View with Full Hierarchy
CREATE OR REPLACE VIEW public.reservations_details AS
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

-- View for Room Availability (useful for booking system)
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

-- View for Property Summary
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

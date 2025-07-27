create table public.reservations (
  id uuid not null default extensions.uuid_generate_v4 (),
  --Booking Details
  beds24_booking_id character varying(255) not null,
  room_id uuid null,
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
  constraint reservations_room_id_fkey foreign KEY (room_id) references rooms (id) on delete set null,
  constraint reservations_verified_by_fkey foreign KEY (verified_by) references user_profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_reservations_room_id on public.reservations using btree (room_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_beds24_booking_id on public.reservations using btree (beds24_booking_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_check_in_token on public.reservations using btree (check_in_token) TABLESPACE pg_default;

create index IF not exists idx_reservations_status on public.reservations using btree (status) TABLESPACE pg_default;

create index IF not exists idx_reservations_check_in_date on public.reservations using btree (check_in_date) TABLESPACE pg_default;

create index IF not exists idx_reservations_booking_email on public.reservations using btree (booking_email) TABLESPACE pg_default;

create index IF not exists idx_reservations_admin_verified on public.reservations using btree (admin_verified) TABLESPACE pg_default;

create index IF not exists idx_reservations_checkin_submitted on public.reservations using btree (checkin_submitted_at) TABLESPACE pg_default;

create index IF not exists idx_reservations_status_date on public.reservations using btree (status, check_in_date) TABLESPACE pg_default;

create index IF not exists idx_reservations_room_date on public.reservations using btree (room_id, check_in_date) TABLESPACE pg_default;

create trigger set_checkin_token BEFORE INSERT on reservations for EACH row when (new.check_in_token is null)
execute FUNCTION generate_checkin_token ();

create trigger update_reservations_checkin_status BEFORE
update on reservations for EACH row
execute FUNCTION update_checkin_status ();

create trigger update_reservations_verified_at BEFORE
update on reservations for EACH row
execute FUNCTION update_verified_at ();

--
create table public.properties (
  id uuid not null default extensions.uuid_generate_v4 (),
  name character varying(255) not null,
  address text not null,
  owner_id uuid null,
  description text null,
  property_type character varying(100) null default 'apartment'::character varying,
  total_rooms integer null default 1,
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
  constraint properties_pkey primary key (id),
  constraint properties_owner_id_fkey foreign KEY (owner_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_properties_owner_id on public.properties using btree (owner_id) TABLESPACE pg_default;

create index IF not exists idx_properties_active on public.properties using btree (is_active) TABLESPACE pg_default;

create trigger update_properties_updated_at BEFORE
update on properties for EACH row
execute FUNCTION update_updated_at_column ();

--

create table public.property_images (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid null,
  room_id uuid null,
  image_url text not null,
  image_type character varying(50) null default 'general'::character varying,
  caption character varying(255) null,
  display_order integer null default 0,
  is_primary boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint property_images_pkey primary key (id),
  constraint property_images_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE,
  constraint property_images_room_id_fkey foreign KEY (room_id) references rooms (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_property_images_property_id on public.property_images using btree (property_id) TABLESPACE pg_default;

create index IF not exists idx_property_images_room_id on public.property_images using btree (room_id) TABLESPACE pg_default;

--

create view public.reservations_with_details as
select
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
from
  reservations r
  left join rooms rm on r.room_id = rm.id
  left join properties p on rm.property_id = p.id
  left join user_profiles up on r.verified_by = up.id;

  --

  create table public.rooms (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid null,
  room_number character varying(50) not null,
  room_name character varying(255) null,
  room_type character varying(100) null,
  max_guests integer null default 2,
  access_code character varying(50) null,
  access_instructions text null,
  room_amenities jsonb null,
  room_size_sqm integer null,
  bed_configuration character varying(255) null,
  floor_number integer null,
  wifi_name character varying(255) null,
  wifi_password character varying(255) null,
  has_balcony boolean null default false,
  has_kitchen boolean null default false,
  is_accessible boolean null default false,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint rooms_pkey primary key (id),
  constraint rooms_property_id_room_number_key unique (property_id, room_number),
  constraint rooms_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_rooms_property_id on public.rooms using btree (property_id) TABLESPACE pg_default;

create index IF not exists idx_rooms_active on public.rooms using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_rooms_room_number on public.rooms using btree (room_number) TABLESPACE pg_default;

create trigger update_rooms_updated_at BEFORE
update on rooms for EACH row
execute FUNCTION update_updated_at_column ();

--

create table public.user_profiles (
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
) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_role on public.user_profiles using btree (role) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_active on public.user_profiles using btree (is_active) TABLESPACE pg_default;

create trigger update_user_profiles_updated_at BEFORE
update on user_profiles for EACH row
execute FUNCTION update_updated_at_column ();

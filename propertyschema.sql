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
  contact_number character varying(255) null,
  property_amenities jsonb null,
  location_info jsonb null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  access_time time without time zone null,
  default_cleaner_id uuid null,
  beds24_property_id bigint null,
  departure_time time without time zone null,
  entrance_code text null,
  property_email text null,
  constraint properties_pkey primary key (id),
  constraint properties_beds24_property_id_key unique (beds24_property_id),
  constraint properties_default_cleaner_id_fkey foreign KEY (default_cleaner_id) references user_profiles (id) on delete set null,
  constraint properties_owner_id_fkey foreign KEY (owner_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_properties_active on public.properties using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_properties_default_cleaner_id on public.properties using btree (default_cleaner_id) TABLESPACE pg_default;

create index IF not exists idx_properties_owner_id on public.properties using btree (owner_id) TABLESPACE pg_default;

create trigger update_properties_updated_at BEFORE
update on properties for EACH row
execute FUNCTION update_updated_at_column ();


create table public.room_types (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid not null,
  name character varying(255) not null,
  description text null,
  max_guests integer not null default 2,
  base_price numeric(10, 2) null,
  currency character varying(3) null default 'JPY'::character varying,
  room_amenities jsonb null,
  bed_configuration character varying(255) null,
  room_size_sqm integer null,
  has_balcony boolean null default false,
  has_kitchen boolean null default false,
  is_accessible boolean null default false,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  beds24_roomtype_id bigint null,
  min_price numeric(10, 2) null,
  max_price numeric(10, 2) null,
  total_units integer null,
  sort_order integer null,
  constraint room_types_pkey primary key (id),
  constraint room_types_beds24_roomtype_id_key unique (beds24_roomtype_id),
  constraint room_types_property_name_unique unique (property_id, name),
  constraint room_types_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_room_types_active on public.room_types using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_room_types_name on public.room_types using btree (name) TABLESPACE pg_default;

create index IF not exists idx_room_types_property_id on public.room_types using btree (property_id) TABLESPACE pg_default;

create trigger update_room_types_updated_at BEFORE
update on room_types for EACH row
execute FUNCTION update_updated_at_column ();

create table public.room_units (
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
  beds24_unit_id bigint null,
  constraint room_units_pkey primary key (id),
  constraint room_units_type_unit_unique unique (room_type_id, unit_number),
  constraint room_units_room_type_id_fkey foreign KEY (room_type_id) references room_types (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_room_units_active on public.room_units using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_room_units_floor on public.room_units using btree (floor_number) TABLESPACE pg_default;

create index IF not exists idx_room_units_room_type_id on public.room_units using btree (room_type_id) TABLESPACE pg_default;

create index IF not exists idx_room_units_unit_number on public.room_units using btree (unit_number) TABLESPACE pg_default;

create index IF not exists idx_room_units_room_type_active on public.room_units using btree (room_type_id, is_active) TABLESPACE pg_default;

create trigger trg_room_units_sync
after INSERT
or DELETE
or
update on room_units for EACH row
execute FUNCTION trg_sync_room_type_total_units ();

create trigger update_room_units_updated_at BEFORE
update on room_units for EACH row
execute FUNCTION update_updated_at_column ();
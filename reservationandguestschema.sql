create table public.reservations (
  id uuid not null default extensions.uuid_generate_v4 (),
  beds24_booking_id character varying(255) not null,
  booking_name character varying(255) not null,
  booking_email character varying(255) not null,
  booking_phone character varying(50) null,
  check_in_date date not null,
  check_out_date date not null,
  num_guests integer null default 1,
  total_amount numeric(10, 2) null,
  currency character varying(3) null default 'JPY'::character varying,
  check_in_token character varying(8) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  booking_source text null,
  num_adults integer null,
  num_children integer null,
  special_requests text null,
  property_id uuid null,
  room_type_id uuid null,
  room_unit_id uuid null,
  "apiReference" text null,
  booking_lastname text null,
  "rateDescription" text null,
  commission numeric null,
  "apiMessage" text null,
  "bookingTime" timestamp with time zone null,
  comments text null,
  price numeric null,
  "timeStamp" timestamp with time zone null,
  lang text null,
  access_read boolean null default false,
  status text null,
  booking_firstname text null,
  booking_group_master_id text null,
  is_group_master boolean null default false,
  group_room_count integer null default 1,
  booking_group_ids jsonb null,
  constraint reservations_pkey primary key (id),
  constraint reservations_beds24_booking_id_key unique (beds24_booking_id),
  constraint reservations_check_in_token_key unique (check_in_token),
  constraint reservations_property_id_fkey foreign KEY (property_id) references properties (id) on delete set null,
  constraint reservations_room_type_id_fkey foreign KEY (room_type_id) references room_types (id) on delete set null,
  constraint reservations_room_unit_id_fkey foreign KEY (room_unit_id) references room_units (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_reservations_beds24_booking_id on public.reservations using btree (beds24_booking_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_booking_email on public.reservations using btree (booking_email) TABLESPACE pg_default;

create index IF not exists idx_reservations_check_in_date on public.reservations using btree (check_in_date) TABLESPACE pg_default;

create index IF not exists idx_reservations_check_in_token on public.reservations using btree (check_in_token) TABLESPACE pg_default;

create index IF not exists idx_reservations_property_date on public.reservations using btree (property_id, check_in_date) TABLESPACE pg_default;

create index IF not exists idx_reservations_property_id on public.reservations using btree (property_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_room_type_id on public.reservations using btree (room_type_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_room_unit_id on public.reservations using btree (room_unit_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_status on public.reservations using btree (status) TABLESPACE pg_default;

create index IF not exists idx_reservations_status_date on public.reservations using btree (status, check_in_date) TABLESPACE pg_default;

create index IF not exists idx_reservations_group_master on public.reservations using btree (booking_group_master_id) TABLESPACE pg_default
where
  (booking_group_master_id is not null);

create index IF not exists idx_reservations_is_group_master on public.reservations using btree (is_group_master) TABLESPACE pg_default
where
  (is_group_master = true);

create index IF not exists idx_reservations_group_ids on public.reservations using gin (booking_group_ids) TABLESPACE pg_default
where
  (booking_group_ids is not null);

create trigger auto_manage_cleaning_task
after INSERT
or
update OF room_unit_id,
check_out_date on reservations for EACH row
execute FUNCTION manage_cleaning_task ();

create trigger manage_cleaning_task_trigger
after INSERT
or
update OF check_out_date,
room_unit_id,
property_id on reservations for EACH row
execute FUNCTION manage_cleaning_task ();

create trigger manage_cleaning_tasks_trigger
after INSERT
or
update OF room_unit_id,
check_out_date on reservations for EACH row
execute FUNCTION manage_cleaning_task ();

create trigger propagate_booking_name_to_ct
after
update OF booking_name on reservations for EACH row
execute FUNCTION propagate_booking_name_to_ct ();

create trigger reservation_pricing_trigger
after INSERT
or DELETE
or
update on reservations for EACH row
execute FUNCTION trigger_pricing_recalculation ();

create trigger set_checkin_token BEFORE INSERT on reservations for EACH row when (new.check_in_token is null)
execute FUNCTION generate_checkin_token ();

create trigger set_reservation_booking_name BEFORE INSERT
or
update OF booking_firstname,
booking_lastname on reservations for EACH row
execute FUNCTION set_reservation_booking_name ();

create trigger trg_cancel_cleaning_task_if_res_cancelled
after
update OF status on reservations for EACH row
execute FUNCTION cancel_cleaning_task_if_res_cancelled ();

create trigger trg_maintain_group_booking_consistency
after
update on reservations for EACH row when (
  new.is_group_master = true
  and new.booking_group_master_id is not null
)
execute FUNCTION maintain_group_booking_consistency ();

create trigger trg_revoke_checkin_token BEFORE
update on reservations for EACH row when (old.status is distinct from new.status)
execute FUNCTION revoke_checkin_token ();

create trigger trg_sync_cleaning_status_from_reservation
after
update OF status on reservations for EACH row
execute FUNCTION sync_cleaning_status_from_reservation ();

create trigger trg_update_cleaning_status_on_res_cancel
after
update OF status on reservations for EACH row when (old.status is distinct from new.status)
execute FUNCTION update_cleaning_status_on_res_cancel ();

create table public.reservation_addons (
  id uuid not null default extensions.uuid_generate_v4 (),
  reservation_id uuid not null,
  service_id uuid not null,
  admin_enabled boolean null default false,
  purchase_status character varying(20) null default 'available'::character varying,
  stripe_payment_intent_id character varying(100) null,
  amount_paid numeric(10, 2) null,
  calculated_amount numeric(10, 2) null,
  is_tax_exempted boolean null default false,
  tax_calculation_details jsonb null,
  access_time_override time without time zone null,
  departure_time_override time without time zone null,
  purchased_at timestamp with time zone null,
  exempted_at timestamp with time zone null,
  exempted_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint reservation_addons_pkey primary key (id),
  constraint reservation_addons_unique_service unique (reservation_id, service_id),
  constraint reservation_addons_exempted_by_fkey foreign KEY (exempted_by) references users (id),
  constraint reservation_addons_reservation_id_fkey foreign KEY (reservation_id) references reservations (id) on delete CASCADE,
  constraint reservation_addons_service_id_fkey foreign KEY (service_id) references guest_services (id),
  constraint reservation_addons_status_check check (
    (
      (purchase_status)::text = any (
        (
          array[
            'available'::character varying,
            'pending'::character varying,
            'paid'::character varying,
            'failed'::character varying,
            'exempted'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_reservation_addons_reservation on public.reservation_addons using btree (reservation_id) TABLESPACE pg_default;

create index IF not exists idx_reservation_addons_status on public.reservation_addons using btree (purchase_status) TABLESPACE pg_default;

create index IF not exists idx_reservation_addons_admin_enabled on public.reservation_addons using btree (admin_enabled) TABLESPACE pg_default
where
  (admin_enabled = true);

create trigger update_reservation_addons_updated_at BEFORE
update on reservation_addons for EACH row
execute FUNCTION update_updated_at_column ();

create table public.reservation_guests (
  id uuid not null default extensions.uuid_generate_v4 (),
  reservation_id uuid not null,
  guest_number integer not null,
  is_primary_guest boolean not null default false,
  guest_firstname character varying(255) null,
  guest_lastname character varying(255) null,
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
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint reservation_guests_pkey primary key (id),
  constraint reservation_guests_reservation_guest_number_unique unique (reservation_id, guest_number),
  constraint reservation_guests_reservation_id_fkey foreign KEY (reservation_id) references reservations (id) on delete CASCADE,
  constraint reservation_guests_verified_by_fkey foreign KEY (verified_by) references user_profiles (id) on delete set null,
  constraint reservation_guests_guest_number_positive check ((guest_number > 0)),
  constraint reservation_guests_primary_guest_logic check (
    (
      (
        (is_primary_guest = true)
        and (guest_number = 1)
      )
      or (is_primary_guest = false)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_reservation_guests_reservation_id on public.reservation_guests using btree (reservation_id) TABLESPACE pg_default;

create index IF not exists idx_reservation_guests_guest_number on public.reservation_guests using btree (reservation_id, guest_number) TABLESPACE pg_default;

create index IF not exists idx_reservation_guests_primary on public.reservation_guests using btree (reservation_id, is_primary_guest) TABLESPACE pg_default
where
  (is_primary_guest = true);

create index IF not exists idx_reservation_guests_checkin_status on public.reservation_guests using btree (reservation_id, checkin_submitted_at) TABLESPACE pg_default;

create index IF not exists idx_reservation_guests_admin_verified on public.reservation_guests using btree (admin_verified, verified_at) TABLESPACE pg_default;

create trigger update_reservation_guests_updated_at BEFORE
update on reservation_guests for EACH row
execute FUNCTION update_updated_at_column ();

create table public.reservation_segments (
  id uuid not null default extensions.uuid_generate_v4 (),
  reservation_id uuid not null,
  room_unit_id uuid not null,
  start_date date not null,
  end_date date not null,
  label text null,
  color text null default '#3b82f6'::text,
  segment_order integer null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint reservation_segments_pkey primary key (id),
  constraint reservation_segments_reservation_id_fkey foreign KEY (reservation_id) references reservations (id) on delete CASCADE,
  constraint reservation_segments_room_unit_id_fkey foreign KEY (room_unit_id) references room_units (id) on delete RESTRICT,
  constraint positive_segment_order check ((segment_order > 0)),
  constraint valid_date_range check ((start_date < end_date))
) TABLESPACE pg_default;

create index IF not exists idx_reservation_segments_reservation_id on public.reservation_segments using btree (reservation_id) TABLESPACE pg_default;

create index IF not exists idx_reservation_segments_room_unit_id on public.reservation_segments using btree (room_unit_id) TABLESPACE pg_default;

create index IF not exists idx_reservation_segments_dates on public.reservation_segments using btree (start_date, end_date) TABLESPACE pg_default;

create index IF not exists idx_reservation_segments_room_dates on public.reservation_segments using btree (room_unit_id, start_date, end_date) TABLESPACE pg_default;

create unique INDEX IF not exists idx_reservation_segments_no_overlap on public.reservation_segments using btree (room_unit_id, start_date, end_date) TABLESPACE pg_default;

create trigger trg_reservation_segments_updated_at BEFORE
update on reservation_segments for EACH row
execute FUNCTION update_updated_at_column ();
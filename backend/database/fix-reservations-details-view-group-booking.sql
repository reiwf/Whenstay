-- Fix reservations_details view to include group booking fields
-- This ensures the ReservationDrawer displays correct group booking information

DROP VIEW IF EXISTS public.reservations_details;

CREATE VIEW public.reservations_details AS
 SELECT r.id,
    r.beds24_booking_id,
    r.property_id,
    r.room_type_id,
    r.room_unit_id,
    TRIM(BOTH FROM concat_ws(' '::text, r.booking_firstname, r.booking_lastname)) AS booking_name,
    r.booking_firstname,
    r.booking_lastname,
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
    r."rateDescription",
    r.commission,
    r."apiMessage",
    r."bookingTime",
    r.comments,
    r.price,
    r."timeStamp",
    r.lang,
    r.access_read,
    -- ADD GROUP BOOKING FIELDS
    r.booking_group_master_id,
    r.is_group_master,
    r.group_room_count,
    r.booking_group_ids,
    -- END GROUP BOOKING FIELDS
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
        CASE
            WHEN (r.num_guests <= 1) THEN
            CASE
                WHEN (pg.checkin_submitted_at IS NOT NULL) THEN true
                ELSE false
            END
            ELSE (( SELECT count(*) AS count
               FROM public.reservation_guests rg_check
              WHERE ((rg_check.reservation_id = r.id) AND (rg_check.checkin_submitted_at IS NOT NULL))) = COALESCE(r.num_guests, 1))
        END AS all_guests_checked_in,
    ( SELECT count(*) AS count
           FROM public.reservation_guests rg_count
          WHERE ((rg_count.reservation_id = r.id) AND (rg_count.checkin_submitted_at IS NOT NULL))) AS completed_guest_checkins,
    p.name AS property_name,
    p.address AS property_address,
    p.owner_id AS property_owner_id,
    p.description,
    p.property_type,
    p.wifi_name AS property_wifi_name,
    p.wifi_password AS property_wifi_password,
    p.house_rules,
    p.check_in_instructions,
    p.contact_number AS property_emergency_contact,
    p.property_amenities,
    p.location_info,
    p.luggage_info,
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
   FROM (((((public.reservations r
     LEFT JOIN public.reservation_guests pg ON (((r.id = pg.reservation_id) AND (pg.guest_number = 1))))
     LEFT JOIN public.properties p ON ((r.property_id = p.id)))
     LEFT JOIN public.room_types rt ON ((r.room_type_id = rt.id)))
     LEFT JOIN public.room_units ru ON ((r.room_unit_id = ru.id)))
     LEFT JOIN public.user_profiles up ON ((pg.verified_by = up.id)));

-- Add comment to track this change
COMMENT ON VIEW public.reservations_details IS 'Comprehensive reservation details view with group booking fields - Updated to include booking_group_master_id, is_group_master, group_room_count, and booking_group_ids';

-- Migration: Update reservations_details view to use reservation_guests table
-- This script updates the view to join with reservation_guests for multi-guest support

-- Drop the existing view
DROP VIEW IF EXISTS public.reservations_details;

-- Create updated reservations_details view with reservation_guests support
CREATE VIEW public.reservations_details AS
 SELECT 
    -- Core reservation data
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
    
    -- Primary guest data (guest #1) - for backward compatibility
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
    
    -- Multi-guest check-in completion status
    CASE 
        WHEN r.num_guests <= 1 THEN 
            CASE WHEN pg.checkin_submitted_at IS NOT NULL THEN true ELSE false END
        ELSE
            (SELECT COUNT(*) FROM reservation_guests rg_check 
             WHERE rg_check.reservation_id = r.id 
             AND rg_check.checkin_submitted_at IS NOT NULL) = COALESCE(r.num_guests, 1)
    END AS all_guests_checked_in,
    
    -- Count of completed guest check-ins
    (SELECT COUNT(*) FROM reservation_guests rg_count 
     WHERE rg_count.reservation_id = r.id 
     AND rg_count.checkin_submitted_at IS NOT NULL) AS completed_guest_checkins,
    
    -- Property information
    p.name AS property_name,
    p.address AS property_address,
    p.owner_id AS property_owner_id,
    p.description,
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
    
    -- Room type information
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
    
    -- Room unit information
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
    
    -- User who verified (for primary guest)
    up.first_name AS verified_by_name,
    up.last_name AS verified_by_lastname
 FROM 
    public.reservations r
    -- Join with primary guest (guest #1) for backward compatibility
    LEFT JOIN public.reservation_guests pg ON (r.id = pg.reservation_id AND pg.guest_number = 1)
    LEFT JOIN public.properties p ON (r.property_id = p.id)
    LEFT JOIN public.room_types rt ON (r.room_type_id = rt.id)
    LEFT JOIN public.room_units ru ON (r.room_unit_id = ru.id)
    LEFT JOIN public.user_profiles up ON (pg.verified_by = up.id);

-- Add comment for documentation
COMMENT ON VIEW public.reservations_details IS 'Comprehensive view of reservations with property, room, and primary guest information. Includes multi-guest check-in completion status.';

-- Create helper view for all guests (useful for admin interfaces)
CREATE VIEW public.reservation_all_guests_details AS
 SELECT 
    -- Reservation basic info
    r.id AS reservation_id,
    r.beds24_booking_id,
    r.booking_name,
    r.check_in_date,
    r.check_out_date,
    r.num_guests,
    r.status,
    
    -- Property info
    p.name AS property_name,
    
    -- Room info
    rt.name AS room_type_name,
    ru.unit_number,
    
    -- All guest information
    rg.id AS guest_id,
    rg.guest_number,
    rg.is_primary_guest,
    rg.guest_firstname,
    rg.guest_lastname,
    rg.guest_contact,
    rg.guest_mail,
    rg.passport_url,
    rg.guest_address,
    rg.estimated_checkin_time,
    rg.travel_purpose,
    rg.emergency_contact_name,
    rg.emergency_contact_phone,
    rg.agreement_accepted,
    rg.checkin_submitted_at,
    rg.admin_verified,
    rg.verified_at,
    rg.verified_by,
    rg.created_at AS guest_created_at,
    rg.updated_at AS guest_updated_at
 FROM 
    public.reservations r
    JOIN public.reservation_guests rg ON (r.id = rg.reservation_id)
    LEFT JOIN public.properties p ON (r.property_id = p.id)
    LEFT JOIN public.room_types rt ON (r.room_type_id = rt.id)
    LEFT JOIN public.room_units ru ON (r.room_unit_id = ru.id)
 ORDER BY 
    r.check_in_date DESC, 
    rg.guest_number ASC;

COMMENT ON VIEW public.reservation_all_guests_details IS 'Detailed view showing all guests for each reservation, useful for admin interfaces and guest management.';

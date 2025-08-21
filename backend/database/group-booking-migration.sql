-- Migration: Add Group Booking Support
-- This adds the necessary fields to support Beds24 group bookings

-- Add group booking fields to reservations table
ALTER TABLE public.reservations 
ADD COLUMN booking_group_master_id text,
ADD COLUMN is_group_master boolean DEFAULT false,
ADD COLUMN group_room_count integer DEFAULT 1,
ADD COLUMN booking_group_ids jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.reservations.booking_group_master_id IS 'Beds24 master booking ID for group bookings - links all rooms in a group';
COMMENT ON COLUMN public.reservations.is_group_master IS 'True for the primary/master reservation in a group booking';
COMMENT ON COLUMN public.reservations.group_room_count IS 'Total number of rooms in the group booking';
COMMENT ON COLUMN public.reservations.booking_group_ids IS 'Array of all booking IDs that belong to this group';

-- Create indexes for efficient group booking queries
CREATE INDEX idx_reservations_group_master ON public.reservations(booking_group_master_id) WHERE booking_group_master_id IS NOT NULL;
CREATE INDEX idx_reservations_is_group_master ON public.reservations(is_group_master) WHERE is_group_master = true;
CREATE INDEX idx_reservations_group_ids ON public.reservations USING gin(booking_group_ids) WHERE booking_group_ids IS NOT NULL;

-- Create a view for group booking details
CREATE VIEW public.group_booking_details AS
SELECT 
    r.booking_group_master_id,
    COUNT(*) as total_rooms,
    COUNT(*) FILTER (WHERE r.is_group_master = true) as master_count,
    MIN(r.check_in_date) as earliest_checkin,
    MAX(r.check_out_date) as latest_checkout,
    STRING_AGG(DISTINCT r.booking_name, ', ') as guest_names,
    STRING_AGG(DISTINCT r.booking_email, ', ') as guest_emails,
    STRING_AGG(DISTINCT ru.unit_number, ', ' ORDER BY ru.unit_number) as room_units,
    STRING_AGG(DISTINCT rt.name, ', ') as room_types,
    p.name as property_name,
    SUM(r.total_amount) as total_group_amount,
    r.currency,
    MAX(r.created_at) as latest_created_at,
    MAX(r.updated_at) as latest_updated_at
FROM public.reservations r
LEFT JOIN public.room_units ru ON r.room_unit_id = ru.id
LEFT JOIN public.room_types rt ON r.room_type_id = rt.id
LEFT JOIN public.properties p ON r.property_id = p.id
WHERE r.booking_group_master_id IS NOT NULL
GROUP BY r.booking_group_master_id, p.name, r.currency;

COMMENT ON VIEW public.group_booking_details IS 'Comprehensive view of group bookings with aggregated information across all rooms';

-- Function to get all reservations in a group
CREATE OR REPLACE FUNCTION public.get_group_reservations(master_booking_id text)
RETURNS TABLE (
    id uuid,
    beds24_booking_id character varying(255),
    booking_name character varying(255),
    room_unit_id uuid,
    unit_number character varying(50),
    room_type_name character varying(255),
    is_group_master boolean,
    check_in_date date,
    check_out_date date,
    status text,
    total_amount numeric(10,2)
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        r.id,
        r.beds24_booking_id,
        r.booking_name,
        r.room_unit_id,
        ru.unit_number,
        rt.name as room_type_name,
        r.is_group_master,
        r.check_in_date,
        r.check_out_date,
        r.status,
        r.total_amount
    FROM public.reservations r
    LEFT JOIN public.room_units ru ON r.room_unit_id = ru.id
    LEFT JOIN public.room_types rt ON r.room_type_id = rt.id
    WHERE r.booking_group_master_id = master_booking_id
    ORDER BY r.is_group_master DESC, ru.unit_number;
$$;

COMMENT ON FUNCTION public.get_group_reservations IS 'Returns all reservations that belong to a specific group booking';

-- Function to update group booking status
CREATE OR REPLACE FUNCTION public.update_group_booking_status(
    master_booking_id text,
    new_status text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE public.reservations 
    SET status = new_status, updated_at = NOW()
    WHERE booking_group_master_id = master_booking_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.update_group_booking_status IS 'Updates status for all reservations in a group booking';

-- Function to cancel group booking
CREATE OR REPLACE FUNCTION public.cancel_group_booking(master_booking_id text)
RETURNS TABLE (
    reservation_id uuid,
    beds24_booking_id character varying(255),
    previous_status text
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update all reservations in the group to cancelled status
    RETURN QUERY
    UPDATE public.reservations 
    SET status = 'cancelled', updated_at = NOW()
    WHERE booking_group_master_id = master_booking_id
    AND status != 'cancelled'
    RETURNING id, reservations.beds24_booking_id, 'cancelled';
END;
$$;

COMMENT ON FUNCTION public.cancel_group_booking IS 'Cancels all reservations in a group booking and returns affected reservations';

-- Trigger function to maintain group booking consistency
CREATE OR REPLACE FUNCTION public.maintain_group_booking_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is a group master and certain key fields change, update related reservations
    IF NEW.is_group_master = true AND NEW.booking_group_master_id IS NOT NULL THEN
        -- Update guest information for all related bookings if master guest info changes
        IF OLD.booking_firstname IS DISTINCT FROM NEW.booking_firstname 
           OR OLD.booking_lastname IS DISTINCT FROM NEW.booking_lastname
           OR OLD.booking_email IS DISTINCT FROM NEW.booking_email 
           OR OLD.booking_phone IS DISTINCT FROM NEW.booking_phone THEN
            
            UPDATE public.reservations 
            SET 
                booking_firstname = NEW.booking_firstname,
                booking_lastname = NEW.booking_lastname,
                booking_email = NEW.booking_email,
                booking_phone = NEW.booking_phone,
                updated_at = NOW()
            WHERE booking_group_master_id = NEW.booking_group_master_id 
            AND id != NEW.id
            AND is_group_master = false;
        END IF;
        
        -- Update check-in/check-out dates if they change on master
        IF OLD.check_in_date IS DISTINCT FROM NEW.check_in_date 
           OR OLD.check_out_date IS DISTINCT FROM NEW.check_out_date THEN
            
            UPDATE public.reservations 
            SET 
                check_in_date = NEW.check_in_date,
                check_out_date = NEW.check_out_date,
                updated_at = NOW()
            WHERE booking_group_master_id = NEW.booking_group_master_id 
            AND id != NEW.id
            AND is_group_master = false;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for group booking consistency
CREATE TRIGGER trg_maintain_group_booking_consistency
    AFTER UPDATE ON public.reservations
    FOR EACH ROW
    WHEN (NEW.is_group_master = true AND NEW.booking_group_master_id IS NOT NULL)
    EXECUTE FUNCTION public.maintain_group_booking_consistency();

COMMENT ON TRIGGER trg_maintain_group_booking_consistency ON public.reservations IS 'Maintains consistency across group booking reservations when master reservation changes';

-- Migration: Add unsend functionality to messages table
-- Add fields to track when and by whom a message was unsent

ALTER TABLE public.messages 
ADD COLUMN unsent_at timestamp with time zone,
ADD COLUMN unsent_by uuid REFERENCES auth.users(id),
ADD COLUMN is_unsent boolean DEFAULT false NOT NULL;

-- Add index for efficient querying of unsent messages
CREATE INDEX idx_messages_is_unsent ON public.messages(is_unsent);
CREATE INDEX idx_messages_unsent_at ON public.messages(unsent_at) WHERE unsent_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.messages.unsent_at IS 'Timestamp when the message was unsent';
COMMENT ON COLUMN public.messages.unsent_by IS 'ID of the user who unsent the message';
COMMENT ON COLUMN public.messages.is_unsent IS 'Flag to quickly identify unsent messages';

-- Create function to check if a message can be unsent
CREATE OR REPLACE FUNCTION public.can_unsend_message(
    message_id uuid,
    user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    message_record RECORD;
    time_limit_hours INTEGER := 24;
BEGIN
    -- Get message details
    SELECT 
        m.id,
        m.origin_role,
        m.channel,
        m.created_at,
        m.is_unsent,
        m.direction,
        mt.reservation_id,
        r.property_id,
        p.owner_id
    INTO message_record
    FROM public.messages m
    LEFT JOIN public.message_threads mt ON m.thread_id = mt.id
    LEFT JOIN public.reservations r ON mt.reservation_id = r.id
    LEFT JOIN public.properties p ON r.property_id = p.id
    WHERE m.id = message_id;
    
    -- Message must exist
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Message must not already be unsent
    IF message_record.is_unsent THEN
        RETURN false;
    END IF;
    
    -- Must be in-app channel only
    IF message_record.channel != 'inapp' THEN
        RETURN false;
    END IF;
    
    -- Must be within 24 hour time limit
    IF message_record.created_at < NOW() - INTERVAL '24 hours' THEN
        RETURN false;
    END IF;
    
    -- Must be outgoing message (only sender can unsend)
    IF message_record.direction != 'outgoing' THEN
        RETURN false;
    END IF;
    
    -- User must be the sender (host/admin who sent the message) or property owner
    -- For host messages, check if user is admin or property owner
    IF message_record.origin_role = 'host' THEN
        -- Check if user is admin (can unsend any message) or property owner
        IF EXISTS (
            SELECT 1 FROM public.user_profiles up 
            WHERE up.id = user_id 
            AND (up.role = 'admin' OR up.id = message_record.owner_id)
        ) THEN
            RETURN true;
        END IF;
    END IF;
    
    -- For other roles, only allow if user is admin
    IF EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = user_id AND up.role = 'admin'
    ) THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Add comment for the function
COMMENT ON FUNCTION public.can_unsend_message(uuid, uuid) IS 'Checks if a message can be unsent by a specific user based on time limits, channel, and permissions';

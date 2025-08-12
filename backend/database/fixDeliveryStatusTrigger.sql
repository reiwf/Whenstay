-- =============================================
-- Message Deliveries Status Trigger Function
-- Automatically updates timestamp fields when status changes
-- =============================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.message_deliveries_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle INSERT operations
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'queued' AND NEW.queued_at IS NULL THEN 
      NEW.queued_at := now(); 
    END IF;
    IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN 
      NEW.sent_at := now(); 
    END IF;
    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN 
      NEW.delivered_at := now(); 
    END IF;
    IF NEW.status = 'read' AND NEW.read_at IS NULL THEN 
      NEW.read_at := now(); 
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE operations when status changes
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') <> NEW.status THEN
    CASE NEW.status
      WHEN 'queued' THEN 
        IF NEW.queued_at IS NULL THEN 
          NEW.queued_at := now(); 
        END IF;
      WHEN 'sent' THEN 
        IF NEW.sent_at IS NULL THEN 
          NEW.sent_at := now(); 
        END IF;
      WHEN 'delivered' THEN 
        IF NEW.delivered_at IS NULL THEN 
          NEW.delivered_at := now(); 
        END IF;
      WHEN 'read' THEN 
        IF NEW.read_at IS NULL THEN 
          NEW.read_at := now(); 
        END IF;
      WHEN 'failed' THEN
        -- Failed status doesn't get a timestamp, but we could log when it failed
        -- No timestamp update needed
        NULL;
      ELSE
        -- Unknown status, log a warning but don't fail
        RAISE WARNING 'Unknown message delivery status: %', NEW.status;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS message_deliveries_status_ts ON public.message_deliveries;

-- Create the trigger on the message_deliveries table
CREATE TRIGGER message_deliveries_status_ts
  BEFORE INSERT OR UPDATE ON public.message_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.message_deliveries_status_trigger();

-- Add a comment to document the trigger
COMMENT ON TRIGGER message_deliveries_status_ts ON public.message_deliveries IS 
'Automatically updates timestamp fields (queued_at, sent_at, delivered_at, read_at) when status changes';

COMMENT ON FUNCTION public.message_deliveries_status_trigger() IS 
'Trigger function to automatically set timestamp fields based on message delivery status transitions';

-- =============================================
-- ENSURE COMMUNICATION FUNCTIONS EXIST
-- =============================================

-- Function to mark messages as read (if missing)
CREATE OR REPLACE FUNCTION public.mark_messages_read(
    p_thread_id uuid,
    p_user_id uuid,
    p_last_message_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.message_participants
    SET last_read_message_id = COALESCE(p_last_message_id, (
        SELECT id FROM public.messages 
        WHERE thread_id = p_thread_id 
        ORDER BY created_at DESC 
        LIMIT 1
    )),
    last_read_at = now()
    WHERE thread_id = p_thread_id 
      AND user_id = p_user_id;
      
    -- If no participant record exists, create one
    IF NOT FOUND THEN
        INSERT INTO public.message_participants (
            thread_id, participant_type, user_id, last_read_message_id, last_read_at
        ) VALUES (
            p_thread_id, 'host', p_user_id, p_last_message_id, now()
        );
    END IF;
END $$;

-- Function to send a message (if missing)
CREATE OR REPLACE FUNCTION public.send_message(
    p_thread_id uuid,
    p_channel text,
    p_content text,
    p_origin_role text DEFAULT 'host',
    p_parent_message_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE 
    v_message_id uuid;
BEGIN
    INSERT INTO public.messages (thread_id, origin_role, direction, channel, content, parent_message_id)
    VALUES (p_thread_id, p_origin_role, 'outgoing', p_channel, p_content, p_parent_message_id)
    RETURNING id INTO v_message_id;

    INSERT INTO public.message_deliveries (message_id, channel, status)
    VALUES (v_message_id, p_channel, 'queued');

    UPDATE public.message_threads
    SET last_message_at = now(), 
        last_message_preview = left(p_content, 160),
        updated_at = now()
    WHERE id = p_thread_id;

    RETURN v_message_id;
END $$;

-- Function to schedule a message (if missing)
CREATE OR REPLACE FUNCTION public.schedule_message(
    p_thread_id uuid,
    p_template_id uuid,
    p_channel text,
    p_run_at timestamptz,
    p_payload jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE sql AS $$
    INSERT INTO public.scheduled_messages (thread_id, template_id, channel, run_at, payload)
    VALUES (p_thread_id, p_template_id, p_channel, p_run_at, p_payload)
    RETURNING id;
$$;

-- Function to create a new thread with participants (if missing)
CREATE OR REPLACE FUNCTION public.create_message_thread(
    p_reservation_id uuid,
    p_subject text DEFAULT NULL,
    p_guest_external_address text DEFAULT NULL,
    p_guest_display_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE 
    v_thread_id uuid;
BEGIN
    -- Create the thread
    INSERT INTO public.message_threads (reservation_id, subject)
    VALUES (p_reservation_id, p_subject)
    RETURNING id INTO v_thread_id;

    -- Add guest participant if provided
    IF p_guest_external_address IS NOT NULL THEN
        INSERT INTO public.message_participants (
            thread_id, participant_type, external_address, display_name
        ) VALUES (
            v_thread_id, 'guest', p_guest_external_address, p_guest_display_name
        );
    END IF;

    RETURN v_thread_id;
END $$;

-- Migration: Create set_default_thread_subject function
-- Purpose: Automatically set message_threads.subject to "booking_name booking_lastname" when reservation_id is provided
-- Date: 2025-01-14

CREATE OR REPLACE FUNCTION set_default_thread_subject()
RETURNS TRIGGER AS $$
DECLARE
  v_subject text;
BEGIN
  -- Only fill when subject is empty/null AND we have a reservation_id
  IF (coalesce(trim(NEW.subject), '') = '' AND NEW.reservation_id IS NOT NULL) THEN
    SELECT nullif(trim(concat_ws(' ', r.booking_name, r.booking_lastname)), '')
      INTO v_subject
    FROM public.reservations r
    WHERE r.id = NEW.reservation_id;

    IF v_subject IS NOT NULL THEN
      NEW.subject := v_subject;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the trigger exists (it should already be created from schema_communication.sql)
-- If not, uncomment the following line:
-- CREATE TRIGGER trg_threads_set_subject BEFORE INSERT OR UPDATE OF reservation_id, subject ON message_threads FOR EACH ROW EXECUTE FUNCTION set_default_thread_subject();

-- Make thread_id nullable in scheduled_messages migration
-- This allows scheduled messages to be created before threads exist,
-- with thread creation happening during message processing

-- 1. Make thread_id nullable
ALTER TABLE scheduled_messages 
  ALTER COLUMN thread_id DROP NOT NULL;

-- 2. Add constraint to ensure either thread_id OR reservation_id exists
ALTER TABLE scheduled_messages 
  ADD CONSTRAINT scheduled_messages_thread_or_reservation_check 
  CHECK (thread_id IS NOT NULL OR reservation_id IS NOT NULL);

-- 3. Add index for efficient lookup by reservation_id when thread_id is null
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_reservation_null_thread 
  ON scheduled_messages(reservation_id, status, run_at) 
  WHERE thread_id IS NULL;

-- 4. Update the claim function to handle nullable thread_id
CREATE OR REPLACE FUNCTION claim_due_scheduled_messages(
  p_limit int DEFAULT 50,
  p_instance_id text DEFAULT 'default',
  p_lease_seconds int DEFAULT 300
) RETURNS SETOF scheduled_messages
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE scheduled_messages sm
  SET status = 'processing',
      claimed_by = p_instance_id,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      attempts = sm.attempts + 1,
      updated_at = now()
  WHERE sm.id IN (
    SELECT id FROM scheduled_messages
    WHERE status = 'pending'
      AND run_at <= now()
      AND (lease_until IS NULL OR lease_until < now())
      -- Support both legacy (with thread_id) and new (with reservation_id) scheduled messages
      AND (thread_id IS NOT NULL OR reservation_id IS NOT NULL)
    ORDER BY run_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING sm.*;
END $$;

-- 5. Add helper function to resolve thread_id during processing
CREATE OR REPLACE FUNCTION resolve_thread_for_scheduled_message(
  p_scheduled_message_id uuid
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_thread_id uuid;
  v_reservation_id uuid;
BEGIN
  -- Get current thread_id and reservation_id
  SELECT thread_id, reservation_id 
  INTO v_thread_id, v_reservation_id
  FROM scheduled_messages 
  WHERE id = p_scheduled_message_id;
  
  -- If thread_id already exists, return it
  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;
  
  -- If no thread_id but we have reservation_id, find existing thread for that reservation
  IF v_reservation_id IS NOT NULL THEN
    SELECT mt.id INTO v_thread_id
    FROM message_threads mt
    WHERE mt.reservation_id = v_reservation_id
    ORDER BY mt.created_at DESC
    LIMIT 1;
    
    -- If found, update the scheduled message with the resolved thread_id
    IF v_thread_id IS NOT NULL THEN
      UPDATE scheduled_messages 
      SET thread_id = v_thread_id, updated_at = now()
      WHERE id = p_scheduled_message_id;
      
      RETURN v_thread_id;
    END IF;
  END IF;
  
  -- No thread found - application layer will need to create one
  RETURN NULL;
END $$;

-- 6. Comments for documentation
COMMENT ON CONSTRAINT scheduled_messages_thread_or_reservation_check ON scheduled_messages IS 
  'Ensures either thread_id (for existing threads) or reservation_id (for deferred thread creation) is provided';

COMMENT ON FUNCTION resolve_thread_for_scheduled_message IS 
  'Attempts to resolve thread_id for scheduled messages created with null thread_id';

COMMENT ON INDEX idx_scheduled_messages_reservation_null_thread IS 
  'Optimizes lookup of scheduled messages that need thread resolution';

-- Migration complete!
SELECT 'Thread ID Nullable Migration Complete' as status;

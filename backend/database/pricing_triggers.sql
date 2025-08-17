-- Pricing Automation Triggers
-- This file sets up triggers to automatically recalculate pricing when reservations change

-- Function to trigger pricing recalculation (improved to avoid WHEN clause issues)
CREATE OR REPLACE FUNCTION trigger_pricing_recalculation()
RETURNS TRIGGER AS $$
DECLARE
    op TEXT := TG_OP;
    rt_id UUID; 
    sdate DATE; 
    edate DATE;
BEGIN
    IF op = 'INSERT' THEN
        IF NEW.status IN ('confirmed', 'new', 'checked_in', 'completed') THEN
            rt_id := NEW.room_type_id;
            sdate := GREATEST(NEW.check_in_date, CURRENT_DATE);
            edate := NEW.check_out_date - INTERVAL '1 day';
        ELSE
            RETURN NEW;
        END IF;

    ELSIF op = 'UPDATE' THEN
        IF (OLD.room_type_id, OLD.check_in_date, OLD.check_out_date, OLD.status)
           IS DISTINCT FROM
           (NEW.room_type_id, NEW.check_in_date, NEW.check_out_date, NEW.status) THEN

            -- Queue for OLD range if any of those changed
            INSERT INTO pricing_recalc_queue (room_type_id, start_date, end_date, triggered_by)
            VALUES (OLD.room_type_id, GREATEST(OLD.check_in_date, CURRENT_DATE), OLD.check_out_date - INTERVAL '1 day', 'reservation_trigger')
            ON CONFLICT (room_type_id, start_date, end_date) DO UPDATE SET updated_at = NOW();

            -- Queue for NEW
            rt_id := NEW.room_type_id;
            sdate := GREATEST(NEW.check_in_date, CURRENT_DATE);
            edate := NEW.check_out_date - INTERVAL '1 day';
        ELSE
            RETURN NEW;
        END IF;

    ELSIF op = 'DELETE' THEN
        IF OLD.status IN ('confirmed', 'new', 'checked_in', 'completed') THEN
            rt_id := OLD.room_type_id;
            sdate := GREATEST(OLD.check_in_date, CURRENT_DATE);
            edate := OLD.check_out_date - INTERVAL '1 day';
        ELSE
            RETURN OLD;
        END IF;
    END IF;

    IF rt_id IS NOT NULL AND sdate <= edate THEN
        INSERT INTO pricing_recalc_queue (room_type_id, start_date, end_date, triggered_by)
        VALUES (rt_id, sdate, edate, 'reservation_trigger')
        ON CONFLICT (room_type_id, start_date, end_date) DO UPDATE SET updated_at = NOW();
    END IF;

    RETURN CASE WHEN op = 'DELETE' THEN OLD ELSE NEW END;
END; 
$$ LANGUAGE plpgsql;

-- Create pricing recalculation queue table
CREATE TABLE IF NOT EXISTS pricing_recalc_queue (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    triggered_by VARCHAR(50) NOT NULL DEFAULT 'manual',
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_type_id, start_date, end_date)
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_pricing_recalc_queue_pending ON pricing_recalc_queue(status, created_at);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS reservation_pricing_trigger ON reservations;

-- Create the trigger on reservations table (no WHEN clause - logic moved to function)
CREATE TRIGGER reservation_pricing_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_pricing_recalculation();

-- Function to clamp price overrides within room type bounds
CREATE OR REPLACE FUNCTION clamp_price(_room_type_id UUID, _price NUMERIC)
RETURNS NUMERIC AS $$
DECLARE 
    lo NUMERIC; 
    hi NUMERIC;
BEGIN
    SELECT min_price, max_price INTO lo, hi 
    FROM room_types 
    WHERE id = _room_type_id;
    
    -- If no min/max set, return original price
    IF lo IS NULL AND hi IS NULL THEN
        RETURN _price;
    END IF;
    
    -- Apply clamping with proper NULL handling
    RETURN GREATEST(COALESCE(lo, _price), LEAST(COALESCE(hi, _price), _price));
END; 
$$ LANGUAGE plpgsql STABLE;

-- Function to process pricing recalculation queue
CREATE OR REPLACE FUNCTION process_pricing_queue()
RETURNS INT AS $$
DECLARE
    queue_item RECORD;
    processed_count INT := 0;
BEGIN
    -- Process up to 10 items at a time
    FOR queue_item IN 
        SELECT * FROM pricing_recalc_queue 
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT 10
    LOOP
        BEGIN
            -- Mark as processing
            UPDATE pricing_recalc_queue 
            SET status = 'processing', processed_at = NOW()
            WHERE id = queue_item.id;
            
            -- Here we would normally call the pricing service
            -- For now, we'll just mark as completed
            -- In a real implementation, you'd make an HTTP call to /api/pricing/run
            
            -- Mark as completed
            UPDATE pricing_recalc_queue 
            SET status = 'completed', updated_at = NOW()
            WHERE id = queue_item.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark as failed with error message
            UPDATE pricing_recalc_queue 
            SET status = 'failed', error_message = SQLERRM, updated_at = NOW()
            WHERE id = queue_item.id;
        END;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Clean up old completed queue items (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_pricing_queue()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM pricing_recalc_queue 
    WHERE status = 'completed' 
    AND processed_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION trigger_pricing_recalculation() IS 'Automatically queues pricing recalculation when reservations change';
COMMENT ON TABLE pricing_recalc_queue IS 'Queue for automatic pricing recalculation jobs';
COMMENT ON FUNCTION process_pricing_queue() IS 'Processes pending pricing recalculation jobs';

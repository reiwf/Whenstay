-- Message Rules Architecture Migration
-- This migration extends the existing scheduled_messages table and adds the new message rules system

-- 1. Create new enum types for message rule system
DO $$ BEGIN
  CREATE TYPE message_rule_type AS ENUM (
    'ON_CREATE_DELAY_MIN',
    'BEFORE_ARRIVAL_DAYS_AT_TIME',
    'ARRIVAL_DAY_HOURS_BEFORE_CHECKIN',
    'AFTER_CHECKIN_HOURS',
    'BEFORE_CHECKOUT_HOURS',
    'AFTER_DEPARTURE_DAYS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE backfill_policy AS ENUM ('none','skip_if_past','until_checkin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scheduled_status AS ENUM ('pending','processing','sent','failed','canceled','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend scheduled_messages table with new architecture fields
ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz;

-- Update existing status constraint to include new statuses
ALTER TABLE scheduled_messages DROP CONSTRAINT IF EXISTS scheduled_messages_status_check;
ALTER TABLE scheduled_messages ADD CONSTRAINT scheduled_messages_status_check 
  CHECK (status = ANY (ARRAY['queued'::text, 'pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'canceled'::text, 'skipped'::text]));

-- 3. Create message_rules table for admin-configurable message types
CREATE TABLE IF NOT EXISTS message_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references message_templates(id) on delete cascade,
  code text not null, -- 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H' for the 8 message types
  name text not null,
  type message_rule_type not null,
  days integer,
  hours integer,
  at_time time,
  delay_minutes integer,
  backfill backfill_policy not null default 'skip_if_past',
  enabled boolean not null default true,
  channel text not null check (channel in ('inapp','email','sms','whatsapp','airbnb','booking.com')),
  timezone text not null default 'Asia/Tokyo',
  property_id uuid references properties(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Create indexes for optimal performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_sched_idem ON scheduled_messages(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sched_due_lease ON scheduled_messages(status, run_at, lease_until);
CREATE INDEX IF NOT EXISTS idx_message_rules_enabled ON message_rules(enabled, property_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_message_rules_code ON message_rules(code);

-- 5. Enhanced claim function with better lease management
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
    ORDER BY run_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING sm.*;
END $$;

-- 6. Helper functions for managing scheduled messages
CREATE OR REPLACE FUNCTION increment_attempts(p_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE scheduled_messages
  SET attempts = attempts + 1, updated_at = now()
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION cancel_pending_for_reservation(p_res uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE scheduled_messages
  SET status = 'canceled', updated_at = now()
  WHERE reservation_id = p_res
    AND status IN ('pending','processing')
    AND (lease_until IS NULL OR lease_until < now());
$$;

-- 7. Function to generate idempotency key
CREATE OR REPLACE FUNCTION generate_idempotency_key(
  p_rule_id uuid,
  p_reservation_id uuid,
  p_scheduled_at timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_rule_id::text || ':' || p_reservation_id::text || ':' || 
         to_char(p_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
$$;

-- 8. Function to clean up expired leases
CREATE OR REPLACE FUNCTION cleanup_expired_leases()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE scheduled_messages 
  SET status = 'pending',
      claimed_by = NULL,
      lease_until = NULL,
      updated_at = now()
  WHERE status = 'processing' 
    AND lease_until < now() - interval '1 minute';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END $$;

-- 9. Insert default message rule templates for the 8 message types (if not exists)
INSERT INTO message_templates (name, channel, language, content, enabled) VALUES
('A - Welcome Message', 'inapp', 'en', 'Welcome {{guestName}}! Your reservation is confirmed for {{checkInDate}}. We''ll send you check-in details soon.', true),
('B - Pre-Arrival Reminder', 'email', 'en', 'Hi {{guestName}}, your stay at {{propertyName}} is coming up on {{checkInDate}}. Here are some important details...', true),
('C - Check-in Instructions', 'email', 'en', 'Hi {{guestName}}, tomorrow is your check-in day! Here are your access instructions for {{propertyName}}...', true),
('D - Today Check-in Guide', 'inapp', 'en', 'Welcome {{guestName}}! Today is your check-in day. Access time: {{checkInTime}}. Room: {{room}}', true),
('E - Pre-Check-in Reminder', 'inapp', 'en', 'Hi {{guestName}}, your check-in time is approaching. Please be ready at {{checkInTime}}.', true),
('F - Welcome After Check-in', 'inapp', 'en', 'Welcome to {{propertyName}}, {{guestName}}! We hope you enjoy your stay. WiFi: {{wifiName}} / {{wifiPassword}}', true),
('G - Check-out Reminder', 'inapp', 'en', 'Hi {{guestName}}, your check-out time is {{checkOutTime}} tomorrow. Please prepare for departure.', true),
('H - Thank You Message', 'email', 'en', 'Thank you for staying with us, {{guestName}}! We hope you enjoyed your time at {{propertyName}}.', true)
ON CONFLICT (name) DO NOTHING;

-- 10. Insert default message rules for the 8 scenarios
WITH template_mapping AS (
  SELECT *
  FROM (
    VALUES
      ('A - Welcome Message',      'A', 'ON_CREATE_DELAY_MIN',            NULL::int, NULL::int,  5::int, 'skip_if_past',  'inapp'),
      ('B - Pre-Arrival Reminder', 'B', 'BEFORE_ARRIVAL_DAYS_AT_TIME',       3::int, NULL::int, NULL::int,'skip_if_past',  'email'),
      ('C - Check-in Instructions','C', 'BEFORE_ARRIVAL_DAYS_AT_TIME',       1::int, NULL::int, NULL::int,'skip_if_past',  'email'),
      ('D - Today Check-in Guide', 'D', 'BEFORE_ARRIVAL_DAYS_AT_TIME',       0::int, NULL::int, NULL::int,'until_checkin', 'inapp'),
      ('E - Pre-Check-in Reminder','E', 'ARRIVAL_DAY_HOURS_BEFORE_CHECKIN', NULL::int, 2::int,  NULL::int,'until_checkin', 'inapp'),
      ('F - Welcome After Check-in','F','AFTER_CHECKIN_HOURS',              NULL::int, 1::int,  NULL::int,'none',          'inapp'),
      ('G - Check-out Reminder',   'G', 'BEFORE_CHECKOUT_HOURS',            NULL::int,12::int,  NULL::int,'none',          'inapp'),
      ('H - Thank You Message',    'H', 'AFTER_DEPARTURE_DAYS',               1::int, NULL::int, NULL::int,'none',          'email')
  ) AS t(template_name, code, rule_type, days, hours, delay_minutes, backfill, channel)
)
INSERT INTO message_rules
  (template_id, code, name, type, days, hours, delay_minutes, at_time, backfill, enabled, channel, timezone)
SELECT 
  mt.id,
  tm.code,
  tm.template_name,
  tm.rule_type::message_rule_type,
  tm.days,
  tm.hours,
  tm.delay_minutes,
  CASE 
    WHEN tm.rule_type = 'BEFORE_ARRIVAL_DAYS_AT_TIME' AND tm.code = 'B' THEN '10:00'::time
    WHEN tm.rule_type = 'BEFORE_ARRIVAL_DAYS_AT_TIME' AND tm.code = 'C' THEN '14:00'::time
    WHEN tm.rule_type = 'BEFORE_ARRIVAL_DAYS_AT_TIME' AND tm.code = 'D' THEN '09:00'::time
    ELSE NULL 
  END,
  tm.backfill::backfill_policy,
  TRUE,
  tm.channel,
  'Asia/Tokyo'
FROM template_mapping tm
JOIN message_templates mt ON mt.name = tm.template_name
WHERE NOT EXISTS (
  SELECT 1 FROM message_rules mr WHERE mr.code = tm.code
);

-- 11. Add triggers for updated_at on new tables
CREATE TRIGGER trg_message_rules_updated_at
  BEFORE UPDATE ON message_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Comments for documentation
COMMENT ON TABLE message_rules IS 'Admin-configurable message rules for automated scheduling based on reservation events';
COMMENT ON COLUMN message_rules.code IS 'Simple identifier: A, B, C, D, E, F, G, H for the 8 message types';
COMMENT ON COLUMN message_rules.type IS 'Defines when the message should be sent relative to reservation dates';
COMMENT ON COLUMN message_rules.backfill IS 'Policy for handling messages when reservation is created after the scheduled time';
COMMENT ON COLUMN scheduled_messages.idempotency_key IS 'Prevents duplicate message generation: rule_id:reservation_id:scheduled_at_utc';
COMMENT ON COLUMN scheduled_messages.claimed_by IS 'Instance ID that claimed this message for processing';
COMMENT ON COLUMN scheduled_messages.lease_until IS 'Lease expiration to prevent processing conflicts';

COMMENT ON FUNCTION claim_due_scheduled_messages IS 'Atomically claims due scheduled messages with lease-based concurrency control';
COMMENT ON FUNCTION generate_idempotency_key IS 'Generates consistent idempotency keys for preventing duplicate scheduled messages';
COMMENT ON FUNCTION cancel_pending_for_reservation IS 'Cancels all pending/processing messages for a reservation (used when dates change)';
COMMENT ON FUNCTION cleanup_expired_leases IS 'Releases expired leases back to pending status for retry';

-- Migration complete!
SELECT 'Message Rules Architecture Migration Complete' as status;

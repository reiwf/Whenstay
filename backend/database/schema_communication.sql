-- =============================================
-- Communication Feature Database Schema
-- Created for WhensStay Application
-- =============================================

-- 1) Main conversation threads
CREATE TABLE public.message_threads (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    reservation_id uuid NULL REFERENCES public.reservations(id) ON DELETE SET NULL,
    subject text NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','archived')),
    assignee_user_id uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
    last_message_at timestamptz,
    last_message_preview text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Map threads to provider-specific thread IDs
CREATE TABLE public.thread_channels (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('beds24','whatsapp','inapp','email','sms')),
    external_thread_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraints separately to avoid syntax issues
ALTER TABLE public.thread_channels ADD CONSTRAINT unique_thread_channel UNIQUE (thread_id, channel);
ALTER TABLE public.thread_channels ADD CONSTRAINT unique_channel_external_id UNIQUE (channel, external_thread_id);

-- 3) Thread participants
CREATE TABLE public.message_participants (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    participant_type text NOT NULL CHECK (participant_type IN ('guest','host','assistant','cleaner','support','system')),
    user_id uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- for hosts/staff
    external_address text NULL, -- phone/email/beds24 guest ref  
    display_name text NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_read_message_id uuid NULL,
    last_read_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraints with proper syntax
CREATE UNIQUE INDEX unique_participant_user 
    ON public.message_participants (thread_id, participant_type, user_id) 
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX unique_participant_external 
    ON public.message_participants (thread_id, participant_type, external_address) 
    WHERE external_address IS NOT NULL;

-- 4) Individual messages
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    parent_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
    origin_role text NOT NULL CHECK (origin_role IN ('guest','host','assistant','system')),
    direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
    channel text NOT NULL CHECK (channel IN ('beds24','whatsapp','inapp','email','sms')),
    content text NOT NULL,
    sent_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Message delivery tracking
CREATE TABLE public.message_deliveries (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('beds24','whatsapp','inapp','email','sms')),
    provider_message_id text NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
    error_code text NULL,
    error_message text NULL,
    queued_at timestamptz DEFAULT now(),
    sent_at timestamptz NULL,
    delivered_at timestamptz NULL,
    read_at timestamptz NULL,
    body_rendered text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraints
ALTER TABLE public.message_deliveries ADD CONSTRAINT unique_message_channel UNIQUE (message_id, channel);
CREATE UNIQUE INDEX unique_channel_provider_id 
    ON public.message_deliveries (channel, provider_message_id) 
    WHERE provider_message_id IS NOT NULL;

-- 6) Message attachments
CREATE TABLE public.message_attachments (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    storage_bucket text NOT NULL DEFAULT 'message-attachments',
    path text NOT NULL,
    content_type text NULL,
    size_bytes integer NULL,
    width integer NULL,
    height integer NULL,
    duration_seconds numeric NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7) Message templates
CREATE TABLE public.message_templates (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('beds24','whatsapp','inapp','email','sms')),
    language text NULL,
    content text NOT NULL,
    variables jsonb NULL,
    external_template_id text NULL,
    property_id uuid NULL REFERENCES public.properties(id) ON DELETE SET NULL,
    created_by uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- 8) Automation rules (create this BEFORE scheduled_messages to avoid forward reference)
CREATE TABLE public.automation_rules (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    name text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    trigger_type text NOT NULL CHECK (trigger_type IN ('relative_to_reservation','absolute_time')),
    event text NULL CHECK (event IN ('booking_created','check_in','check_out','payment_due')),
    offset_json jsonb NULL,
    property_id uuid NULL REFERENCES public.properties(id) ON DELETE SET NULL,
    template_id uuid NOT NULL REFERENCES public.message_templates(id),
    channel text NOT NULL CHECK (channel IN ('beds24','whatsapp','inapp','email','sms')),
    filters jsonb NULL,
    options jsonb NULL,
    created_by uuid NULL REFERENCES public.user_profiles(id),
    created_at timestamptz DEFAULT now()
);

-- 9) Scheduled messages
CREATE TABLE public.scheduled_messages (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE RESTRICT,
    reservation_id uuid NULL REFERENCES public.reservations(id) ON DELETE SET NULL,
    rule_id uuid NULL REFERENCES public.automation_rules(id) ON DELETE SET NULL,
    channel text NOT NULL CHECK (channel IN ('beds24','whatsapp','inapp','email','sms')),
    run_at timestamptz NOT NULL,
    payload jsonb NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','canceled','failed')),
    last_error text NULL,
    locked_at timestamptz NULL,
    attempts int NOT NULL DEFAULT 0,
    cancellation_reason text NULL,
    created_by uuid NULL REFERENCES public.user_profiles(id),
    created_at timestamptz DEFAULT now()
);

-- Add unique constraint
ALTER TABLE public.scheduled_messages ADD CONSTRAINT unique_thread_template_runtime UNIQUE (thread_id, template_id, run_at);

-- 10) Guest channel consents for compliance
CREATE TABLE public.guest_channel_consents (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
    consent_given boolean NOT NULL DEFAULT false,
    consent_at timestamptz NULL,
    created_at timestamptz DEFAULT now()
);

-- Add unique constraint
ALTER TABLE public.guest_channel_consents ADD CONSTRAINT unique_reservation_channel UNIQUE (reservation_id, channel);

-- 11) Thread labels for categorization
CREATE TABLE public.thread_labels (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
    label text NOT NULL,
    color text NULL,
    created_at timestamptz DEFAULT now()
);

-- Add unique constraint
ALTER TABLE public.thread_labels ADD CONSTRAINT unique_thread_label UNIQUE (thread_id, label);

-- =============================================
-- INDEXES for Performance
-- =============================================

CREATE INDEX idx_message_threads_reservation_id ON public.message_threads (reservation_id);
CREATE INDEX idx_message_threads_status_last_message ON public.message_threads (status, last_message_at DESC);
CREATE INDEX idx_message_threads_assignee ON public.message_threads (assignee_user_id);

CREATE INDEX idx_thread_channels_thread_id ON public.thread_channels (thread_id);
CREATE INDEX idx_thread_channels_channel ON public.thread_channels (channel);

CREATE INDEX idx_message_participants_thread_id ON public.message_participants (thread_id);
CREATE INDEX idx_message_participants_user_id ON public.message_participants (user_id);

CREATE INDEX idx_messages_thread_created ON public.messages (thread_id, created_at DESC);
CREATE INDEX idx_messages_origin_role ON public.messages (origin_role);
CREATE INDEX idx_messages_channel ON public.messages (channel);

CREATE INDEX idx_message_deliveries_status_channel ON public.message_deliveries (status, channel);
CREATE INDEX idx_message_deliveries_message_id ON public.message_deliveries (message_id);

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments (message_id);

CREATE INDEX idx_message_templates_property_id ON public.message_templates (property_id);
CREATE INDEX idx_message_templates_channel ON public.message_templates (channel);

CREATE INDEX idx_scheduled_messages_status_run_at ON public.scheduled_messages (status, run_at);
CREATE INDEX idx_scheduled_messages_thread_id ON public.scheduled_messages (thread_id);
CREATE INDEX idx_scheduled_messages_reservation_id ON public.scheduled_messages (reservation_id);

CREATE INDEX idx_automation_rules_enabled_property ON public.automation_rules (enabled, property_id) WHERE enabled = true;
CREATE INDEX idx_automation_rules_trigger_type ON public.automation_rules (trigger_type);

-- Full-text search on message content
ALTER TABLE public.messages ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content,''))) STORED;
CREATE INDEX messages_content_tsv_idx ON public.messages USING gin (content_tsv);

-- Unique index for preventing duplicate scheduled messages per rule/reservation
CREATE UNIQUE INDEX idx_scheduled_messages_rule_reservation_queued 
    ON public.scheduled_messages (rule_id, reservation_id)
    WHERE status = 'queued';

-- =============================================
-- TRIGGERS & FUNCTIONS
-- =============================================

-- Helper Functions (using existing update_updated_at_column function)
CREATE TRIGGER trg_threads_updated BEFORE UPDATE ON public.message_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS FOR API
-- =============================================

-- Function to send a message
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

    INSERT INTO public.message_deliveries (message_id, channel, status, queued_at)
    VALUES (v_message_id, p_channel, 'queued', now());

    UPDATE public.message_threads
    SET last_message_at = now(), 
        last_message_preview = left(p_content, 160),
        updated_at = now()
    WHERE id = p_thread_id;

    RETURN v_message_id;
END $$;

-- Function to schedule a message
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

-- Function to safely claim due scheduled messages for cron worker
CREATE OR REPLACE FUNCTION public.claim_due_scheduled_messages(p_limit int DEFAULT 50)
RETURNS SETOF public.scheduled_messages
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH c AS (
        SELECT id FROM public.scheduled_messages
        WHERE status='queued'
          AND run_at <= now()
          AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
        ORDER BY run_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.scheduled_messages sm
    SET locked_at = now(), attempts = sm.attempts + 1
    FROM c
    WHERE sm.id = c.id
    RETURNING sm.*;
END $$;

-- Function to create a new thread with participants
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

-- Function to mark messages as read
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

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- Insert some sample message templates
INSERT INTO public.message_templates (name, channel, language, content, variables, property_id) VALUES
('Welcome Message', 'inapp', 'en', 'Welcome to {{property_name}}! Your check-in is scheduled for {{check_in_date}}.', '{"property_name": "string", "check_in_date": "date"}', NULL),
('Check-in Reminder', 'email', 'en', 'Hi {{guest_name}}, this is a reminder that your check-in at {{property_name}} is tomorrow at {{check_in_time}}.', '{"guest_name": "string", "property_name": "string", "check_in_time": "time"}', NULL),
('Thank You', 'inapp', 'en', 'Thank you for staying with us! We hope you enjoyed your time at {{property_name}}.', '{"property_name": "string"}', NULL);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all communication tables
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_channel_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_labels ENABLE ROW LEVEL SECURITY;

-- Policy for message_threads: Users can only see threads for their properties
CREATE POLICY message_threads_policy ON public.message_threads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.reservations r
            JOIN public.properties p ON r.property_id = p.id
            WHERE r.id = message_threads.reservation_id
            AND (p.owner_id = auth.uid() OR auth.uid() IN (
                SELECT id FROM public.user_profiles WHERE role = 'admin'
            ))
        )
    );

-- Policy for messages: Users can only see messages in threads they have access to
CREATE POLICY messages_policy ON public.messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.message_threads mt
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE mt.id = messages.thread_id
            AND (p.owner_id = auth.uid() OR auth.uid() IN (
                SELECT id FROM public.user_profiles WHERE role = 'admin'
            ))
        )
    );

-- Similar policies for other tables
CREATE POLICY thread_channels_policy ON public.thread_channels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.message_threads mt
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE mt.id = thread_channels.thread_id
            AND (p.owner_id = auth.uid() OR auth.uid() IN (
                SELECT id FROM public.user_profiles WHERE role = 'admin'
            ))
        )
    );

CREATE POLICY message_participants_policy ON public.message_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.message_threads mt
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE mt.id = message_participants.thread_id
            AND (p.owner_id = auth.uid() OR auth.uid() IN (
                SELECT id FROM public.user_profiles WHERE role = 'admin'
            ))
        )
    );

-- Templates policy: Users can see templates for their properties or global templates
CREATE POLICY message_templates_policy ON public.message_templates
    FOR ALL USING (
        property_id IS NULL OR EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = message_templates.property_id
            AND (p.owner_id = auth.uid() OR auth.uid() IN (
                SELECT id FROM public.user_profiles WHERE role = 'admin'
            ))
        )
    );

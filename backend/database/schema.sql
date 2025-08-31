--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: cleaning_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cleaning_priority AS ENUM (
    'normal',
    'high'
);


--
-- Name: cleaning_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cleaning_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: cleaning_task_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cleaning_task_type AS ENUM (
    'checkout',
    'eco',
    'deep_clean'
);


--
-- Name: reservation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reservation_status AS ENUM (
    'pending',
    'invited',
    'completed',
    'cancelled',
    'confirmed',
    'checked_in',
    'checked_out',
    'no_show',
    'new'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'owner',
    'guest',
    'cleaner'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: can_unsend_message(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_unsend_message(message_id uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
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


--
-- Name: FUNCTION can_unsend_message(message_id uuid, user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_unsend_message(message_id uuid, user_id uuid) IS 'Checks if a message can be unsent by a specific user based on time limits, channel, and permissions';


--
-- Name: cancel_cleaning_task_if_res_cancelled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_cleaning_task_if_res_cancelled() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE cleaning_tasks
    SET status = 'cancelled'
    WHERE reservation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_same_day_checkin(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_same_day_checkin(checkout_date date, unit_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$DECLARE
         same_day_checkin_count integer;
       BEGIN
         SELECT COUNT(*) INTO same_day_checkin_count
         FROM reservations 
         WHERE room_unit_id = unit_id 
           AND check_in_date = checkout_date
           AND status IN ('confirmed', 'new', 'checked_in');
           
         RETURN same_day_checkin_count > 0;
       END;$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: scheduled_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    template_id uuid NOT NULL,
    reservation_id uuid,
    rule_id uuid,
    channel text NOT NULL,
    run_at timestamp with time zone NOT NULL,
    payload jsonb,
    status text DEFAULT 'queued'::text NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    cancellation_reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT scheduled_messages_channel_check CHECK ((channel = ANY (ARRAY['airbnb'::text, 'booking'::text, 'whatsapp'::text, 'inapp'::text, 'email'::text, 'sms'::text]))),
    CONSTRAINT scheduled_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'canceled'::text, 'failed'::text])))
);


--
-- Name: claim_due_scheduled_messages(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_due_scheduled_messages(p_limit integer DEFAULT 50) RETURNS SETOF public.scheduled_messages
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: clamp_price(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clamp_price(_room_type_id uuid, _price numeric) RETURNS numeric
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;


--
-- Name: cleanup_pricing_queue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_pricing_queue() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM pricing_recalc_queue 
    WHERE status = 'completed' 
    AND processed_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: create_cleaning_task_for_reservation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_cleaning_task_for_reservation(reservation_uuid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
       DECLARE
         res_record RECORD;
         default_cleaner_id uuid;
         is_priority boolean;
       BEGIN
         SELECT * INTO res_record FROM reservations WHERE id = reservation_uuid;
         
         IF res_record.room_unit_id IS NULL THEN
           RETURN;
         END IF;
         
         SELECT get_property_default_cleaner(res_record.room_unit_id) INTO default_cleaner_id;
         SELECT check_same_day_checkin(res_record.check_out_date, res_record.room_unit_id) INTO is_priority;
         
         IF EXISTS (SELECT 1 FROM cleaning_tasks WHERE reservation_id = reservation_uuid) THEN
           RETURN;
         END IF;
         
         INSERT INTO cleaning_tasks (
           reservation_id,
           room_unit_id,
           task_date,
           task_type,
           priority,
           assigned_cleaner_id
         ) VALUES (
           reservation_uuid,
           res_record.room_unit_id,
           res_record.check_out_date,
           'checkout',
           is_priority,
           default_cleaner_id
         );
       END;
       $$;


--
-- Name: create_message_thread(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_message_thread(p_reservation_id uuid, p_subject text DEFAULT NULL::text, p_guest_external_address text DEFAULT NULL::text, p_guest_display_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: daterange_overlaps(date, date, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.daterange_overlaps(a_start date, a_end date, b_start date, b_end date) RETURNS boolean
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
    SELECT a_start < b_end AND b_start < a_end;
$$;


--
-- Name: enforce_cleaner_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_cleaner_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    user_role text;
begin
    -- Skip if cleaner_id is null
    if new.cleaner_id is null then
        return new;
    end if;

    -- Check if this user has cleaner role
    select role into user_role
    from user_profiles
    where id = new.cleaner_id;

    if user_role is distinct from 'cleaner' then
        raise exception 'User % is not a cleaner', new.cleaner_id;
    end if;

    return new;
end;
$$;


--
-- Name: execute(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute(query text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE query;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error executing query: %', SQLERRM;
END;
$$;


--
-- Name: extract_email_threading_info(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_email_threading_info(webhook_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN jsonb_build_object(
    'messageId', COALESCE(webhook_data->>'messageId', webhook_data->'message-id'->>'value'),
    'inReplyTo', COALESCE(webhook_data->>'inReplyTo', webhook_data->'in-reply-to'->>'value'),
    'references', COALESCE(webhook_data->>'references', webhook_data->'references'->>'value'),
    'threadId', webhook_data->>'threadId',
    'subject', webhook_data->>'subject'
  );
END;
$$;


--
-- Name: find_thread_by_email_data(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_thread_by_email_data(email_message_id text DEFAULT NULL::text, email_in_reply_to text DEFAULT NULL::text, email_thread_id text DEFAULT NULL::text, sender_email text DEFAULT NULL::text) RETURNS TABLE(thread_id uuid, match_method text, confidence text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Priority 1: Match by In-Reply-To (highest confidence)
  IF email_in_reply_to IS NOT NULL THEN
    RETURN QUERY
    SELECT mt.id, 'in_reply_to'::TEXT, 'high'::TEXT
    FROM message_threads mt
    INNER JOIN messages m ON m.thread_id = mt.id
    INNER JOIN email_metadata em ON em.message_id = m.id
    WHERE em.email_message_id = email_in_reply_to
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 2: Match by Gmail Thread ID (high confidence)
  IF email_thread_id IS NOT NULL THEN
    RETURN QUERY
    SELECT mt.id, 'email_thread_id'::TEXT, 'high'::TEXT
    FROM message_threads mt
    INNER JOIN messages m ON m.thread_id = mt.id
    INNER JOIN email_metadata em ON em.message_id = m.id
    WHERE em.email_thread_id = email_thread_id
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 3: Match by sender email to recent active thread (medium confidence)
  IF sender_email IS NOT NULL THEN
    RETURN QUERY
    SELECT mt.id, 'sender_email'::TEXT, 'medium'::TEXT
    FROM message_threads mt
    INNER JOIN reservations r ON r.id = mt.reservation_id
    WHERE (r.guest_email = sender_email OR r.booking_email = sender_email)
      AND mt.status IN ('open', 'closed')
      AND r.check_out_date >= (CURRENT_DATE - INTERVAL '30 days')
    ORDER BY mt.last_message_at DESC NULLS LAST
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- No match found
  RETURN;
END;
$$;


--
-- Name: generate_checkin_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_checkin_token() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    token TEXT;
BEGIN
    LOOP
        -- Generate random 8-digit number
        token := lpad((trunc(random() * 90000000) + 10000000)::text, 8, '0');
        -- Check if it exists
        EXIT WHEN NOT EXISTS (SELECT 1 FROM reservations WHERE check_in_token = token);
    END LOOP;
    NEW.check_in_token := token;
    RETURN NEW;
END;
$$;


--
-- Name: get_calendar_timeline(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_calendar_timeline(p_property_id uuid, p_start_date date DEFAULT (CURRENT_DATE - '1 day'::interval), p_end_date date DEFAULT (CURRENT_DATE + '29 days'::interval)) RETURNS TABLE(room_type_id uuid, room_type_name text, room_type_order integer, room_unit_id uuid, room_unit_number text, reservation_id uuid, segment_id uuid, booking_name text, start_date date, end_date date, status text, color text, label text, is_segment boolean)
    LANGUAGE sql STABLE
    AS $$-- First get ALL room units for the property (including those with no reservations)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        ru.id as room_unit_id,
        ru.unit_number as room_unit_number,
        NULL::uuid as reservation_id,
        NULL::uuid as segment_id,
        NULL::text as booking_name,
        NULL::date as start_date,
        NULL::date as end_date,
        NULL::text as status,
        NULL::text as color,
        NULL::text as label,
        false as is_segment
    FROM room_types rt
    JOIN room_units ru ON rt.id = ru.room_type_id
    WHERE rt.property_id = p_property_id
    AND rt.is_active = true
    AND ru.is_active = true
    AND NOT EXISTS (
        -- Only include empty room rows if there are no reservations for this room in date range
        SELECT 1 FROM reservations r 
        WHERE r.room_unit_id = ru.id 
        AND r.check_in_date <= p_end_date
        AND r.check_out_date > p_start_date
        AND r.status::text <> 'cancelled'
        AND NOT EXISTS (
            SELECT 1 FROM reservation_segments rs WHERE rs.reservation_id = r.id
        )
        UNION ALL
        SELECT 1 FROM reservation_segments rs
        JOIN reservations r2 ON rs.reservation_id = r2.id
        WHERE rs.room_unit_id = ru.id
        AND rs.start_date <= p_end_date
        AND rs.end_date > p_start_date
        AND r2.status::text <> 'cancelled'
    )
    
    UNION ALL
    
    -- Then get regular reservations (not split into segments)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        ru.id as room_unit_id,
        ru.unit_number as room_unit_number,
        r.id as reservation_id,
        NULL::uuid as segment_id,
        r.booking_name,
        r.check_in_date as start_date,
        r.check_out_date as end_date,
        r.status::text,
        CASE r.status::text
            WHEN 'confirmed' THEN '#3b82f6'
            WHEN 'checked_in' THEN '#10b981'
            WHEN 'checked_out' THEN '#6b7280'
            WHEN 'cancelled' THEN '#ef4444'
            ELSE '#b5945a'
        END as color,
        r.booking_name as label,
        false as is_segment
    FROM reservations r
    JOIN room_units ru ON r.room_unit_id = ru.id
    JOIN room_types rt ON ru.room_type_id = rt.id
    WHERE rt.property_id = p_property_id
    AND r.check_in_date <= p_end_date
    AND r.check_out_date > p_start_date
    AND r.status::text <> 'cancelled'
    AND NOT EXISTS (
        -- Exclude reservations that have been split into segments
        SELECT 1 FROM reservation_segments rs 
        WHERE rs.reservation_id = r.id
    )
    
    UNION ALL
    
    -- Then get reservation segments (for split reservations)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        ru.id as room_unit_id,
        ru.unit_number as room_unit_number,
        r.id as reservation_id,
        rs.id as segment_id,
        r.booking_name,
        rs.start_date,
        rs.end_date,
        r.status::text,
        COALESCE(rs.color, 
            CASE r.status::text
                WHEN 'confirmed' THEN '#3b82f6'
                WHEN 'checked_in' THEN '#10b981'
                WHEN 'checked_out' THEN '#6b7280'
                WHEN 'cancelled' THEN '#ef4444'
                ELSE '#b5945a'
            END
        ) as color,
        COALESCE(rs.label, r.booking_name) as label,
        true as is_segment
    FROM reservation_segments rs
    JOIN reservations r ON rs.reservation_id = r.id
    JOIN room_units ru ON rs.room_unit_id = ru.id
    JOIN room_types rt ON ru.room_type_id = rt.id
    WHERE rt.property_id = p_property_id
    AND rs.start_date <= p_end_date
    AND rs.end_date > p_start_date
    AND r.status::text <> 'cancelled'
    
    UNION ALL
    
    -- Finally get unassigned reservations (room_unit_id IS NULL)
    SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        ROW_NUMBER() OVER (ORDER BY rt.sort_order) as room_type_order,
        NULL::uuid as room_unit_id,
        'UNASSIGNED' as room_unit_number,
        r.id as reservation_id,
        NULL::uuid as segment_id,
        r.booking_name,
        r.check_in_date as start_date,
        r.check_out_date as end_date,
        r.status::text,
        '#f59e0b' as color, -- Orange color for unassigned
        r.booking_name as label,
        false as is_segment
    FROM reservations r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE rt.property_id = p_property_id
    AND r.room_unit_id IS NULL
    AND r.check_in_date <= p_end_date
    AND r.check_out_date > p_start_date
    AND r.status::text <> 'cancelled'
    AND NOT EXISTS (
        -- Exclude reservations that have been split into segments
        SELECT 1 FROM reservation_segments rs 
        WHERE rs.reservation_id = r.id
    )
    
    ORDER BY room_type_name, room_unit_number, start_date;$$;


--
-- Name: get_dashboard_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalReservations', (SELECT COUNT(*) FROM reservations),
        'completedCheckins', (SELECT COUNT(*) FROM reservations WHERE status = 'completed'),
        'pendingCheckins', (SELECT COUNT(*) FROM reservations WHERE status = 'invited'),
        'verifiedCheckins', (SELECT COUNT(*) FROM guest_checkins WHERE admin_verified = true),
        'todayCheckins', (SELECT COUNT(*) FROM reservations WHERE check_in_date = CURRENT_DATE),
        'upcomingCheckins', (SELECT COUNT(*) FROM reservations WHERE check_in_date > CURRENT_DATE AND check_in_date <= CURRENT_DATE + INTERVAL '7 days'),
        'totalProperties', (SELECT COUNT(*) FROM properties),
        'totalRooms', (SELECT COUNT(*) FROM rooms),
        'totalUsers', (SELECT COUNT(*) FROM user_profiles),
        'pendingCleaningTasks', (SELECT COUNT(*) FROM cleaning_tasks WHERE status = 'pending'),
        'completedCleaningTasks', (SELECT COUNT(*) FROM cleaning_tasks WHERE status = 'completed')
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_email_metadata(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_email_metadata(p_message_id uuid) RETURNS TABLE(email_message_id text, email_thread_id text, email_in_reply_to text, email_references text, email_name text, email_provider_data jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.email_message_id,
    em.email_thread_id,
    em.email_in_reply_to,
    em.email_references,
    em.email_name,
    em.email_provider_data
  FROM email_metadata em
  WHERE em.message_id = p_message_id;
END;
$$;


--
-- Name: get_group_reservations(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_group_reservations(master_booking_id text) RETURNS TABLE(id uuid, beds24_booking_id character varying, booking_name character varying, room_unit_id uuid, unit_number character varying, room_type_name character varying, is_group_master boolean, check_in_date date, check_out_date date, status text, total_amount numeric)
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


--
-- Name: FUNCTION get_group_reservations(master_booking_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_group_reservations(master_booking_id text) IS 'Returns all reservations that belong to a specific group booking';


--
-- Name: get_guest_dashboard_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_guest_dashboard_data(reservation_token uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'reservation', json_build_object(
            'id', r.id,
            'guest_name', r.guest_name,
            'check_in_date', r.check_in_date,
            'check_out_date', r.check_out_date,
            'num_guests', r.num_guests,
            'status', r.status
        ),
        'property', json_build_object(
            'name', p.name,
            'address', p.address,
            'wifi_name', p.wifi_name,
            'wifi_password', p.wifi_password,
            'house_rules', p.house_rules,
            'check_in_instructions', p.check_in_instructions,
            'emergency_contact', p.emergency_contact,
            'amenities', p.property_amenities
        ),
        'room', json_build_object(
            'room_number', rm.room_number,
            'room_name', rm.room_name,
            'access_code', rm.access_code,
            'access_instructions', rm.access_instructions,
            'amenities', rm.room_amenities,
            'max_guests', rm.max_guests,
            'bed_configuration', rm.bed_configuration
        ),
        'checkin_status', CASE 
            WHEN gc.id IS NOT NULL THEN 'completed'
            ELSE 'pending'
        END
    ) INTO result
    FROM reservations r
    LEFT JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN properties p ON rm.property_id = p.id
    LEFT JOIN guest_checkins gc ON r.id = gc.reservation_id
    WHERE r.check_in_token = reservation_token;
    
    RETURN result;
END;
$$;


--
-- Name: get_owner_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_owner_stats(owner_uuid uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
BEGIN
    SELECT json_build_object(
        'monthlyRevenue', COALESCE(SUM(CASE 
            WHEN r.status = 'completed' 
            AND r.check_in_date >= start_date 
            AND r.check_in_date <= end_date 
            THEN r.total_amount 
        END), 0),
        'occupancyRate', ROUND(
            (COUNT(CASE 
                WHEN r.check_in_date >= start_date 
                AND r.check_in_date <= end_date 
                THEN 1 
            END)::DECIMAL / EXTRACT(DAY FROM end_date)) * 100, 2
        ),
        'averageDailyRate', COALESCE(AVG(CASE 
            WHEN r.status = 'completed' 
            AND r.check_in_date >= start_date 
            AND r.check_in_date <= end_date 
            THEN r.total_amount 
        END), 0),
        'upcomingReservations', COUNT(CASE 
            WHEN r.check_in_date > CURRENT_DATE 
            AND r.check_in_date <= CURRENT_DATE + INTERVAL '7 days' 
            THEN 1 
        END),
        'totalProperties', COUNT(DISTINCT p.id),
        'totalRooms', COUNT(DISTINCT rm.id),
        'pendingCleaningTasks', COUNT(CASE 
            WHEN ct.status = 'pending' 
            THEN 1 
        END)
    ) INTO result
    FROM properties p
    LEFT JOIN rooms rm ON p.id = rm.property_id
    LEFT JOIN reservations r ON rm.id = r.room_id
    LEFT JOIN cleaning_tasks ct ON rm.id = ct.room_id
    WHERE p.owner_id = owner_uuid;
    
    RETURN result;
END;
$$;


--
-- Name: get_property_default_cleaner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_default_cleaner(unit_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
       DECLARE
         default_cleaner_id uuid;
       BEGIN
         SELECT p.default_cleaner_id INTO default_cleaner_id
         FROM properties p
         JOIN room_types rt ON p.id = rt.property_id
         JOIN room_units ru ON rt.id = ru.room_type_id
         WHERE ru.id = unit_id;
         
         RETURN default_cleaner_id;
       END;
       $$;


--
-- Name: get_property_room_hierarchy(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_room_hierarchy(p_property_id uuid) RETURNS TABLE(room_type_id uuid, room_type_name text, room_type_description text, max_guests integer, room_units jsonb)
    LANGUAGE sql STABLE
    AS $$SELECT 
        rt.id as room_type_id,
        rt.name as room_type_name,
        rt.description as room_type_description,
        rt.max_guests,
        jsonb_agg(
            jsonb_build_object(
                'id', ru.id,
                'unit_number', ru.unit_number,
                'floor_number', ru.floor_number,
                'is_active', ru.is_active
            ) ORDER BY ru.unit_number
        ) as room_units
    FROM room_types rt
    LEFT JOIN room_units ru ON rt.id = ru.room_type_id AND ru.is_active = true
    WHERE rt.property_id = p_property_id
    AND rt.is_active = true
    GROUP BY rt.id, rt.name, rt.description, rt.max_guests, rt.sort_order
    ORDER BY rt.sort_order;$$;


--
-- Name: get_room_type_translated_text(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_room_type_translated_text(p_room_type_id uuid, p_field_name character varying, p_language_code character varying DEFAULT 'en'::character varying) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    translated_text TEXT;
    fallback_text TEXT;
BEGIN
    -- Try to get translation in requested language
    SELECT rt.translated_text INTO translated_text
    FROM room_type_translations rt
    WHERE rt.room_type_id = p_room_type_id
      AND rt.field_name = p_field_name
      AND rt.language_code = p_language_code;
    
    -- If translation found, return it
    IF translated_text IS NOT NULL THEN
        RETURN translated_text;
    END IF;
    
    -- Fallback to English if not found
    IF p_language_code != 'en' THEN
        SELECT rt.translated_text INTO translated_text
        FROM room_type_translations rt
        WHERE rt.room_type_id = p_room_type_id
          AND rt.field_name = p_field_name
          AND rt.language_code = 'en';
        
        IF translated_text IS NOT NULL THEN
            RETURN translated_text;
        END IF;
    END IF;
    
    -- Final fallback to original room_types field
    CASE p_field_name
        WHEN 'name' THEN
            SELECT name INTO fallback_text FROM room_types WHERE id = p_room_type_id;
        WHEN 'description' THEN
            SELECT description INTO fallback_text FROM room_types WHERE id = p_room_type_id;
        WHEN 'bed_configuration' THEN
            SELECT bed_configuration INTO fallback_text FROM room_types WHERE id = p_room_type_id;
    END CASE;
    
    RETURN COALESCE(fallback_text, '');
END;
$$;


--
-- Name: FUNCTION get_room_type_translated_text(p_room_type_id uuid, p_field_name character varying, p_language_code character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_room_type_translated_text(p_room_type_id uuid, p_field_name character varying, p_language_code character varying) IS 'Helper function to retrieve translated room type text with fallback logic';


--
-- Name: get_thread_gmail_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_thread_gmail_context(p_thread_id uuid) RETURNS TABLE(latest_gmail_message_id text, gmail_thread_id text, in_reply_to text, email_references text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.email_message_id,
    em.email_thread_id,
    em.email_in_reply_to,
    em.email_references
  FROM messages m
  INNER JOIN email_metadata em ON em.message_id = m.id
  WHERE m.thread_id = p_thread_id
    AND m.channel = 'email'
    AND em.email_message_id IS NOT NULL
  ORDER BY m.created_at DESC
  LIMIT 1;
END;
$$;


--
-- Name: get_translated_text(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_translated_text(p_property_id uuid, p_field_name character varying, p_language_code character varying DEFAULT 'en'::character varying) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    translated_text TEXT;
    fallback_text TEXT;
BEGIN
    -- Try to get translation in requested language
    SELECT pt.translated_text INTO translated_text
    FROM property_translations pt
    WHERE pt.property_id = p_property_id
      AND pt.field_name = p_field_name
      AND pt.language_code = p_language_code;
    
    -- If translation found, return it
    IF translated_text IS NOT NULL THEN
        RETURN translated_text;
    END IF;
    
    -- Fallback to English if not found
    IF p_language_code != 'en' THEN
        SELECT pt.translated_text INTO translated_text
        FROM property_translations pt
        WHERE pt.property_id = p_property_id
          AND pt.field_name = p_field_name
          AND pt.language_code = 'en';
        
        IF translated_text IS NOT NULL THEN
            RETURN translated_text;
        END IF;
    END IF;
    
    -- Final fallback to original property field
    CASE p_field_name
        WHEN 'house_rules' THEN
            SELECT house_rules INTO fallback_text FROM properties WHERE id = p_property_id;
        WHEN 'description' THEN
            SELECT description INTO fallback_text FROM properties WHERE id = p_property_id;
        WHEN 'luggage_info' THEN
            SELECT luggage_info INTO fallback_text FROM properties WHERE id = p_property_id;
        WHEN 'check_in_instructions' THEN
            SELECT check_in_instructions INTO fallback_text FROM properties WHERE id = p_property_id;
    END CASE;
    
    RETURN COALESCE(fallback_text, '');
END;
$$;


--
-- Name: FUNCTION get_translated_text(p_property_id uuid, p_field_name character varying, p_language_code character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_translated_text(p_property_id uuid, p_field_name character varying, p_language_code character varying) IS 'Helper function to retrieve translated text with fallback logic';


--
-- Name: handle_reservation_cleaning_task(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_reservation_cleaning_task() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.room_unit_id IS NOT NULL AND NEW.status IN ('confirmed', 'checked_in') THEN
            PERFORM create_cleaning_task_for_reservation(NEW.id);
            PERFORM update_cleaning_task_priorities(NEW.check_out_date, NEW.room_unit_id);
          END IF;
          RETURN NEW;
        END IF;
        
        IF TG_OP = 'UPDATE' THEN
          IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' AND NEW.room_unit_id IS NOT NULL THEN
            PERFORM create_cleaning_task_for_reservation(NEW.id);
            PERFORM update_cleaning_task_priorities(NEW.check_out_date, NEW.room_unit_id);
          END IF;
          
          IF OLD.check_out_date != NEW.check_out_date AND NEW.room_unit_id IS NOT NULL THEN
            UPDATE cleaning_tasks 
            SET task_date = NEW.check_out_date,
                priority = check_same_day_checkin(NEW.check_out_date, NEW.room_unit_id)
            WHERE reservation_id = NEW.id;
            
            PERFORM update_cleaning_task_priorities(OLD.check_out_date, COALESCE(NEW.room_unit_id, OLD.room_unit_id));
            PERFORM update_cleaning_task_priorities(NEW.check_out_date, NEW.room_unit_id);
          END IF;
          
          IF OLD.room_unit_id != NEW.room_unit_id AND NEW.room_unit_id IS NOT NULL THEN
            UPDATE cleaning_tasks 
            SET room_unit_id = NEW.room_unit_id,
                priority = check_same_day_checkin(NEW.check_out_date, NEW.room_unit_id),
                assigned_cleaner_id = get_property_default_cleaner(NEW.room_unit_id)
            WHERE reservation_id = NEW.id;
            
            IF OLD.room_unit_id IS NOT NULL THEN
              PERFORM update_cleaning_task_priorities(NEW.check_out_date, OLD.room_unit_id);
            END IF;
            PERFORM update_cleaning_task_priorities(NEW.check_out_date, NEW.room_unit_id);
          END IF;
          
          IF NEW.status = 'cancelled' THEN
            UPDATE cleaning_tasks 
            SET status = 'cancelled'
            WHERE reservation_id = NEW.id AND status = 'pending';
          END IF;
          
          RETURN NEW;
        END IF;
        
        IF TG_OP = 'DELETE' THEN
          IF OLD.room_unit_id IS NOT NULL THEN
            PERFORM update_cleaning_task_priorities(OLD.check_out_date, OLD.room_unit_id);
          END IF;
          RETURN OLD;
        END IF;
        
        RETURN NULL;
      END;
      $$;


--
-- Name: is_room_available(uuid, date, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_room_available(p_room_unit_id uuid, p_start_date date, p_end_date date, p_exclude_reservation_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$SELECT NOT EXISTS (
        -- Check regular reservations
        SELECT 1 FROM reservations r
        WHERE r.room_unit_id = p_room_unit_id
        AND r.status::text NOT IN ('cancelled', 'no_show')
        AND public.daterange_overlaps(r.check_in_date, r.check_out_date, p_start_date, p_end_date)
        AND (p_exclude_reservation_id IS NULL OR r.id != p_exclude_reservation_id)
        
        UNION
        
        -- Check reservation segments
        SELECT 1 FROM reservation_segments rs
        JOIN reservations r ON rs.reservation_id = r.id
        WHERE rs.room_unit_id = p_room_unit_id
        AND r.status::text NOT IN ('cancelled', 'no_show')
        AND public.daterange_overlaps(rs.start_date, rs.end_date, p_start_date, p_end_date)
        AND (p_exclude_reservation_id IS NULL OR r.id != p_exclude_reservation_id)
    );$$;


--
-- Name: maintain_group_booking_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_group_booking_consistency() RETURNS trigger
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


--
-- Name: manage_cleaning_task(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_cleaning_task() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. Delete old cleaning task if room or checkout date changed
    DELETE FROM cleaning_tasks
    WHERE reservation_id = NEW.id;

    -- 2. Insert new cleaning task
    INSERT INTO cleaning_tasks (
        property_id,
        room_unit_id,
        reservation_id,
        cleaner_id,
        task_date,
        task_type,
        status,
        priority,
        created_at,
        updated_at
    )
    VALUES (
        NEW.property_id,
        NEW.room_unit_id,
        NEW.id,
        (SELECT default_cleaner_id FROM properties WHERE id = NEW.property_id),
        NEW.check_out_date,
        'checkout',
        'pending',
        'normal', -- temporary, will recalc below
        now(),
        now()
    );

    -- 3. Recalculate priority for all tasks of this room & date
    UPDATE cleaning_tasks ct
    SET priority = CASE
        WHEN EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.room_unit_id = ct.room_unit_id
              AND r.check_in_date = ct.task_date
              AND r.id <> ct.reservation_id
        )
        THEN 'high'
        ELSE 'normal'
    END,
    updated_at = now()
    WHERE ct.room_unit_id = NEW.room_unit_id
      AND ct.task_date = NEW.check_out_date;

    RETURN NEW;
END;
$$;


--
-- Name: mark_messages_read(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_messages_read(p_thread_id uuid, p_user_id uuid, p_last_message_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: market_signals_by_date(uuid, uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.market_signals_by_date(_room_type_id uuid, _location_id uuid, _start date, _end date) RETURNS TABLE(dt date, total_units integer, occupied_units integer, pickup_7d integer, events_weight numeric, comp_price_median numeric)
    LANGUAGE sql STABLE
    AS $$
with dates as (
  select generate_series(_start, _end, interval '1 day')::date dt
),
-- total units (per room_type): prefer room_types.total_units, else count room_units
units as (
  select coalesce(nullif(rt.total_units,0),
         (select count(*) from room_units ru where ru.room_type_id=rt.id and coalesce(ru.is_active,true))
        ,0)::int as total_units
  from room_types rt
  where rt.id = _room_type_id
),
-- occupancy (booked units per date)
occ as (
  select d.dt, count(*)::int as occupied_units
  from dates d
  join reservations r
    on r.check_in_date <= d.dt
   and r.check_out_date  > d.dt
   and r.status in ('new','confirmed','checked_in','completed')
   and (r.room_type_id = _room_type_id or
        exists (select 1 from room_units u where u.id=r.room_unit_id and u.room_type_id=_room_type_id))
  group by d.dt
),
-- pickup in last 7 days (new bookings created within last 7 days for that stay date)
pickup as (
  select d.dt, count(*)::int as pickup_7d
  from dates d
  join reservations r
    on r.check_in_date <= d.dt
   and r.check_out_date  > d.dt
   and r.status in ('new','confirmed','checked_in','completed')
   and r.created_at >= now() - interval '7 days'
   and (r.room_type_id = _room_type_id or
        exists (select 1 from room_units u where u.id=r.room_unit_id and u.room_type_id=_room_type_id))
  group by d.dt
),
-- events weight (multiply holidays & events overlapping)
holiday_w as (
  select h.dt, exp(sum(ln(coalesce(nullif(h.weight,0),1))))::numeric as w
  from holidays h
  where (h.location_id = _location_id or h.location_id is null)
    and h.dt between _start and _end
    and coalesce(h.is_active,true)
  group by h.dt
),
event_w as (
  select d.dt,
         exp(sum(ln(coalesce(nullif(e.weight,0),1))))::numeric as w
  from dates d
  join events e
    on e.start_date <= d.dt and e.end_date > d.dt
   and (e.location_id = _location_id or e.location_id is null)
   and coalesce(e.is_active,true)
  group by d.dt
),
events_all as (
  select d.dt,
         coalesce(hw.w,1) * coalesce(ew.w,1) as events_weight
  from dates d
  left join holiday_w hw on hw.dt=d.dt
  left join event_w   ew on ew.dt=d.dt
),
-- competitor median (price-only)
comp_set as (
  select id from comp_sets
  where location_id = _location_id and coalesce(is_active,true)
  order by created_at asc
  limit 1
),
comp as (
  select cd.dt, cd.price_median
  from comp_set cs
  join comp_daily cd on cd.comp_set_id = cs.id
  where cd.dt between _start and _end
)
select
  d.dt,
  u.total_units,
  coalesce(o.occupied_units,0) as occupied_units,
  coalesce(p.pickup_7d,0) as pickup_7d,
  coalesce(e.events_weight,1.0) as events_weight,
  c.price_median as comp_price_median
from dates d
cross join units u
left join occ o on o.dt=d.dt
left join pickup p on p.dt=d.dt
left join events_all e on e.dt=d.dt
left join comp c on c.dt=d.dt
order by d.dt;
$$;


--
-- Name: match_documents(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_documents(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: max_consecutive_nights(uuid, date, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.max_consecutive_nights(p_room_unit_id uuid, p_start_date date, p_max_end_date date, p_exclude_reservation_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_current_date date := p_start_date;
    v_nights integer := 0;
BEGIN
    WHILE v_current_date < p_max_end_date LOOP
        IF public.is_room_available(
            p_room_unit_id, 
            v_current_date, 
            v_current_date + 1, 
            p_exclude_reservation_id
        ) THEN
            v_nights := v_nights + 1;
            v_current_date := v_current_date + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_nights;
END;
$$;


--
-- Name: message_deliveries_status_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_deliveries_status_trigger() RETURNS trigger
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


--
-- Name: FUNCTION message_deliveries_status_trigger(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.message_deliveries_status_trigger() IS 'Trigger function to automatically set timestamp fields based on message delivery status transitions';


--
-- Name: message_deliveries_status_ts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.message_deliveries_status_ts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'queued'    and new.queued_at    is null then new.queued_at    := now(); end if;
    if new.status = 'sent'      and new.sent_at      is null then new.sent_at      := now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
    if new.status = 'read'      and new.read_at      is null then new.read_at      := now(); end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.status,'') <> new.status then
    case new.status
      when 'queued'    then if new.queued_at    is null then new.queued_at    := now(); end if;
      when 'sent'      then if new.sent_at      is null then new.sent_at      := now(); end if;
      when 'delivered' then if new.delivered_at is null then new.delivered_at := now(); end if;
      when 'read'      then if new.read_at      is null then new.read_at      := now(); end if;
      else
        -- Handle 'failed' and any other statuses gracefully
        null;
    end case;
  end if;

  return new;
end 
$$;


--
-- Name: move_reservation(uuid, uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_reservation(p_reservation_id uuid, p_new_room_unit_id uuid DEFAULT NULL::uuid, p_new_start_date date DEFAULT NULL::date, p_new_end_date date DEFAULT NULL::date) RETURNS TABLE(success boolean, error_message text)
    LANGUAGE plpgsql
    AS $$DECLARE
    v_reservation record;
    v_target_start date;
    v_target_end date;
    v_target_room uuid;
BEGIN
    -- Get current reservation
    SELECT * INTO v_reservation
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Reservation not found'::text;
        RETURN;
    END IF;
    
    -- Use provided values or keep existing ones
    v_target_room  := p_new_room_unit_id; 
    v_target_start := COALESCE(p_new_start_date, v_reservation.check_in_date);
    v_target_end := COALESCE(p_new_end_date, v_reservation.check_out_date);
    
    -- Validate date range
    IF v_target_start >= v_target_end THEN
        RETURN QUERY SELECT false, 'Invalid date range'::text;
        RETURN;
    END IF;
    
    -- Check availability (exclude current reservation)
    IF NOT public.is_room_available(
        v_target_room,
        v_target_start,
        v_target_end,
        p_reservation_id
    ) THEN
        RETURN QUERY SELECT false, 'Target slot not available'::text;
        RETURN;
    END IF;
    
    -- Update reservation
    UPDATE reservations SET
        room_unit_id = v_target_room,
        check_in_date = v_target_start,
        check_out_date = v_target_end,
        updated_at = now()
    WHERE id = p_reservation_id;
    
    -- Clean up any existing segments (reservation is no longer split)
    DELETE FROM reservation_segments 
    WHERE reservation_id = p_reservation_id;
    
    RETURN QUERY SELECT true, NULL::text;
END;$$;


--
-- Name: occupancy_by_date(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.occupancy_by_date(_room_type_id uuid, _start date, _end date) RETURNS TABLE(dt date, total_units integer, occupied_units integer, occupancy_pct numeric)
    LANGUAGE sql STABLE
    AS $$
WITH dates AS (
  SELECT generate_series(_start, _end, interval '1 day')::date AS dt
),
units AS (
  SELECT
    rt.total_units AS total_units_rt,
    (SELECT count(*) FROM room_units ru
      WHERE ru.room_type_id = rt.id AND coalesce(ru.is_active, true)) AS total_units_rows
  FROM room_types rt
  WHERE rt.id = _room_type_id
),
total AS (
  SELECT coalesce(nullif(u.total_units_rt,0), u.total_units_rows, 0) AS total_units
  FROM units u
),
stays AS (
  -- A) reservations linked by room_type_id
  SELECT d.dt
  FROM dates d
  JOIN reservations r
    ON r.room_type_id = _room_type_id
   AND r.check_in_date <= d.dt
   AND r.check_out_date > d.dt
   AND r.status IN ('new','confirmed','checked_in','completed')
  UNION ALL
  -- B) reservations linked by room_unit_id -> room_units -> room_type_id
  SELECT d.dt
  FROM dates d
  JOIN reservations r
    ON r.check_in_date <= d.dt
   AND r.check_out_date > d.dt
   AND r.status IN ('new','confirmed','checked_in','completed')
  JOIN room_units u ON u.id = r.room_unit_id AND u.room_type_id = _room_type_id
),
agg AS (
  SELECT dt, count(*) AS occupied_units
  FROM stays
  GROUP BY dt
)
SELECT
  d.dt,
  t.total_units,
  coalesce(a.occupied_units,0) AS occupied_units,
  CASE WHEN t.total_units > 0
       THEN round(100.0 * coalesce(a.occupied_units,0) / t.total_units, 2)
       ELSE 0 END AS occupancy_pct
FROM dates d
CROSS JOIN total t
LEFT JOIN agg a ON a.dt = d.dt
ORDER BY d.dt;
$$;


--
-- Name: process_pricing_queue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_pricing_queue() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: FUNCTION process_pricing_queue(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.process_pricing_queue() IS 'Processes pending pricing recalculation jobs';


--
-- Name: propagate_booking_name_to_ct(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_booking_name_to_ct() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE public.cleaning_tasks
     SET booking_name = NEW.booking_name,
         updated_at   = NOW()
   WHERE reservation_id = NEW.id;

  RETURN NEW;
END;
$$;


--
-- Name: refresh_room_type_total_units(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_room_type_total_units(_rt uuid) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE room_types rt
  SET total_units = (
    SELECT count(*) FROM room_units ru
    WHERE ru.room_type_id = rt.id AND coalesce(ru.is_active, true)
  )
  WHERE rt.id = _rt;
$$;


--
-- Name: revoke_checkin_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_checkin_token() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status = 'cancelled' THEN
        NEW.check_in_token := NULL;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: rooms_compatible(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rooms_compatible(room_a_id uuid, room_b_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM room_units ru1
        JOIN room_types rt1 ON ru1.room_type_id = rt1.id
        JOIN room_units ru2 ON rt1.property_id = (
            SELECT rt2.property_id 
            FROM room_units ru_check
            JOIN room_types rt2 ON ru_check.room_type_id = rt2.id
            WHERE ru_check.id = room_b_id
        )
        JOIN room_types rt2 ON ru2.room_type_id = rt2.id
        WHERE ru1.id = room_a_id 
        AND ru2.id = room_b_id
        AND rt1.property_id = rt2.property_id
    );
$$;


--
-- Name: schedule_message(uuid, uuid, text, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_message(p_thread_id uuid, p_template_id uuid, p_channel text, p_run_at timestamp with time zone, p_payload jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE sql
    AS $$
    INSERT INTO public.scheduled_messages (thread_id, template_id, channel, run_at, payload)
    VALUES (p_thread_id, p_template_id, p_channel, p_run_at, p_payload)
    RETURNING id;
$$;


--
-- Name: send_message(uuid, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_message(p_thread_id uuid, p_channel text, p_content text, p_origin_role text DEFAULT 'host'::text, p_parent_message_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: set_cleaning_status_on_insert_if_cancelled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_cleaning_status_on_insert_if_cancelled() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM reservations
    WHERE id = NEW.reservation_id
      AND status = 'cancelled'
  ) THEN
    NEW.status := 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_ct_booking_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_ct_booking_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.reservation_id IS NOT NULL THEN
    SELECT r.booking_name
      INTO NEW.booking_name
    FROM public.reservations r
    WHERE r.id = NEW.reservation_id;
  ELSE
    NEW.booking_name := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: set_default_name_en(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_default_name_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If name_en is NULL, set it to the value of name
  IF NEW.name_en IS NULL THEN
    NEW.name_en := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_default_thread_subject(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_default_thread_subject() RETURNS trigger
    LANGUAGE plpgsql
    AS $$DECLARE
  v_subject text;
BEGIN
  -- Only fill when subject is empty/null AND we have a reservation_id
  IF (coalesce(trim(NEW.subject), '') = '' AND NEW.reservation_id IS NOT NULL) THEN
    SELECT nullif(trim(concat_ws(' ', r.booking_name)), '')
      INTO v_subject
    FROM public.reservations r
    WHERE r.id = NEW.reservation_id;

    IF v_subject IS NOT NULL THEN
      NEW.subject := v_subject;
    END IF;
  END IF;

  RETURN NEW;
END;$$;


--
-- Name: set_reservation_booking_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_reservation_booking_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.booking_name := trim(concat_ws(' ', NEW.booking_firstname, NEW.booking_lastname));
    RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


--
-- Name: split_reservation(uuid, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.split_reservation(p_reservation_id uuid, p_split_date date, p_new_room_unit_id uuid) RETURNS TABLE(success boolean, segment_ids uuid[], error_message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_reservation record;
    v_segment1_id uuid;
    v_segment2_id uuid;
    v_segments uuid[] := ARRAY[]::uuid[];
BEGIN
    -- Get reservation details
    SELECT * INTO v_reservation
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, ARRAY[]::uuid[], 'Reservation not found'::text;
        RETURN;
    END IF;
    
    -- Validate split date
    IF p_split_date <= v_reservation.check_in_date 
    OR p_split_date >= v_reservation.check_out_date THEN
        RETURN QUERY SELECT false, ARRAY[]::uuid[], 'Invalid split date'::text;
        RETURN;
    END IF;
    
    -- Check if new room is available for second segment
    IF NOT public.is_room_available(
        p_new_room_unit_id,
        p_split_date,
        v_reservation.check_out_date,
        p_reservation_id
    ) THEN
        RETURN QUERY SELECT false, ARRAY[]::uuid[], 'Target room not available'::text;
        RETURN;
    END IF;
    
    -- Create first segment (original room)
    INSERT INTO reservation_segments (
        reservation_id, room_unit_id, start_date, end_date, 
        segment_order, label, color
    ) VALUES (
        p_reservation_id,
        v_reservation.room_unit_id,
        v_reservation.check_in_date,
        p_split_date,
        1,
        v_reservation.booking_name || ' (Part 1)',
        '#3b82f6'
    ) RETURNING id INTO v_segment1_id;
    
    -- Create second segment (new room)
    INSERT INTO reservation_segments (
        reservation_id, room_unit_id, start_date, end_date,
        segment_order, label, color  
    ) VALUES (
        p_reservation_id,
        p_new_room_unit_id,
        p_split_date,
        v_reservation.check_out_date,
        2,
        v_reservation.booking_name || ' (Part 2)',
        '#3b82f6'
    ) RETURNING id INTO v_segment2_id;
    
    v_segments := ARRAY[v_segment1_id, v_segment2_id];
    
    RETURN QUERY SELECT true, v_segments, NULL::text;
END;
$$;


--
-- Name: store_email_threading_data(uuid, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_email_threading_data(message_id uuid, email_msg_id text, email_thread_id text, email_in_reply_to text, email_references text, provider_data jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO email_metadata (
    message_id,
    email_message_id,
    email_thread_id,
    email_in_reply_to,
    email_references,
    email_provider_data,
    updated_at
  ) VALUES (
    message_id,
    email_msg_id,
    email_thread_id,
    email_in_reply_to,
    email_references,
    provider_data,
    NOW()
  )
  ON CONFLICT (message_id) DO UPDATE SET
    email_message_id = EXCLUDED.email_message_id,
    email_thread_id = EXCLUDED.email_thread_id,
    email_in_reply_to = EXCLUDED.email_in_reply_to,
    email_references = EXCLUDED.email_references,
    email_provider_data = COALESCE(EXCLUDED.email_provider_data, email_metadata.email_provider_data),
    updated_at = NOW();
END;
$$;


--
-- Name: sync_cleaning_status_from_reservation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_cleaning_status_from_reservation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only do work when status actually changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE cleaning_tasks
    SET status = NEW.status
    WHERE reservation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_sync_room_type_total_units(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sync_room_type_total_units() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target uuid := coalesce(NEW.room_type_id, OLD.room_type_id);
BEGIN
  PERFORM public.refresh_room_type_total_units(target);
  RETURN COALESCE(NEW, OLD);
END; $$;


--
-- Name: trigger_pricing_recalculation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_pricing_recalculation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$DECLARE
  op        text := TG_OP;
  -- Put all "sellable" statuses you want to count here:
  sellable  text[] := ARRAY['new','confirmed','checked_in','completed','paid','booked'];
  rt_id     uuid;
  sdate     date;
  edate     date;
  today     date := CURRENT_DATE;
  horizon   date := (CURRENT_DATE + INTERVAL '540 days')::date;  -- cap ~18 months
BEGIN
  IF op = 'INSERT' THEN
    IF NEW.status = ANY(sellable) THEN
      rt_id := NEW.room_type_id;
      sdate := NEW.check_in_date;
      edate := (NEW.check_out_date - INTERVAL '1 day')::date; -- checkout exclusive
    ELSE
      RETURN NEW;
    END IF;

  ELSIF op = 'UPDATE' THEN
    IF (OLD.room_type_id, OLD.check_in_date, OLD.check_out_date, OLD.status)
       IS DISTINCT FROM
       (NEW.room_type_id, NEW.check_in_date, NEW.check_out_date, NEW.status) THEN

      -- Requeue OLD window if it used to count
      IF OLD.status::text = ANY(sellable) THEN
        INSERT INTO pricing_recalc_queue (room_type_id, start_date, end_date, triggered_by)
        VALUES (OLD.room_type_id,
                GREATEST(OLD.check_in_date, today),
                LEAST((OLD.check_out_date - INTERVAL '1 day')::date, horizon),
                'reservation_trigger')
        ON CONFLICT (room_type_id, start_date, end_date) DO UPDATE
          SET updated_at = NOW();
      END IF;

      -- Queue NEW window if it now counts
      IF NEW.status::text = ANY(sellable) THEN
        rt_id := NEW.room_type_id;
        sdate := NEW.check_in_date;
        edate := (NEW.check_out_date - INTERVAL '1 day')::date;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF op = 'DELETE' THEN
    IF OLD.status = ANY(sellable) THEN
      rt_id := OLD.room_type_id;
      sdate := OLD.check_in_date;
      edate := (OLD.check_out_date - INTERVAL '1 day')::date;
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Clamp window and enqueue
  IF rt_id IS NOT NULL THEN
    sdate := GREATEST(sdate, today);
    edate := LEAST(edate, horizon);
    IF sdate <= edate THEN
      INSERT INTO pricing_recalc_queue (room_type_id, start_date, end_date, triggered_by)
      VALUES (rt_id, sdate, edate, 'reservation_trigger')
      ON CONFLICT (room_type_id, start_date, end_date) DO UPDATE
        SET updated_at = NOW();
    END IF;
  END IF;

  RETURN CASE WHEN op = 'DELETE' THEN OLD ELSE NEW END;
END;$$;


--
-- Name: FUNCTION trigger_pricing_recalculation(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_pricing_recalculation() IS 'Automatically queues pricing recalculation when reservations change';


--
-- Name: try_allocate_with_swaps(uuid, date, date, uuid[], boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.try_allocate_with_swaps(p_reservation_id uuid, p_start_date date, p_end_date date, p_room_unit_ids uuid[], p_allow_swaps boolean DEFAULT true, p_label text DEFAULT NULL::text) RETURNS TABLE(success boolean, segments jsonb, swapped_reservations jsonb, error_message text)
    LANGUAGE plpgsql
    AS $$DECLARE
    v_cursor date := p_start_date;
    v_segments jsonb := '[]'::jsonb;
    v_swapped jsonb := '[]'::jsonb;
    v_best_room uuid;
    v_best_nights integer;
    v_room_id uuid;
    v_nights integer;
    v_segment_order integer := 1;
    v_blocking_reservation uuid;
    v_alternative_room uuid;
BEGIN
    -- Validate inputs
    IF p_start_date >= p_end_date THEN
        RETURN QUERY SELECT false, '[]'::jsonb, '[]'::jsonb, 'Invalid date range'::text;
        RETURN;
    END IF;
    
    IF array_length(p_room_unit_ids, 1) IS NULL OR array_length(p_room_unit_ids, 1) = 0 THEN
        RETURN QUERY SELECT false, '[]'::jsonb, '[]'::jsonb, 'No rooms specified'::text;
        RETURN;
    END IF;
    
    -- Main allocation loop
    WHILE v_cursor < p_end_date LOOP
        v_best_room := NULL;
        v_best_nights := 0;
        
        -- Find room with longest consecutive availability
        FOREACH v_room_id IN ARRAY p_room_unit_ids LOOP
            v_nights := public.max_consecutive_nights(
                v_room_id, 
                v_cursor, 
                p_end_date, 
                p_reservation_id
            );
            
            IF v_nights > v_best_nights THEN
                v_best_nights := v_nights;
                v_best_room := v_room_id;
            END IF;
        END LOOP;
        
        -- If we found available nights, create segment
        IF v_best_room IS NOT NULL AND v_best_nights > 0 THEN
            v_segments := v_segments || jsonb_build_object(
                'room_unit_id', v_best_room,
                'start_date', v_cursor,
                'end_date', v_cursor + v_best_nights,
                'segment_order', v_segment_order,
                'label', COALESCE(p_label, 'Segment ' || v_segment_order)
            );
            
            v_cursor := v_cursor + v_best_nights;
            v_segment_order := v_segment_order + 1;
            CONTINUE;
        END IF;
        
        -- No direct availability - try swaps if allowed
        IF NOT p_allow_swaps THEN
            RETURN QUERY SELECT false, '[]'::jsonb, '[]'::jsonb, 
                ('No availability on ' || v_cursor::text)::text;
            RETURN;
        END IF;
        
        -- Attempt one-hop swap for current night
        DECLARE
            v_swap_found boolean := false;
        BEGIN
            FOREACH v_room_id IN ARRAY p_room_unit_ids LOOP
                -- Find blocking reservation for this night
                SELECT r.id INTO v_blocking_reservation
                FROM reservations r
                WHERE r.room_unit_id = v_room_id
                AND r.status::text NOT IN ('cancelled', 'no_show')
                AND r.check_in_date <= v_cursor
                AND r.check_out_date > v_cursor
                AND r.id != p_reservation_id
                LIMIT 1;
                
                IF v_blocking_reservation IS NULL THEN
                    -- Check reservation segments
                    SELECT r.id INTO v_blocking_reservation
                    FROM reservation_segments rs
                    JOIN reservations r ON rs.reservation_id = r.id
                    WHERE rs.room_unit_id = v_room_id
                    AND r.status::text NOT IN ('cancelled', 'no_show')
                    AND rs.start_date <= v_cursor
                    AND rs.end_date > v_cursor
                    AND r.id != p_reservation_id
                    LIMIT 1;
                END IF;
                
                IF v_blocking_reservation IS NOT NULL THEN
                    -- Find compatible alternative room for the blocking reservation
                    FOREACH v_alternative_room IN ARRAY p_room_unit_ids LOOP
                        IF v_alternative_room != v_room_id 
                        AND public.rooms_compatible(v_room_id, v_alternative_room) 
                        AND public.is_room_available(
                            v_alternative_room,
                            v_cursor,
                            v_cursor + 1,
                            v_blocking_reservation
                        ) THEN
                            -- Record the swap (but don't execute yet - that's for the caller)
                            v_swapped := v_swapped || jsonb_build_object(
                                'reservation_id', v_blocking_reservation,
                                'from_room', v_room_id,
                                'to_room', v_alternative_room,
                                'date', v_cursor
                            );
                            
                            v_swap_found := true;
                            EXIT;
                        END IF;
                    END LOOP;
                    
                    IF v_swap_found THEN
                        EXIT;
                    END IF;
                END IF;
            END LOOP;
            
            IF NOT v_swap_found THEN
                RETURN QUERY SELECT false, '[]'::jsonb, v_swapped, 
                    ('Cannot resolve conflicts for ' || v_cursor::text)::text;
                RETURN;
            END IF;
        END;
        
        -- Move to next day (swap found, retry allocation)
        -- Note: In practice, the caller should apply swaps and retry the allocation
        v_cursor := v_cursor + 1;
    END LOOP;
    
    -- Success - return the allocation plan
    RETURN QUERY SELECT true, v_segments, v_swapped, NULL::text;
END;$$;


--
-- Name: update_beds24_auth_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_beds24_auth_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_cleaning_status_on_res_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cleaning_status_on_res_cancel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE cleaning_tasks
    SET status = 'cancelled'
    WHERE reservation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_cleaning_task_priorities(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cleaning_task_priorities(task_date date, unit_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  is_priority boolean;
BEGIN
  SELECT check_same_day_checkin(task_date, unit_id) INTO is_priority;
  
  UPDATE cleaning_tasks 
  SET priority = CASE WHEN is_priority THEN 'high' ELSE 'normal' END
  WHERE task_date = task_date AND room_unit_id = unit_id;
END;
$$;


--
-- Name: update_cleaning_task_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cleaning_task_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_email_metadata_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_email_metadata_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_group_booking_status(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_group_booking_status(master_booking_id text, new_status text) RETURNS integer
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


--
-- Name: FUNCTION update_group_booking_status(master_booking_id text, new_status text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_group_booking_status(master_booking_id text, new_status text) IS 'Updates status for all reservations in a group booking';


--
-- Name: update_seasonality_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_seasonality_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_thread_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_thread_metadata() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update the thread with latest message info
    UPDATE message_threads 
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 160),
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    
    -- Return the new record
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: upsert_property_translation(uuid, character varying, character varying, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_property_translation(p_property_id uuid, p_field_name character varying, p_language_code character varying, p_translated_text text, p_is_auto_translated boolean DEFAULT false, p_created_by uuid DEFAULT auth.uid()) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    translation_id UUID;
BEGIN
    INSERT INTO property_translations (
        property_id,
        field_name,
        language_code,
        translated_text,
        is_auto_translated,
        created_by,
        updated_at
    ) VALUES (
        p_property_id,
        p_field_name,
        p_language_code,
        p_translated_text,
        p_is_auto_translated,
        p_created_by,
        NOW()
    )
    ON CONFLICT (property_id, field_name, language_code)
    DO UPDATE SET
        translated_text = EXCLUDED.translated_text,
        is_auto_translated = EXCLUDED.is_auto_translated,
        updated_at = NOW(),
        created_by = COALESCE(EXCLUDED.created_by, property_translations.created_by)
    RETURNING id INTO translation_id;
    
    RETURN translation_id;
END;
$$;


--
-- Name: FUNCTION upsert_property_translation(p_property_id uuid, p_field_name character varying, p_language_code character varying, p_translated_text text, p_is_auto_translated boolean, p_created_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.upsert_property_translation(p_property_id uuid, p_field_name character varying, p_language_code character varying, p_translated_text text, p_is_auto_translated boolean, p_created_by uuid) IS 'Function to insert or update property translations';


--
-- Name: upsert_room_type_translation(uuid, character varying, character varying, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_room_type_translation(p_room_type_id uuid, p_field_name character varying, p_language_code character varying, p_translated_text text, p_is_auto_translated boolean DEFAULT false, p_created_by uuid DEFAULT auth.uid()) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    translation_id UUID;
BEGIN
    INSERT INTO room_type_translations (
        room_type_id,
        field_name,
        language_code,
        translated_text,
        is_auto_translated,
        created_by,
        updated_at
    ) VALUES (
        p_room_type_id,
        p_field_name,
        p_language_code,
        p_translated_text,
        p_is_auto_translated,
        p_created_by,
        NOW()
    )
    ON CONFLICT (room_type_id, field_name, language_code)
    DO UPDATE SET
        translated_text = EXCLUDED.translated_text,
        is_auto_translated = EXCLUDED.is_auto_translated,
        updated_at = NOW(),
        created_by = COALESCE(EXCLUDED.created_by, room_type_translations.created_by)
    RETURNING id INTO translation_id;
    
    RETURN translation_id;
END;
$$;


--
-- Name: FUNCTION upsert_room_type_translation(p_room_type_id uuid, p_field_name character varying, p_language_code character varying, p_translated_text text, p_is_auto_translated boolean, p_created_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.upsert_room_type_translation(p_room_type_id uuid, p_field_name character varying, p_language_code character varying, p_translated_text text, p_is_auto_translated boolean, p_created_by uuid) IS 'Function to insert or update room type translations';


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
BEGIN
    RETURN query EXECUTE
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name || '/' AS name,
                    NULL::uuid AS id,
                    NULL::timestamptz AS updated_at,
                    NULL::timestamptz AS created_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%'
                AND bucket_id = $2
                AND level = $4
                AND name COLLATE "C" > $5
                ORDER BY prefixes.name COLLATE "C" LIMIT $3
            )
            UNION ALL
            (SELECT split_part(name, '/', $4) AS key,
                name,
                id,
                updated_at,
                created_at,
                metadata
            FROM storage.objects
            WHERE name COLLATE "C" LIKE $1 || '%'
                AND bucket_id = $2
                AND level = $4
                AND name COLLATE "C" > $5
            ORDER BY name COLLATE "C" LIMIT $3)
        ) obj
        ORDER BY name COLLATE "C" LIMIT $3;
        $sql$
        USING prefix, bucket_name, limits, levels, start_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: accommodation_tax_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accommodation_tax_invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    guest_token character varying(8) NOT NULL,
    nights integer NOT NULL,
    num_guests integer NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    room_rate_per_person_per_night numeric(10,2) NOT NULL,
    tax_rate numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'JPY'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    stripe_payment_intent_id character varying(100),
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT positive_amounts CHECK (((nights > 0) AND (num_guests > 0) AND (total_amount >= (0)::numeric) AND (room_rate_per_person_per_night >= (0)::numeric) AND (tax_rate >= (0)::numeric) AND (tax_amount >= (0)::numeric))),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'exempted'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: TABLE accommodation_tax_invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.accommodation_tax_invoices IS 'Tracks accommodation tax calculations and payment status for reservations';


--
-- Name: COLUMN accommodation_tax_invoices.guest_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accommodation_tax_invoices.guest_token IS 'Guest check-in token for easy lookup';


--
-- Name: COLUMN accommodation_tax_invoices.tax_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accommodation_tax_invoices.tax_rate IS 'Tax rate per person per night in JPY';


--
-- Name: COLUMN accommodation_tax_invoices.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accommodation_tax_invoices.status IS 'Payment status: pending, paid, exempted, failed';


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    address text NOT NULL,
    owner_id uuid,
    description text,
    property_type character varying(100) DEFAULT 'apartment'::character varying,
    wifi_name character varying(255),
    wifi_password character varying(255),
    house_rules text,
    check_in_instructions text,
    contact_number character varying(255),
    property_amenities jsonb,
    location_info jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    access_time time without time zone,
    default_cleaner_id uuid,
    beds24_property_id bigint,
    departure_time time without time zone,
    entrance_code text,
    property_email text,
    luggage_info text
);


--
-- Name: TABLE properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.properties IS 'Properties/buildings owned by users';


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    beds24_booking_id character varying(255) NOT NULL,
    booking_name character varying(255) NOT NULL,
    booking_email character varying(255) NOT NULL,
    booking_phone character varying(50),
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    num_guests integer DEFAULT 1,
    total_amount numeric(10,2),
    currency character varying(3) DEFAULT 'JPY'::character varying,
    check_in_token character varying(8),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    booking_source text,
    num_adults integer,
    num_children integer,
    special_requests text,
    property_id uuid,
    room_type_id uuid,
    room_unit_id uuid,
    "apiReference" text,
    booking_lastname text,
    "rateDescription" text,
    commission numeric,
    "apiMessage" text,
    "bookingTime" timestamp with time zone,
    comments text,
    price numeric,
    "timeStamp" timestamp with time zone,
    lang text,
    access_read boolean DEFAULT false,
    status text,
    booking_firstname text,
    booking_group_master_id text,
    is_group_master boolean DEFAULT false,
    group_room_count integer DEFAULT 1,
    booking_group_ids jsonb
);


--
-- Name: COLUMN reservations.booking_group_master_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservations.booking_group_master_id IS 'Beds24 master booking ID for group bookings - links all rooms in a group';


--
-- Name: COLUMN reservations.is_group_master; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservations.is_group_master IS 'True for the primary/master reservation in a group booking';


--
-- Name: COLUMN reservations.group_room_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservations.group_room_count IS 'Total number of rooms in the group booking';


--
-- Name: COLUMN reservations.booking_group_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reservations.booking_group_ids IS 'Array of all booking IDs that belong to this group';


--
-- Name: accommodation_tax_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.accommodation_tax_details AS
 SELECT ati.id,
    ati.reservation_id,
    ati.guest_token,
    ati.nights,
    ati.num_guests,
    ati.total_amount,
    ati.room_rate_per_person_per_night,
    ati.tax_rate,
    ati.tax_amount,
    ati.currency,
    ati.status,
    ati.stripe_payment_intent_id,
    ati.paid_at,
    ati.created_at,
    ati.updated_at,
    r.booking_name,
    r.booking_email,
    r.check_in_date,
    r.check_out_date,
    p.name AS property_name
   FROM ((public.accommodation_tax_invoices ati
     LEFT JOIN public.reservations r ON ((ati.reservation_id = r.id)))
     LEFT JOIN public.properties p ON ((r.property_id = p.id)));


--
-- Name: VIEW accommodation_tax_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.accommodation_tax_details IS 'Accommodation tax invoices with reservation and property details';


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    trigger_type text NOT NULL,
    event text,
    offset_json jsonb,
    property_id uuid,
    template_id uuid NOT NULL,
    channel text NOT NULL,
    filters jsonb,
    options jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automation_rules_channel_check CHECK ((channel = ANY (ARRAY['airbnb'::text, 'booking'::text, 'whatsapp'::text, 'inapp'::text, 'email'::text, 'sms'::text]))),
    CONSTRAINT automation_rules_event_check CHECK ((event = ANY (ARRAY['booking_created'::text, 'check_in'::text, 'check_out'::text, 'payment_due'::text]))),
    CONSTRAINT automation_rules_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['relative_to_reservation'::text, 'absolute_time'::text])))
);


--
-- Name: beds24_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beds24_auth (
    id integer NOT NULL,
    access_token text,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE beds24_auth; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.beds24_auth IS 'Stores Beds24 API authentication tokens with automatic refresh capability';


--
-- Name: COLUMN beds24_auth.access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beds24_auth.access_token IS '24-hour access token for Beds24 API calls';


--
-- Name: COLUMN beds24_auth.refresh_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beds24_auth.refresh_token IS '30-day refresh token for generating new access tokens';


--
-- Name: COLUMN beds24_auth.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.beds24_auth.expires_at IS 'Timestamp when the current access token expires';


--
-- Name: beds24_auth_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.beds24_auth_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: beds24_auth_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.beds24_auth_id_seq OWNED BY public.beds24_auth.id;


--
-- Name: cleaning_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    property_id uuid NOT NULL,
    room_unit_id uuid,
    reservation_id uuid,
    cleaner_id uuid,
    task_date date NOT NULL,
    task_type text DEFAULT 'checkout'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    estimated_duration integer,
    special_notes text,
    assigned_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_name text
);


--
-- Name: comp_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comp_daily (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comp_set_id uuid NOT NULL,
    dt date NOT NULL,
    lead_days integer,
    price_median numeric(10,2),
    price_p25 numeric(10,2),
    price_p75 numeric(10,2),
    price_min numeric(10,2),
    price_max numeric(10,2),
    sample_size integer DEFAULT 0,
    availability_pct numeric(5,2),
    input_method text DEFAULT 'manual'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE comp_daily; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comp_daily IS 'Daily competitor price data (manual input)';


--
-- Name: comp_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comp_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    comp_set_id uuid NOT NULL,
    source text NOT NULL,
    external_id text,
    label text NOT NULL,
    property_type text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE comp_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comp_members IS 'Individual competitors tracked in each set';


--
-- Name: comp_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comp_sets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    location_id uuid,
    name text DEFAULT 'Default'::text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE comp_sets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.comp_sets IS 'Competitor groupings by location or market segment';


--
-- Name: email_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_metadata (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    email_message_id text,
    email_thread_id text,
    email_in_reply_to text,
    email_references text,
    email_provider_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email_name text
);


--
-- Name: TABLE email_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_metadata IS 'Dedicated table for email threading metadata, separated from messages for better performance';


--
-- Name: COLUMN email_metadata.email_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_metadata.email_message_id IS 'Gmail Message-ID header for threading';


--
-- Name: COLUMN email_metadata.email_thread_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_metadata.email_thread_id IS 'Gmail thread ID for conversation grouping';


--
-- Name: COLUMN email_metadata.email_in_reply_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_metadata.email_in_reply_to IS 'Gmail In-Reply-To header for reply threading';


--
-- Name: COLUMN email_metadata.email_references; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_metadata.email_references IS 'Gmail References header chain';


--
-- Name: COLUMN email_metadata.email_provider_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_metadata.email_provider_data IS 'Provider-specific data (n8n response, delivery info, etc.)';


--
-- Name: email_thread_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_thread_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid,
    gmail_message_id character varying(255) NOT NULL,
    match_method character varying(50) NOT NULL,
    confidence_level character varying(20) NOT NULL,
    match_details jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_threads (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid,
    subject text,
    status text DEFAULT 'open'::text NOT NULL,
    assignee_user_id uuid,
    priority text DEFAULT 'normal'::text,
    last_message_at timestamp with time zone,
    last_message_preview text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_thread_id character varying(255),
    needs_linking boolean DEFAULT false,
    CONSTRAINT message_threads_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT message_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: COLUMN message_threads.email_thread_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_threads.email_thread_id IS 'Email thread ID for grouping related email messages';


--
-- Name: COLUMN message_threads.needs_linking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_threads.needs_linking IS 'Flag for threads that need manual linking to reservations';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    parent_message_id uuid,
    origin_role text NOT NULL,
    direction text NOT NULL,
    channel text NOT NULL,
    content text NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, COALESCE(content, ''::text))) STORED,
    unsent_at timestamp with time zone,
    unsent_by uuid,
    is_unsent boolean DEFAULT false NOT NULL,
    CONSTRAINT messages_channel_check CHECK ((channel = ANY (ARRAY['airbnb'::text, 'booking.com'::text, 'whatsapp'::text, 'inapp'::text, 'email'::text, 'sms'::text]))),
    CONSTRAINT messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text]))),
    CONSTRAINT messages_origin_role_check CHECK ((origin_role = ANY (ARRAY['guest'::text, 'host'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: COLUMN messages.unsent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.unsent_at IS 'Timestamp when the message was unsent';


--
-- Name: COLUMN messages.unsent_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.unsent_by IS 'ID of the user who unsent the message';


--
-- Name: COLUMN messages.is_unsent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.is_unsent IS 'Flag to quickly identify unsent messages';


--
-- Name: email_threading_debug; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.email_threading_debug AS
 SELECT m.id AS message_id,
    m.thread_id,
    mt.subject AS thread_subject,
    m.content AS message_preview,
    em.email_message_id,
    em.email_thread_id,
    em.email_in_reply_to,
    em.email_references,
    em.email_name,
    em.email_provider_data,
    m.origin_role,
    m.direction,
    m.channel,
    m.created_at AS message_created_at,
    r.id AS reservation_id,
    r.booking_name,
    r.booking_email
   FROM (((public.messages m
     LEFT JOIN public.email_metadata em ON ((em.message_id = m.id)))
     LEFT JOIN public.message_threads mt ON ((mt.id = m.thread_id)))
     LEFT JOIN public.reservations r ON ((r.id = mt.reservation_id)))
  WHERE (m.channel = 'email'::text)
  ORDER BY m.created_at DESC;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    location_id uuid,
    title text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    weight numeric(5,2) DEFAULT 1.10,
    description text,
    url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.events IS 'Conferences, festivals, and local events affecting demand';


--
-- Name: gmail_processed_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_processed_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gmail_message_id character varying(255) NOT NULL,
    thread_id uuid,
    message_id uuid,
    processed_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: room_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    property_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    max_guests integer DEFAULT 2 NOT NULL,
    base_price numeric(10,2),
    currency character varying(3) DEFAULT 'JPY'::character varying,
    room_amenities jsonb,
    bed_configuration character varying(255),
    room_size_sqm integer,
    has_balcony boolean DEFAULT false,
    has_kitchen boolean DEFAULT false,
    is_accessible boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    beds24_roomtype_id bigint,
    min_price numeric(10,2),
    max_price numeric(10,2),
    total_units integer,
    sort_order integer
);


--
-- Name: room_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_units (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_type_id uuid NOT NULL,
    unit_number character varying(50) NOT NULL,
    floor_number integer,
    access_code character varying(50),
    access_instructions text,
    wifi_name character varying(255),
    wifi_password character varying(255),
    unit_amenities jsonb,
    maintenance_notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    beds24_unit_id bigint
);


--
-- Name: group_booking_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.group_booking_details AS
 SELECT r.booking_group_master_id,
    count(*) AS total_rooms,
    count(*) FILTER (WHERE (r.is_group_master = true)) AS master_count,
    min(r.check_in_date) AS earliest_checkin,
    max(r.check_out_date) AS latest_checkout,
    string_agg(DISTINCT (r.booking_name)::text, ', '::text) AS guest_names,
    string_agg(DISTINCT (r.booking_email)::text, ', '::text) AS guest_emails,
    string_agg(DISTINCT (ru.unit_number)::text, ', '::text ORDER BY (ru.unit_number)::text) AS room_units,
    string_agg(DISTINCT (rt.name)::text, ', '::text) AS room_types,
    p.name AS property_name,
    sum(r.total_amount) AS total_group_amount,
    r.currency,
    max(r.created_at) AS latest_created_at,
    max(r.updated_at) AS latest_updated_at
   FROM (((public.reservations r
     LEFT JOIN public.room_units ru ON ((r.room_unit_id = ru.id)))
     LEFT JOIN public.room_types rt ON ((r.room_type_id = rt.id)))
     LEFT JOIN public.properties p ON ((r.property_id = p.id)))
  WHERE (r.booking_group_master_id IS NOT NULL)
  GROUP BY r.booking_group_master_id, p.name, r.currency;


--
-- Name: VIEW group_booking_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.group_booking_details IS 'Comprehensive view of group bookings with aggregated information across all rooms';


--
-- Name: guest_channel_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_channel_consents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    channel text NOT NULL,
    consent_given boolean DEFAULT false NOT NULL,
    consent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT guest_channel_consents_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text])))
);


--
-- Name: guest_payment_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_payment_services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    service_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE guest_payment_services; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.guest_payment_services IS 'Defines available payment services for guests (accommodation tax, damage deposit, etc.)';


--
-- Name: guest_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    service_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'JPY'::character varying,
    requires_admin_activation boolean DEFAULT false,
    access_time_override_hours integer,
    departure_time_override_hours integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_mandatory boolean DEFAULT false,
    requires_calculation boolean DEFAULT false
);


--
-- Name: guest_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    guest_email character varying(255) NOT NULL,
    token character varying(64) NOT NULL,
    reservation_ids uuid[] NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    location_id uuid,
    dt date NOT NULL,
    tag text NOT NULL,
    weight numeric(5,2) DEFAULT 1.05,
    title text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE holidays; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.holidays IS 'Admin-managed holidays and special dates affecting demand';


--
-- Name: listing_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_prices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_type_id uuid NOT NULL,
    dt date NOT NULL,
    suggested_price numeric(10,2) NOT NULL,
    override_price numeric(10,2),
    locked boolean DEFAULT false,
    source_run_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE listing_prices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.listing_prices IS 'Daily computed prices with override capability';


--
-- Name: market_factors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_factors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    location_id uuid,
    dt date NOT NULL,
    demand numeric(4,3) DEFAULT 1.0,
    event_score numeric(4,2) DEFAULT 0,
    holiday boolean DEFAULT false,
    search_interest_index numeric(4,2) DEFAULT 0,
    comp_availability_pct numeric(5,2) DEFAULT 0,
    comp_median_price numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    demand_auto numeric(5,3),
    comp_pressure_auto numeric(5,3) DEFAULT 1.00,
    manual_multiplier numeric(5,3) DEFAULT 1.00,
    lock_auto boolean DEFAULT false,
    manual_notes text,
    pickup_z numeric(6,3),
    availability_z numeric(6,3),
    events_weight numeric(6,3) DEFAULT 1.00,
    comp_price_z numeric(6,3),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE market_factors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.market_factors IS 'Market demand factors (seasonality handled separately via seasonality_settings table)';


--
-- Name: COLUMN market_factors.demand_auto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_factors.demand_auto IS 'Auto-calculated demand factor from pickup/availability/events';


--
-- Name: COLUMN market_factors.comp_pressure_auto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_factors.comp_pressure_auto IS 'Auto-calculated competitor pressure factor';


--
-- Name: COLUMN market_factors.manual_multiplier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_factors.manual_multiplier IS 'Admin manual override multiplier (default 1.0)';


--
-- Name: COLUMN market_factors.lock_auto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_factors.lock_auto IS 'Prevent automatic updates when true';


--
-- Name: market_tuning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_tuning (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    location_id uuid,
    w_pickup numeric(4,2) DEFAULT 0.40,
    w_avail numeric(4,2) DEFAULT 0.30,
    w_event numeric(4,2) DEFAULT 0.30,
    alpha numeric(4,2) DEFAULT 0.12,
    beta numeric(4,2) DEFAULT 0.10,
    demand_min numeric(4,2) DEFAULT 0.80,
    demand_max numeric(4,2) DEFAULT 1.40,
    comp_pressure_min numeric(4,2) DEFAULT 0.90,
    comp_pressure_max numeric(4,2) DEFAULT 1.10,
    ema_alpha numeric(4,2) DEFAULT 0.30,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE market_tuning; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.market_tuning IS 'Configuration parameters for market demand calculations';


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    storage_bucket text DEFAULT 'message-attachments'::text NOT NULL,
    path text NOT NULL,
    content_type text,
    size_bytes integer,
    width integer,
    height integer,
    duration_seconds numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: message_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_deliveries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    channel text NOT NULL,
    provider_message_id text,
    status text DEFAULT 'queued'::text NOT NULL,
    error_code text,
    error_message text,
    queued_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    body_rendered text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_deliveries_channel_check CHECK ((channel = ANY (ARRAY['airbnb'::text, 'booking.com'::text, 'whatsapp'::text, 'inapp'::text, 'email'::text, 'sms'::text]))),
    CONSTRAINT message_deliveries_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]))),
    CONSTRAINT message_deliveries_time_order CHECK ((((delivered_at IS NULL) OR (sent_at IS NULL) OR (delivered_at >= sent_at)) AND ((read_at IS NULL) OR (delivered_at IS NULL) OR (read_at >= delivered_at))))
);


--
-- Name: message_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_participants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    participant_type text NOT NULL,
    user_id uuid,
    external_address text,
    display_name text,
    is_active boolean DEFAULT true NOT NULL,
    last_read_message_id uuid,
    last_read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    guest_id uuid,
    CONSTRAINT message_participants_participant_type_check CHECK ((participant_type = ANY (ARRAY['guest'::text, 'host'::text, 'assistant'::text, 'cleaner'::text, 'support'::text, 'system'::text])))
);


--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    channel text NOT NULL,
    language text,
    content text NOT NULL,
    variables jsonb,
    external_template_id text,
    property_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT message_templates_channel_check CHECK ((channel = ANY (ARRAY['airbnb'::text, 'booking'::text, 'whatsapp'::text, 'inapp'::text, 'email'::text, 'sms'::text])))
);


--
-- Name: COLUMN message_templates.enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_templates.enabled IS 'Controls whether this template is active for automation scheduling. When false, templates are completely skipped during automation processing.';


--
-- Name: payment_intents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_intents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    service_type character varying(50) NOT NULL,
    stripe_payment_intent_id character varying(100) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status character varying(50) NOT NULL,
    client_secret character varying(1000),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT positive_amount CHECK ((amount > (0)::numeric))
);


--
-- Name: TABLE payment_intents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_intents IS 'Tracks Stripe payment intents for all guest payment services';


--
-- Name: COLUMN payment_intents.service_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_intents.service_type IS 'Type of service: accommodation_tax, damage_deposit, etc.';


--
-- Name: COLUMN payment_intents.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_intents.status IS 'Stripe payment intent status';


--
-- Name: pricing_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_audit (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_type_id uuid NOT NULL,
    dt date NOT NULL,
    base_price numeric(10,2) NOT NULL,
    seasonality numeric(4,3) NOT NULL,
    dow numeric(4,3) NOT NULL,
    lead_time numeric(4,3) NOT NULL,
    los numeric(4,3) NOT NULL,
    demand numeric(4,3) NOT NULL,
    occupancy numeric(4,3) NOT NULL,
    occupancy_pct numeric(5,2) NOT NULL,
    orphan numeric(4,3) DEFAULT 1.0,
    unclamped numeric(10,2) NOT NULL,
    min_price numeric(10,2) NOT NULL,
    max_price numeric(10,2) NOT NULL,
    final_price numeric(10,2) NOT NULL,
    days_out integer,
    run_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    comp_pressure numeric(4,3) DEFAULT 1.0,
    manual_multiplier numeric(4,3) DEFAULT 1.0,
    events_weight numeric(4,3) DEFAULT 1.0,
    pickup_signal numeric(6,3) DEFAULT 0,
    availability_signal numeric(6,3) DEFAULT 0,
    comp_price_signal numeric(6,3) DEFAULT 0
);


--
-- Name: TABLE pricing_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pricing_audit IS 'Detailed breakdown of price calculations for transparency';


--
-- Name: pricing_recalc_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_recalc_queue (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_type_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    triggered_by character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE pricing_recalc_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pricing_recalc_queue IS 'Queue for automatic pricing recalculation jobs';


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_type_id uuid NOT NULL,
    dow_adjustments jsonb DEFAULT '{"Fri": 1.1, "Mon": 0.95, "Sat": 1.2, "Sun": 1.0, "Thu": 1.0, "Tue": 0.95, "Wed": 0.98}'::jsonb,
    lead_time_curve jsonb DEFAULT '{"0-3": 0.9, "4-7": 0.95, "61+": 1.1, "8-14": 1.0, "15-30": 1.05, "31-60": 1.08}'::jsonb,
    los_discounts jsonb DEFAULT '{"1": 1.05, "2-3": 1.0, "28+": 0.9, "4-6": 0.98, "7-27": 0.95}'::jsonb,
    orphan_gaps jsonb DEFAULT '{"1": 0.9, "2": 0.85, "3-4": 0.8}'::jsonb,
    occupancy_grid jsonb DEFAULT '{"mode": "percent", "leadBuckets": {"61+": {"0-100": 0}, "0-15": {"0-10": -15, "11-20": -15, "21-30": -10, "31-40": -5, "41-50": -5, "51-60": 0, "61-100": 0}, "16-30": {"0-10": -10, "11-20": -10, "21-30": -5, "31-40": -5, "41-50": 0, "51-60": 0, "61-100": 0}, "31-60": {"0-10": -5, "11-20": -5, "21-30": -5, "31-40": 0, "41-50": 0, "51-60": 0, "61-100": 0}}}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE pricing_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pricing_rules IS 'Pricing rules and curves per room type';


--
-- Name: pricing_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_runs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    algorithm_version character varying(50) DEFAULT 'v1.0'::character varying,
    notes text,
    room_type_id uuid,
    date_range_start date,
    date_range_end date
);


--
-- Name: property_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_images (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    property_id uuid,
    image_url text NOT NULL,
    image_type character varying(50) DEFAULT 'general'::character varying,
    caption character varying(255),
    display_order integer DEFAULT 0,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    room_type_id uuid,
    room_unit_id uuid
);


--
-- Name: TABLE property_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.property_images IS 'Images for properties and rooms';


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    role public.user_role NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    phone character varying(50),
    company_name character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS 'User profiles linked to Supabase Auth users';


--
-- Name: property_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.property_summary AS
 SELECT p.id,
    p.name,
    p.address,
    p.property_type,
    p.is_active,
    p.default_cleaner_id,
    cleaner.first_name AS default_cleaner_first_name,
    cleaner.last_name AS default_cleaner_last_name,
    count(DISTINCT rt.id) AS total_room_types,
    count(DISTINCT ru.id) AS total_room_units,
    count(DISTINCT
        CASE
            WHEN (ru.is_active = true) THEN ru.id
            ELSE NULL::uuid
        END) AS active_room_units,
    min(rt.base_price) AS min_price,
    max(rt.base_price) AS max_price,
    sum(rt.max_guests) AS total_capacity
   FROM (((public.properties p
     LEFT JOIN public.room_types rt ON (((p.id = rt.property_id) AND (rt.is_active = true))))
     LEFT JOIN public.room_units ru ON ((rt.id = ru.room_type_id)))
     LEFT JOIN public.user_profiles cleaner ON ((p.default_cleaner_id = cleaner.id)))
  GROUP BY p.id, p.name, p.address, p.property_type, p.is_active, p.default_cleaner_id, cleaner.first_name, cleaner.last_name;


--
-- Name: property_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_translations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    field_name character varying(50) NOT NULL,
    language_code character varying(5) NOT NULL,
    translated_text text NOT NULL,
    is_auto_translated boolean DEFAULT false,
    is_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: TABLE property_translations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.property_translations IS 'Stores translations for property text fields in multiple languages';


--
-- Name: property_translations_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.property_translations_view AS
 SELECT p.id AS property_id,
    p.name AS property_name,
    pt.field_name,
    pt.language_code,
    pt.translated_text,
    pt.is_auto_translated,
    pt.is_approved,
    pt.created_at,
    pt.updated_at,
    u.email AS created_by_email
   FROM ((public.properties p
     LEFT JOIN public.property_translations pt ON ((p.id = pt.property_id)))
     LEFT JOIN auth.users u ON ((pt.created_by = u.id)))
  WHERE (p.is_active = true);


--
-- Name: reservation_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_addons (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    service_id uuid NOT NULL,
    admin_enabled boolean DEFAULT false,
    purchase_status character varying(20) DEFAULT 'available'::character varying,
    stripe_payment_intent_id character varying(100),
    amount_paid numeric(10,2),
    calculated_amount numeric(10,2),
    is_tax_exempted boolean DEFAULT false,
    tax_calculation_details jsonb,
    access_time_override time without time zone,
    departure_time_override time without time zone,
    purchased_at timestamp with time zone,
    exempted_at timestamp with time zone,
    exempted_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reservation_addons_status_check CHECK (((purchase_status)::text = ANY ((ARRAY['available'::character varying, 'pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'exempted'::character varying])::text[])))
);


--
-- Name: reservation_guests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_guests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    guest_number integer NOT NULL,
    is_primary_guest boolean DEFAULT false NOT NULL,
    guest_firstname character varying(255),
    guest_lastname character varying(255),
    guest_contact character varying(50),
    guest_mail character varying(255),
    passport_url text,
    guest_address text,
    estimated_checkin_time time without time zone,
    travel_purpose character varying(255),
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(50),
    agreement_accepted boolean DEFAULT false,
    checkin_submitted_at timestamp with time zone,
    admin_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reservation_guests_guest_number_positive CHECK ((guest_number > 0)),
    CONSTRAINT reservation_guests_primary_guest_logic CHECK ((((is_primary_guest = true) AND (guest_number = 1)) OR (is_primary_guest = false)))
);


--
-- Name: reservation_all_guests_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.reservation_all_guests_details AS
 SELECT r.id AS reservation_id,
    r.beds24_booking_id,
    r.booking_name,
    r.check_in_date,
    r.check_out_date,
    r.num_guests,
    r.status,
    p.name AS property_name,
    rt.name AS room_type_name,
    ru.unit_number,
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
   FROM ((((public.reservations r
     JOIN public.reservation_guests rg ON ((r.id = rg.reservation_id)))
     LEFT JOIN public.properties p ON ((r.property_id = p.id)))
     LEFT JOIN public.room_types rt ON ((r.room_type_id = rt.id)))
     LEFT JOIN public.room_units ru ON ((r.room_unit_id = ru.id)))
  ORDER BY r.check_in_date DESC, rg.guest_number;


--
-- Name: VIEW reservation_all_guests_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.reservation_all_guests_details IS 'Detailed view showing all guests for each reservation, useful for admin interfaces and guest management.';


--
-- Name: reservation_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_segments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    room_unit_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    label text,
    color text DEFAULT '#3b82f6'::text,
    segment_order integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT positive_segment_order CHECK ((segment_order > 0)),
    CONSTRAINT valid_date_range CHECK ((start_date < end_date))
);


--
-- Name: reservation_webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_webhook_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    beds24_booking_id text,
    webhook_payload jsonb,
    processed_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    received_at timestamp with time zone DEFAULT now()
);


--
-- Name: reservations_details; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: room_availability; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.room_availability AS
 SELECT p.id AS property_id,
    p.name AS property_name,
    rt.id AS room_type_id,
    rt.name AS room_type_name,
    rt.base_price,
    rt.max_guests,
    ru.id AS room_unit_id,
    ru.unit_number,
    ru.is_active AS unit_active,
    rt.is_active AS room_type_active,
    p.is_active AS property_active,
    count(r.id) AS current_reservations
   FROM (((public.properties p
     LEFT JOIN public.room_types rt ON ((p.id = rt.property_id)))
     LEFT JOIN public.room_units ru ON ((rt.id = ru.room_type_id)))
     LEFT JOIN public.reservations r ON (((ru.id = r.room_unit_id) AND (r.status = ANY (ARRAY['confirmed'::text, 'checked_in'::text])) AND (r.check_in_date <= CURRENT_DATE) AND (r.check_out_date > CURRENT_DATE))))
  WHERE (p.is_active = true)
  GROUP BY p.id, p.name, rt.id, rt.name, rt.base_price, rt.max_guests, ru.id, ru.unit_number, ru.is_active, rt.is_active, p.is_active;


--
-- Name: room_type_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_type_translations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_type_id uuid NOT NULL,
    field_name character varying(50) NOT NULL,
    language_code character varying(5) NOT NULL,
    translated_text text NOT NULL,
    is_auto_translated boolean DEFAULT false,
    is_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


--
-- Name: TABLE room_type_translations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.room_type_translations IS 'Stores translations for room type text fields in multiple languages';


--
-- Name: room_type_translations_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.room_type_translations_view AS
 SELECT rt.id AS room_type_id,
    rt.name AS room_type_name,
    p.id AS property_id,
    p.name AS property_name,
    rtt.field_name,
    rtt.language_code,
    rtt.translated_text,
    rtt.is_auto_translated,
    rtt.is_approved,
    rtt.created_at,
    rtt.updated_at,
    u.email AS created_by_email
   FROM (((public.room_types rt
     JOIN public.properties p ON ((rt.property_id = p.id)))
     LEFT JOIN public.room_type_translations rtt ON ((rt.id = rtt.room_type_id)))
     LEFT JOIN auth.users u ON ((rtt.created_by = u.id)))
  WHERE (rt.is_active = true);


--
-- Name: seasonality_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasonality_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid,
    season_name character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    multiplier numeric(5,3) NOT NULL,
    year_recurring boolean DEFAULT true,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT seasonality_settings_multiplier_check CHECK ((multiplier > (0)::numeric))
);


--
-- Name: TABLE seasonality_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.seasonality_settings IS 'Configurable seasonal pricing multipliers with custom date ranges';


--
-- Name: COLUMN seasonality_settings.location_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasonality_settings.location_id IS 'NULL for global settings, specific location_id for location overrides';


--
-- Name: COLUMN seasonality_settings.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasonality_settings.start_date IS 'Start date of seasonal period (DATE)';


--
-- Name: COLUMN seasonality_settings.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasonality_settings.end_date IS 'End date of seasonal period (DATE), inclusive';


--
-- Name: COLUMN seasonality_settings.multiplier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasonality_settings.multiplier IS 'Seasonal pricing multiplier (e.g., 1.15 = 15% increase)';


--
-- Name: COLUMN seasonality_settings.year_recurring; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasonality_settings.year_recurring IS 'If true, applies to same date range every year';


--
-- Name: COLUMN seasonality_settings.display_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasonality_settings.display_order IS 'Order for UI display and conflict resolution';


--
-- Name: stripe_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_events (
    id text NOT NULL,
    processed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: thread_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_channels (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    channel text NOT NULL,
    external_thread_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT thread_channels_channel_check CHECK ((channel = ANY (ARRAY['airbnb'::text, 'booking.com'::text, 'whatsapp'::text, 'inapp'::text, 'email'::text, 'sms'::text])))
);


--
-- Name: thread_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thread_labels (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    label text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    phone character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_type character varying(100) NOT NULL,
    beds24_event_id character varying(255) NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: beds24_auth id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds24_auth ALTER COLUMN id SET DEFAULT nextval('public.beds24_auth_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: accommodation_tax_invoices accommodation_tax_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accommodation_tax_invoices
    ADD CONSTRAINT accommodation_tax_invoices_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: beds24_auth beds24_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds24_auth
    ADD CONSTRAINT beds24_auth_pkey PRIMARY KEY (id);


--
-- Name: cleaning_tasks cleaning_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_pkey PRIMARY KEY (id);


--
-- Name: cleaning_tasks cleaning_tasks_reservation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_reservation_id_key UNIQUE (reservation_id);


--
-- Name: comp_daily comp_daily_comp_set_id_dt_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_daily
    ADD CONSTRAINT comp_daily_comp_set_id_dt_key UNIQUE (comp_set_id, dt);


--
-- Name: comp_daily comp_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_daily
    ADD CONSTRAINT comp_daily_pkey PRIMARY KEY (id);


--
-- Name: comp_members comp_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_members
    ADD CONSTRAINT comp_members_pkey PRIMARY KEY (id);


--
-- Name: comp_sets comp_sets_location_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_sets
    ADD CONSTRAINT comp_sets_location_id_name_key UNIQUE (location_id, name);


--
-- Name: comp_sets comp_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_sets
    ADD CONSTRAINT comp_sets_pkey PRIMARY KEY (id);


--
-- Name: email_metadata email_metadata_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_metadata
    ADD CONSTRAINT email_metadata_message_id_key UNIQUE (message_id);


--
-- Name: email_metadata email_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_metadata
    ADD CONSTRAINT email_metadata_pkey PRIMARY KEY (id);


--
-- Name: email_thread_matches email_thread_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_thread_matches
    ADD CONSTRAINT email_thread_matches_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: gmail_processed_messages gmail_processed_messages_gmail_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_processed_messages
    ADD CONSTRAINT gmail_processed_messages_gmail_message_id_key UNIQUE (gmail_message_id);


--
-- Name: gmail_processed_messages gmail_processed_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_processed_messages
    ADD CONSTRAINT gmail_processed_messages_pkey PRIMARY KEY (id);


--
-- Name: guest_channel_consents guest_channel_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_channel_consents
    ADD CONSTRAINT guest_channel_consents_pkey PRIMARY KEY (id);


--
-- Name: guest_payment_services guest_payment_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_payment_services
    ADD CONSTRAINT guest_payment_services_pkey PRIMARY KEY (id);


--
-- Name: guest_payment_services guest_payment_services_service_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_payment_services
    ADD CONSTRAINT guest_payment_services_service_key_key UNIQUE (service_key);


--
-- Name: guest_services guest_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_services
    ADD CONSTRAINT guest_services_pkey PRIMARY KEY (id);


--
-- Name: guest_services guest_services_service_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_services
    ADD CONSTRAINT guest_services_service_key_key UNIQUE (service_key);


--
-- Name: guest_sessions guest_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_sessions
    ADD CONSTRAINT guest_sessions_pkey PRIMARY KEY (id);


--
-- Name: guest_sessions guest_sessions_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_sessions
    ADD CONSTRAINT guest_sessions_token_unique UNIQUE (token);


--
-- Name: holidays holidays_location_id_dt_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_location_id_dt_tag_key UNIQUE (location_id, dt, tag);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: listing_prices listing_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_prices
    ADD CONSTRAINT listing_prices_pkey PRIMARY KEY (id);


--
-- Name: listing_prices listing_prices_room_type_id_dt_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_prices
    ADD CONSTRAINT listing_prices_room_type_id_dt_key UNIQUE (room_type_id, dt);


--
-- Name: market_factors market_factors_location_id_dt_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_factors
    ADD CONSTRAINT market_factors_location_id_dt_key UNIQUE (location_id, dt);


--
-- Name: market_factors market_factors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_factors
    ADD CONSTRAINT market_factors_pkey PRIMARY KEY (id);


--
-- Name: market_tuning market_tuning_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_tuning
    ADD CONSTRAINT market_tuning_location_id_key UNIQUE (location_id);


--
-- Name: market_tuning market_tuning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_tuning
    ADD CONSTRAINT market_tuning_pkey PRIMARY KEY (id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: message_deliveries message_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deliveries
    ADD CONSTRAINT message_deliveries_pkey PRIMARY KEY (id);


--
-- Name: message_participants message_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_participants
    ADD CONSTRAINT message_participants_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: pricing_audit pricing_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_audit
    ADD CONSTRAINT pricing_audit_pkey PRIMARY KEY (id);


--
-- Name: pricing_recalc_queue pricing_recalc_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_recalc_queue
    ADD CONSTRAINT pricing_recalc_queue_pkey PRIMARY KEY (id);


--
-- Name: pricing_recalc_queue pricing_recalc_queue_room_type_id_start_date_end_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_recalc_queue
    ADD CONSTRAINT pricing_recalc_queue_room_type_id_start_date_end_date_key UNIQUE (room_type_id, start_date, end_date);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_room_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_room_type_id_key UNIQUE (room_type_id);


--
-- Name: pricing_runs pricing_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_runs
    ADD CONSTRAINT pricing_runs_pkey PRIMARY KEY (id);


--
-- Name: properties properties_beds24_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_beds24_property_id_key UNIQUE (beds24_property_id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_images property_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_pkey PRIMARY KEY (id);


--
-- Name: property_translations property_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_translations
    ADD CONSTRAINT property_translations_pkey PRIMARY KEY (id);


--
-- Name: property_translations property_translations_property_id_field_name_language_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_translations
    ADD CONSTRAINT property_translations_property_id_field_name_language_code_key UNIQUE (property_id, field_name, language_code);


--
-- Name: reservation_addons reservation_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_addons
    ADD CONSTRAINT reservation_addons_pkey PRIMARY KEY (id);


--
-- Name: reservation_addons reservation_addons_unique_service; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_addons
    ADD CONSTRAINT reservation_addons_unique_service UNIQUE (reservation_id, service_id);


--
-- Name: reservation_guests reservation_guests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guests
    ADD CONSTRAINT reservation_guests_pkey PRIMARY KEY (id);


--
-- Name: reservation_guests reservation_guests_reservation_guest_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guests
    ADD CONSTRAINT reservation_guests_reservation_guest_number_unique UNIQUE (reservation_id, guest_number);


--
-- Name: reservation_segments reservation_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segments
    ADD CONSTRAINT reservation_segments_pkey PRIMARY KEY (id);


--
-- Name: reservation_webhook_logs reservation_webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_webhook_logs
    ADD CONSTRAINT reservation_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_beds24_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_beds24_booking_id_key UNIQUE (beds24_booking_id);


--
-- Name: reservations reservations_check_in_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_check_in_token_key UNIQUE (check_in_token);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: room_type_translations room_type_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_translations
    ADD CONSTRAINT room_type_translations_pkey PRIMARY KEY (id);


--
-- Name: room_type_translations room_type_translations_room_type_id_field_name_language_cod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_translations
    ADD CONSTRAINT room_type_translations_room_type_id_field_name_language_cod_key UNIQUE (room_type_id, field_name, language_code);


--
-- Name: room_types room_types_beds24_roomtype_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_beds24_roomtype_id_key UNIQUE (beds24_roomtype_id);


--
-- Name: room_types room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_pkey PRIMARY KEY (id);


--
-- Name: room_types room_types_property_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_property_name_unique UNIQUE (property_id, name);


--
-- Name: room_units room_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_units
    ADD CONSTRAINT room_units_pkey PRIMARY KEY (id);


--
-- Name: room_units room_units_type_unit_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_units
    ADD CONSTRAINT room_units_type_unit_unique UNIQUE (room_type_id, unit_number);


--
-- Name: scheduled_messages scheduled_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id);


--
-- Name: seasonality_settings seasonality_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasonality_settings
    ADD CONSTRAINT seasonality_settings_pkey PRIMARY KEY (id);


--
-- Name: stripe_events stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_pkey PRIMARY KEY (id);


--
-- Name: thread_channels thread_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_channels
    ADD CONSTRAINT thread_channels_pkey PRIMARY KEY (id);


--
-- Name: thread_labels thread_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_labels
    ADD CONSTRAINT thread_labels_pkey PRIMARY KEY (id);


--
-- Name: thread_channels unique_channel_external_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_channels
    ADD CONSTRAINT unique_channel_external_id UNIQUE (channel, external_thread_id);


--
-- Name: message_deliveries unique_message_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deliveries
    ADD CONSTRAINT unique_message_channel UNIQUE (message_id, channel);


--
-- Name: guest_channel_consents unique_reservation_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_channel_consents
    ADD CONSTRAINT unique_reservation_channel UNIQUE (reservation_id, channel);


--
-- Name: accommodation_tax_invoices unique_reservation_tax; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accommodation_tax_invoices
    ADD CONSTRAINT unique_reservation_tax UNIQUE (reservation_id);


--
-- Name: thread_channels unique_thread_channel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_channels
    ADD CONSTRAINT unique_thread_channel UNIQUE (thread_id, channel);


--
-- Name: thread_labels unique_thread_label; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_labels
    ADD CONSTRAINT unique_thread_label UNIQUE (thread_id, label);


--
-- Name: scheduled_messages unique_thread_template_runtime; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT unique_thread_template_runtime UNIQUE (thread_id, template_id, run_at);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_beds24_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_beds24_event_id_key UNIQUE (beds24_event_id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_accommodation_tax_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accommodation_tax_reservation ON public.accommodation_tax_invoices USING btree (reservation_id);


--
-- Name: idx_accommodation_tax_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accommodation_tax_status ON public.accommodation_tax_invoices USING btree (status);


--
-- Name: idx_accommodation_tax_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accommodation_tax_token ON public.accommodation_tax_invoices USING btree (guest_token);


--
-- Name: idx_automation_rules_enabled_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_enabled_property ON public.automation_rules USING btree (enabled, property_id) WHERE (enabled = true);


--
-- Name: idx_automation_rules_trigger_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_trigger_type ON public.automation_rules USING btree (trigger_type);


--
-- Name: idx_beds24_auth_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beds24_auth_expires_at ON public.beds24_auth USING btree (expires_at);


--
-- Name: idx_cleaning_tasks_cleaner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_cleaner_id ON public.cleaning_tasks USING btree (cleaner_id);


--
-- Name: idx_cleaning_tasks_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_priority ON public.cleaning_tasks USING btree (priority);


--
-- Name: idx_cleaning_tasks_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_property_id ON public.cleaning_tasks USING btree (property_id);


--
-- Name: idx_cleaning_tasks_reservation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_reservation_id ON public.cleaning_tasks USING btree (reservation_id);


--
-- Name: idx_cleaning_tasks_room_unit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_room_unit_date ON public.cleaning_tasks USING btree (room_unit_id, task_date);


--
-- Name: idx_cleaning_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_status ON public.cleaning_tasks USING btree (status);


--
-- Name: idx_comp_daily_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_daily_date_range ON public.comp_daily USING btree (dt);


--
-- Name: idx_comp_daily_set_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_daily_set_date ON public.comp_daily USING btree (comp_set_id, dt);


--
-- Name: idx_comp_members_set_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_members_set_active ON public.comp_members USING btree (comp_set_id) WHERE is_active;


--
-- Name: idx_comp_sets_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_sets_location ON public.comp_sets USING btree (location_id) WHERE is_active;


--
-- Name: idx_email_matches_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_matches_confidence ON public.email_thread_matches USING btree (confidence_level);


--
-- Name: idx_email_matches_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_matches_thread_id ON public.email_thread_matches USING btree (thread_id);


--
-- Name: idx_email_metadata_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_metadata_created_at ON public.email_metadata USING btree (created_at);


--
-- Name: idx_email_metadata_email_in_reply_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_metadata_email_in_reply_to ON public.email_metadata USING btree (email_in_reply_to);


--
-- Name: idx_email_metadata_email_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_metadata_email_message_id ON public.email_metadata USING btree (email_message_id);


--
-- Name: idx_email_metadata_email_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_metadata_email_name ON public.email_metadata USING btree (email_name);


--
-- Name: idx_email_metadata_email_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_metadata_email_thread_id ON public.email_metadata USING btree (email_thread_id);


--
-- Name: idx_email_metadata_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_metadata_message_id ON public.email_metadata USING btree (message_id);


--
-- Name: idx_events_daterange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_daterange ON public.events USING btree (start_date, end_date) WHERE is_active;


--
-- Name: idx_events_location_daterange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_location_daterange ON public.events USING btree (location_id, start_date, end_date) WHERE is_active;


--
-- Name: idx_gmail_processed_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gmail_processed_message_id ON public.gmail_processed_messages USING btree (gmail_message_id);


--
-- Name: idx_guest_services_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_services_active ON public.guest_services USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_guest_services_service_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_services_service_key ON public.guest_services USING btree (service_key);


--
-- Name: idx_holidays_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holidays_date_range ON public.holidays USING btree (dt) WHERE is_active;


--
-- Name: idx_holidays_location_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holidays_location_date ON public.holidays USING btree (location_id, dt) WHERE is_active;


--
-- Name: idx_listing_prices_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listing_prices_date_range ON public.listing_prices USING btree (dt);


--
-- Name: idx_listing_prices_room_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listing_prices_room_type_date ON public.listing_prices USING btree (room_type_id, dt);


--
-- Name: idx_market_factors_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_factors_date ON public.market_factors USING btree (dt);


--
-- Name: idx_market_factors_location_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_factors_location_date ON public.market_factors USING btree (location_id, dt);


--
-- Name: idx_market_factors_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_factors_updated_at ON public.market_factors USING btree (updated_at DESC);


--
-- Name: idx_message_attachments_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);


--
-- Name: idx_message_deliveries_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_deliveries_message_id ON public.message_deliveries USING btree (message_id);


--
-- Name: idx_message_deliveries_status_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_deliveries_status_channel ON public.message_deliveries USING btree (status, channel);


--
-- Name: idx_message_participants_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_participants_thread_id ON public.message_participants USING btree (thread_id);


--
-- Name: idx_message_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_participants_user_id ON public.message_participants USING btree (user_id);


--
-- Name: idx_message_templates_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_channel ON public.message_templates USING btree (channel);


--
-- Name: idx_message_templates_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_enabled ON public.message_templates USING btree (enabled);


--
-- Name: idx_message_templates_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_templates_property_id ON public.message_templates USING btree (property_id);


--
-- Name: idx_message_threads_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_assignee ON public.message_threads USING btree (assignee_user_id);


--
-- Name: idx_message_threads_reservation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_reservation_id ON public.message_threads USING btree (reservation_id);


--
-- Name: idx_message_threads_status_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_threads_status_last_message ON public.message_threads USING btree (status, last_message_at DESC);


--
-- Name: idx_messages_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel ON public.messages USING btree (channel);


--
-- Name: idx_messages_is_unsent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_is_unsent ON public.messages USING btree (is_unsent);


--
-- Name: idx_messages_origin_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_origin_role ON public.messages USING btree (origin_role);


--
-- Name: idx_messages_thread_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_thread_created ON public.messages USING btree (thread_id, created_at DESC);


--
-- Name: idx_messages_unsent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unsent_at ON public.messages USING btree (unsent_at) WHERE (unsent_at IS NOT NULL);


--
-- Name: idx_payment_intents_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_reservation ON public.payment_intents USING btree (reservation_id);


--
-- Name: idx_payment_intents_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_service ON public.payment_intents USING btree (service_type);


--
-- Name: idx_payment_intents_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_intents_stripe ON public.payment_intents USING btree (stripe_payment_intent_id);


--
-- Name: idx_pricing_audit_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_audit_latest ON public.pricing_audit USING btree (room_type_id, dt, created_at DESC);


--
-- Name: idx_pricing_audit_room_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_audit_room_type_date ON public.pricing_audit USING btree (room_type_id, dt);


--
-- Name: idx_pricing_recalc_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_recalc_queue_pending ON public.pricing_recalc_queue USING btree (status, created_at);


--
-- Name: idx_pricing_rules_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_rules_room_type_id ON public.pricing_rules USING btree (room_type_id);


--
-- Name: idx_properties_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_active ON public.properties USING btree (is_active);


--
-- Name: idx_properties_default_cleaner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_default_cleaner_id ON public.properties USING btree (default_cleaner_id);


--
-- Name: idx_properties_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_owner_id ON public.properties USING btree (owner_id);


--
-- Name: idx_property_images_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_images_property_id ON public.property_images USING btree (property_id);


--
-- Name: idx_property_images_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_images_room_type_id ON public.property_images USING btree (room_type_id);


--
-- Name: idx_property_images_room_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_images_room_unit_id ON public.property_images USING btree (room_unit_id);


--
-- Name: idx_property_translations_field; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_translations_field ON public.property_translations USING btree (property_id, field_name);


--
-- Name: idx_property_translations_property_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_translations_property_language ON public.property_translations USING btree (property_id, language_code);


--
-- Name: idx_property_translations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_translations_status ON public.property_translations USING btree (property_id, is_approved);


--
-- Name: idx_reservation_addons_admin_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_addons_admin_enabled ON public.reservation_addons USING btree (admin_enabled) WHERE (admin_enabled = true);


--
-- Name: idx_reservation_addons_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_addons_reservation ON public.reservation_addons USING btree (reservation_id);


--
-- Name: idx_reservation_addons_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_addons_status ON public.reservation_addons USING btree (purchase_status);


--
-- Name: idx_reservation_guests_admin_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_guests_admin_verified ON public.reservation_guests USING btree (admin_verified, verified_at);


--
-- Name: idx_reservation_guests_checkin_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_guests_checkin_status ON public.reservation_guests USING btree (reservation_id, checkin_submitted_at);


--
-- Name: idx_reservation_guests_guest_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_guests_guest_number ON public.reservation_guests USING btree (reservation_id, guest_number);


--
-- Name: idx_reservation_guests_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_guests_primary ON public.reservation_guests USING btree (reservation_id, is_primary_guest) WHERE (is_primary_guest = true);


--
-- Name: idx_reservation_guests_reservation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_guests_reservation_id ON public.reservation_guests USING btree (reservation_id);


--
-- Name: idx_reservation_segments_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_segments_dates ON public.reservation_segments USING btree (start_date, end_date);


--
-- Name: idx_reservation_segments_no_overlap; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_reservation_segments_no_overlap ON public.reservation_segments USING btree (room_unit_id, start_date, end_date);


--
-- Name: idx_reservation_segments_reservation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_segments_reservation_id ON public.reservation_segments USING btree (reservation_id);


--
-- Name: idx_reservation_segments_room_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_segments_room_dates ON public.reservation_segments USING btree (room_unit_id, start_date, end_date);


--
-- Name: idx_reservation_segments_room_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservation_segments_room_unit_id ON public.reservation_segments USING btree (room_unit_id);


--
-- Name: idx_reservations_beds24_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_beds24_booking_id ON public.reservations USING btree (beds24_booking_id);


--
-- Name: idx_reservations_booking_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_booking_email ON public.reservations USING btree (booking_email);


--
-- Name: idx_reservations_check_in_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_check_in_date ON public.reservations USING btree (check_in_date);


--
-- Name: idx_reservations_check_in_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_check_in_token ON public.reservations USING btree (check_in_token);


--
-- Name: idx_reservations_group_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_group_ids ON public.reservations USING gin (booking_group_ids) WHERE (booking_group_ids IS NOT NULL);


--
-- Name: idx_reservations_group_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_group_master ON public.reservations USING btree (booking_group_master_id) WHERE (booking_group_master_id IS NOT NULL);


--
-- Name: idx_reservations_is_group_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_is_group_master ON public.reservations USING btree (is_group_master) WHERE (is_group_master = true);


--
-- Name: idx_reservations_property_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_property_date ON public.reservations USING btree (property_id, check_in_date);


--
-- Name: idx_reservations_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_property_id ON public.reservations USING btree (property_id);


--
-- Name: idx_reservations_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_room_type_id ON public.reservations USING btree (room_type_id);


--
-- Name: idx_reservations_room_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_room_unit_id ON public.reservations USING btree (room_unit_id);


--
-- Name: idx_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_status ON public.reservations USING btree (status);


--
-- Name: idx_reservations_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_status_date ON public.reservations USING btree (status, check_in_date);


--
-- Name: idx_room_type_translations_field; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_type_translations_field ON public.room_type_translations USING btree (room_type_id, field_name);


--
-- Name: idx_room_type_translations_room_type_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_type_translations_room_type_language ON public.room_type_translations USING btree (room_type_id, language_code);


--
-- Name: idx_room_type_translations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_type_translations_status ON public.room_type_translations USING btree (room_type_id, is_approved);


--
-- Name: idx_room_types_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_types_active ON public.room_types USING btree (is_active);


--
-- Name: idx_room_types_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_types_name ON public.room_types USING btree (name);


--
-- Name: idx_room_types_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_types_property_id ON public.room_types USING btree (property_id);


--
-- Name: idx_room_units_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_active ON public.room_units USING btree (is_active);


--
-- Name: idx_room_units_floor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_floor ON public.room_units USING btree (floor_number);


--
-- Name: idx_room_units_room_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_room_type_active ON public.room_units USING btree (room_type_id, is_active);


--
-- Name: idx_room_units_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_room_type_id ON public.room_units USING btree (room_type_id);


--
-- Name: idx_room_units_unit_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_unit_number ON public.room_units USING btree (unit_number);


--
-- Name: idx_scheduled_messages_reservation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_messages_reservation_id ON public.scheduled_messages USING btree (reservation_id);


--
-- Name: idx_scheduled_messages_rule_reservation_queued; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_scheduled_messages_rule_reservation_queued ON public.scheduled_messages USING btree (rule_id, reservation_id) WHERE (status = 'queued'::text);


--
-- Name: idx_scheduled_messages_status_run_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_messages_status_run_at ON public.scheduled_messages USING btree (status, run_at);


--
-- Name: idx_scheduled_messages_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_messages_thread_id ON public.scheduled_messages USING btree (thread_id);


--
-- Name: idx_seasonality_location_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seasonality_location_active ON public.seasonality_settings USING btree (location_id, is_active) WHERE (is_active = true);


--
-- Name: idx_seasonality_location_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_seasonality_location_order ON public.seasonality_settings USING btree (location_id, display_order) WHERE (is_active = true);


--
-- Name: idx_stripe_events_processed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_events_processed_at ON public.stripe_events USING btree (processed_at);


--
-- Name: idx_thread_channels_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_channels_channel ON public.thread_channels USING btree (channel);


--
-- Name: idx_thread_channels_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thread_channels_thread_id ON public.thread_channels USING btree (thread_id);


--
-- Name: idx_threads_email_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_email_thread_id ON public.message_threads USING btree (email_thread_id) WHERE (email_thread_id IS NOT NULL);


--
-- Name: idx_threads_needs_linking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_needs_linking ON public.message_threads USING btree (needs_linking) WHERE (needs_linking = true);


--
-- Name: idx_user_profiles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_active ON public.user_profiles USING btree (is_active);


--
-- Name: idx_user_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);


--
-- Name: idx_webhook_events_beds24_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_beds24_event_id ON public.webhook_events USING btree (beds24_event_id);


--
-- Name: idx_webhook_events_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_processed ON public.webhook_events USING btree (processed);


--
-- Name: messages_content_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_content_tsv_idx ON public.messages USING gin (content_tsv);


--
-- Name: unique_channel_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_channel_provider_id ON public.message_deliveries USING btree (channel, provider_message_id) WHERE (provider_message_id IS NOT NULL);


--
-- Name: unique_participant_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_participant_external ON public.message_participants USING btree (thread_id, participant_type, external_address) WHERE (external_address IS NOT NULL);


--
-- Name: unique_participant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_participant_user ON public.message_participants USING btree (thread_id, participant_type, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: reservations auto_manage_cleaning_task; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_manage_cleaning_task AFTER INSERT OR UPDATE OF room_unit_id, check_out_date ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.manage_cleaning_task();


--
-- Name: cleaning_tasks check_cleaner_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_cleaner_role BEFORE INSERT OR UPDATE OF cleaner_id ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_cleaner_role();


--
-- Name: reservations manage_cleaning_task_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER manage_cleaning_task_trigger AFTER INSERT OR UPDATE OF check_out_date, room_unit_id, property_id ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.manage_cleaning_task();


--
-- Name: reservations manage_cleaning_tasks_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER manage_cleaning_tasks_trigger AFTER INSERT OR UPDATE OF room_unit_id, check_out_date ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.manage_cleaning_task();


--
-- Name: message_deliveries message_deliveries_status_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER message_deliveries_status_ts BEFORE INSERT OR UPDATE ON public.message_deliveries FOR EACH ROW EXECUTE FUNCTION public.message_deliveries_status_trigger();


--
-- Name: TRIGGER message_deliveries_status_ts ON message_deliveries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER message_deliveries_status_ts ON public.message_deliveries IS 'Automatically updates timestamp fields (queued_at, sent_at, delivered_at, read_at) when status changes';


--
-- Name: reservations propagate_booking_name_to_ct; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER propagate_booking_name_to_ct AFTER UPDATE OF booking_name ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.propagate_booking_name_to_ct();


--
-- Name: reservations reservation_pricing_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reservation_pricing_trigger AFTER INSERT OR DELETE OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.trigger_pricing_recalculation();


--
-- Name: reservations set_checkin_token; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_checkin_token BEFORE INSERT ON public.reservations FOR EACH ROW WHEN ((new.check_in_token IS NULL)) EXECUTE FUNCTION public.generate_checkin_token();


--
-- Name: cleaning_tasks set_ct_booking_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ct_booking_name BEFORE INSERT OR UPDATE OF reservation_id ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.set_ct_booking_name();


--
-- Name: reservations set_reservation_booking_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_reservation_booking_name BEFORE INSERT OR UPDATE OF booking_firstname, booking_lastname ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.set_reservation_booking_name();


--
-- Name: beds24_auth trg_beds24_auth_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_beds24_auth_updated BEFORE UPDATE ON public.beds24_auth FOR EACH ROW EXECUTE FUNCTION public.update_beds24_auth_updated_at();


--
-- Name: reservations trg_cancel_cleaning_task_if_res_cancelled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cancel_cleaning_task_if_res_cancelled AFTER UPDATE OF status ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.cancel_cleaning_task_if_res_cancelled();


--
-- Name: reservations trg_maintain_group_booking_consistency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_maintain_group_booking_consistency AFTER UPDATE ON public.reservations FOR EACH ROW WHEN (((new.is_group_master = true) AND (new.booking_group_master_id IS NOT NULL))) EXECUTE FUNCTION public.maintain_group_booking_consistency();


--
-- Name: TRIGGER trg_maintain_group_booking_consistency ON reservations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trg_maintain_group_booking_consistency ON public.reservations IS 'Maintains consistency across group booking reservations when master reservation changes';


--
-- Name: message_deliveries trg_message_deliveries_status_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_message_deliveries_status_ts BEFORE INSERT OR UPDATE ON public.message_deliveries FOR EACH ROW EXECUTE FUNCTION public.message_deliveries_status_ts();


--
-- Name: message_deliveries trg_message_deliveries_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_message_deliveries_updated BEFORE UPDATE ON public.message_deliveries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages trg_messages_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservation_segments trg_reservation_segments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reservation_segments_updated_at BEFORE UPDATE ON public.reservation_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservations trg_revoke_checkin_token; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_revoke_checkin_token BEFORE UPDATE ON public.reservations FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.revoke_checkin_token();


--
-- Name: room_units trg_room_units_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_room_units_sync AFTER INSERT OR DELETE OR UPDATE ON public.room_units FOR EACH ROW EXECUTE FUNCTION public.trg_sync_room_type_total_units();


--
-- Name: cleaning_tasks trg_set_cleaning_status_on_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_cleaning_status_on_insert BEFORE INSERT ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.set_cleaning_status_on_insert_if_cancelled();


--
-- Name: reservations trg_sync_cleaning_status_from_reservation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_cleaning_status_from_reservation AFTER UPDATE OF status ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.sync_cleaning_status_from_reservation();


--
-- Name: message_threads trg_threads_set_subject; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_threads_set_subject BEFORE INSERT OR UPDATE OF reservation_id, subject ON public.message_threads FOR EACH ROW EXECUTE FUNCTION public.set_default_thread_subject();


--
-- Name: message_threads trg_threads_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_threads_updated BEFORE UPDATE ON public.message_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservations trg_update_cleaning_status_on_res_cancel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_cleaning_status_on_res_cancel AFTER UPDATE OF status ON public.reservations FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.update_cleaning_status_on_res_cancel();


--
-- Name: messages trg_update_thread_on_message_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_thread_on_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_thread_metadata();


--
-- Name: messages trg_update_thread_on_message_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_thread_on_message_update AFTER UPDATE ON public.messages FOR EACH ROW WHEN (((old.content IS DISTINCT FROM new.content) OR (old.created_at IS DISTINCT FROM new.created_at))) EXECUTE FUNCTION public.update_thread_metadata();


--
-- Name: email_metadata trigger_email_metadata_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_email_metadata_updated_at BEFORE UPDATE ON public.email_metadata FOR EACH ROW EXECUTE FUNCTION public.update_email_metadata_updated_at();


--
-- Name: seasonality_settings trigger_seasonality_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_seasonality_settings_updated_at BEFORE UPDATE ON public.seasonality_settings FOR EACH ROW EXECUTE FUNCTION public.update_seasonality_settings_updated_at();


--
-- Name: accommodation_tax_invoices update_accommodation_tax_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accommodation_tax_updated_at BEFORE UPDATE ON public.accommodation_tax_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cleaning_tasks update_cleaning_task_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cleaning_task_updated_at BEFORE UPDATE ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.update_cleaning_task_updated_at();


--
-- Name: comp_members update_comp_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comp_members_updated_at BEFORE UPDATE ON public.comp_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: comp_sets update_comp_sets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comp_sets_updated_at BEFORE UPDATE ON public.comp_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: guest_payment_services update_guest_payment_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_guest_payment_services_updated_at BEFORE UPDATE ON public.guest_payment_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: guest_services update_guest_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_guest_services_updated_at BEFORE UPDATE ON public.guest_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: holidays update_holidays_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_holidays_updated_at BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: listing_prices update_listing_prices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_listing_prices_updated_at BEFORE UPDATE ON public.listing_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: market_factors update_market_factors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_market_factors_updated_at BEFORE UPDATE ON public.market_factors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: market_tuning update_market_tuning_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_market_tuning_updated_at BEFORE UPDATE ON public.market_tuning FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_intents update_payment_intents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_intents_updated_at BEFORE UPDATE ON public.payment_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pricing_rules update_pricing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: properties update_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservation_addons update_reservation_addons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reservation_addons_updated_at BEFORE UPDATE ON public.reservation_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reservation_guests update_reservation_guests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reservation_guests_updated_at BEFORE UPDATE ON public.reservation_guests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: room_types update_room_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_room_types_updated_at BEFORE UPDATE ON public.room_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: room_units update_room_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_room_units_updated_at BEFORE UPDATE ON public.room_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: accommodation_tax_invoices accommodation_tax_invoices_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accommodation_tax_invoices
    ADD CONSTRAINT accommodation_tax_invoices_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: automation_rules automation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: automation_rules automation_rules_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: automation_rules automation_rules_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.message_templates(id);


--
-- Name: cleaning_tasks cleaning_tasks_cleaner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_cleaner_id_fkey FOREIGN KEY (cleaner_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: comp_daily comp_daily_comp_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_daily
    ADD CONSTRAINT comp_daily_comp_set_id_fkey FOREIGN KEY (comp_set_id) REFERENCES public.comp_sets(id) ON DELETE CASCADE;


--
-- Name: comp_members comp_members_comp_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_members
    ADD CONSTRAINT comp_members_comp_set_id_fkey FOREIGN KEY (comp_set_id) REFERENCES public.comp_sets(id) ON DELETE CASCADE;


--
-- Name: email_metadata email_metadata_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_metadata
    ADD CONSTRAINT email_metadata_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: email_thread_matches email_thread_matches_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_thread_matches
    ADD CONSTRAINT email_thread_matches_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id);


--
-- Name: cleaning_tasks fk_cleaning_task_property; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT fk_cleaning_task_property FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: cleaning_tasks fk_cleaning_task_reservation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT fk_cleaning_task_reservation FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: cleaning_tasks fk_cleaning_task_room_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT fk_cleaning_task_room_unit FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON DELETE CASCADE;


--
-- Name: scheduled_messages fk_scheduled_messages_rule_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT fk_scheduled_messages_rule_id FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: gmail_processed_messages gmail_processed_messages_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_processed_messages
    ADD CONSTRAINT gmail_processed_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: gmail_processed_messages gmail_processed_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_processed_messages
    ADD CONSTRAINT gmail_processed_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id);


--
-- Name: guest_channel_consents guest_channel_consents_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_channel_consents
    ADD CONSTRAINT guest_channel_consents_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: listing_prices listing_prices_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_prices
    ADD CONSTRAINT listing_prices_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_deliveries message_deliveries_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deliveries
    ADD CONSTRAINT message_deliveries_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_participants message_participants_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_participants
    ADD CONSTRAINT message_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: message_participants message_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_participants
    ADD CONSTRAINT message_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: message_templates message_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: message_templates message_templates_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: message_threads message_threads_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: message_threads message_threads_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE SET NULL;


--
-- Name: messages messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: payment_intents payment_intents_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: pricing_audit pricing_audit_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_audit
    ADD CONSTRAINT pricing_audit_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: pricing_recalc_queue pricing_recalc_queue_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_recalc_queue
    ADD CONSTRAINT pricing_recalc_queue_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: pricing_runs pricing_runs_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_runs
    ADD CONSTRAINT pricing_runs_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id);


--
-- Name: properties properties_default_cleaner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_default_cleaner_id_fkey FOREIGN KEY (default_cleaner_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: properties properties_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: property_images property_images_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_images property_images_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: property_images property_images_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON DELETE CASCADE;


--
-- Name: property_translations property_translations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_translations
    ADD CONSTRAINT property_translations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: property_translations property_translations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_translations
    ADD CONSTRAINT property_translations_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: reservation_addons reservation_addons_exempted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_addons
    ADD CONSTRAINT reservation_addons_exempted_by_fkey FOREIGN KEY (exempted_by) REFERENCES public.users(id);


--
-- Name: reservation_addons reservation_addons_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_addons
    ADD CONSTRAINT reservation_addons_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: reservation_addons reservation_addons_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_addons
    ADD CONSTRAINT reservation_addons_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.guest_services(id);


--
-- Name: reservation_guests reservation_guests_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guests
    ADD CONSTRAINT reservation_guests_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: reservation_guests reservation_guests_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guests
    ADD CONSTRAINT reservation_guests_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: reservation_segments reservation_segments_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segments
    ADD CONSTRAINT reservation_segments_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: reservation_segments reservation_segments_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segments
    ADD CONSTRAINT reservation_segments_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON DELETE RESTRICT;


--
-- Name: reservations reservations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON DELETE SET NULL;


--
-- Name: room_type_translations room_type_translations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_translations
    ADD CONSTRAINT room_type_translations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: room_type_translations room_type_translations_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_translations
    ADD CONSTRAINT room_type_translations_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: room_types room_types_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: room_units room_units_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_units
    ADD CONSTRAINT room_units_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id) ON DELETE CASCADE;


--
-- Name: scheduled_messages scheduled_messages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: scheduled_messages scheduled_messages_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE SET NULL;


--
-- Name: scheduled_messages scheduled_messages_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: scheduled_messages scheduled_messages_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.message_templates(id) ON DELETE RESTRICT;


--
-- Name: scheduled_messages scheduled_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: seasonality_settings seasonality_settings_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasonality_settings
    ADD CONSTRAINT seasonality_settings_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: thread_channels thread_channels_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_channels
    ADD CONSTRAINT thread_channels_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: thread_labels thread_labels_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thread_labels
    ADD CONSTRAINT thread_labels_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: properties Service role can manage properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage properties" ON public.properties USING ((auth.role() = 'service_role'::text));


--
-- Name: property_images Service role can manage property_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage property_images" ON public.property_images USING ((auth.role() = 'service_role'::text));


--
-- Name: user_profiles Service role can manage user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage user_profiles" ON public.user_profiles USING ((auth.role() = 'service_role'::text));


--
-- Name: webhook_events Service role can manage webhook_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage webhook_events" ON public.webhook_events USING ((auth.role() = 'service_role'::text));


--
-- Name: user_profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: cleaning_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: message_deliveries message_deliveries_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_deliveries_policy ON public.message_deliveries USING ((EXISTS ( SELECT 1
   FROM (((public.messages m
     JOIN public.message_threads mt ON ((m.thread_id = mt.id)))
     JOIN public.reservations r ON ((mt.reservation_id = r.id)))
     JOIN public.properties p ON ((r.property_id = p.id)))
  WHERE ((m.id = message_deliveries.message_id) AND ((p.owner_id = auth.uid()) OR (auth.uid() IN ( SELECT user_profiles.id
           FROM public.user_profiles
          WHERE (user_profiles.role = 'admin'::public.user_role))) OR (auth.uid() IS NULL))))));


--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: property_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: room_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;

--
-- Name: room_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_units ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Allow message attachments uploads; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow message attachments uploads" ON storage.objects USING ((bucket_id = 'message-attachments'::text)) WITH CHECK ((bucket_id = 'message-attachments'::text));


--
-- Name: objects Service role can manage guest documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Service role can manage guest documents" ON storage.objects USING ((bucket_id = 'guest-documents'::text)) WITH CHECK ((bucket_id = 'guest-documents'::text));


--
-- Name: objects Service role can manage property images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Service role can manage property images" ON storage.objects USING (((bucket_id = 'property-images'::text) AND (auth.role() = 'service_role'::text)));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


-- Migration: Create reservation_guests table for 1:many guest relationship
-- This script creates the new reservation_guests table to support multiple guests per reservation

-- Create reservation_guests table
CREATE TABLE public.reservation_guests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reservation_id uuid NOT NULL,
    guest_number integer NOT NULL,
    is_primary_guest boolean DEFAULT false NOT NULL,
    
    -- Personal guest information (migrated from reservations table)
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
    
    -- Check-in process fields
    agreement_accepted boolean DEFAULT false,
    checkin_submitted_at timestamp with time zone,
    admin_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    verified_by uuid,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Primary key
    CONSTRAINT reservation_guests_pkey PRIMARY KEY (id),
    
    -- Foreign key to reservations
    CONSTRAINT reservation_guests_reservation_id_fkey 
        FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE,
    
    -- Foreign key to user_profiles for verified_by
    CONSTRAINT reservation_guests_verified_by_fkey 
        FOREIGN KEY (verified_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    
    -- Unique constraint: each reservation can have only one guest with a specific guest_number
    CONSTRAINT reservation_guests_reservation_guest_number_unique 
        UNIQUE (reservation_id, guest_number),
    
    -- Check constraints
    CONSTRAINT reservation_guests_guest_number_positive 
        CHECK (guest_number > 0),
    
    -- Only guest_number = 1 can be primary guest
    CONSTRAINT reservation_guests_primary_guest_logic 
        CHECK ((is_primary_guest = true AND guest_number = 1) OR (is_primary_guest = false))
);

-- Create indexes for performance
CREATE INDEX idx_reservation_guests_reservation_id ON public.reservation_guests(reservation_id);
CREATE INDEX idx_reservation_guests_guest_number ON public.reservation_guests(reservation_id, guest_number);
CREATE INDEX idx_reservation_guests_primary ON public.reservation_guests(reservation_id, is_primary_guest) WHERE is_primary_guest = true;
CREATE INDEX idx_reservation_guests_checkin_status ON public.reservation_guests(reservation_id, checkin_submitted_at);
CREATE INDEX idx_reservation_guests_admin_verified ON public.reservation_guests(admin_verified, verified_at);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_reservation_guests_updated_at
    BEFORE UPDATE ON public.reservation_guests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.reservation_guests IS 'Individual guest information for reservations. Supports multiple guests per reservation with 1:many relationship.';
COMMENT ON COLUMN public.reservation_guests.guest_number IS 'Sequential number of guest within reservation (1, 2, 3, etc.)';
COMMENT ON COLUMN public.reservation_guests.is_primary_guest IS 'True only for guest_number = 1, identifies the main guest';
COMMENT ON CONSTRAINT reservation_guests_reservation_guest_number_unique ON public.reservation_guests IS 'Ensures each guest_number is unique within a reservation';
COMMENT ON CONSTRAINT reservation_guests_primary_guest_logic ON public.reservation_guests IS 'Ensures only guest #1 can be marked as primary guest';

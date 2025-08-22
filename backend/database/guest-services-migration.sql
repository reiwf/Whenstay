-- Guest Services Enhancement Migration
-- This migration adds support for purchasable guest services/addons with time overrides

-- Services/Products catalog table
CREATE TABLE guest_services (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  service_key varchar(50) UNIQUE NOT NULL, -- 'early_checkin', 'late_checkout', 'extra_cleaning', etc.
  name varchar(100) NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  currency varchar(3) DEFAULT 'JPY',
  requires_admin_activation boolean DEFAULT false, -- Admin must enable for specific reservations
  is_mandatory boolean DEFAULT false, -- Service is automatically required for all reservations
  requires_calculation boolean DEFAULT false, -- Price needs dynamic calculation (like accommodation tax)
  access_time_override_hours integer, -- For early checkin: -2 (2 hours early), null if no override
  departure_time_override_hours integer, -- For late checkout: +3 (3 hours late), null if no override
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Reservation addons (purchased/enabled services for specific reservations)
CREATE TABLE reservation_addons (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES guest_services(id),
  admin_enabled boolean DEFAULT false, -- Admin made this service available for purchase
  purchase_status varchar(20) DEFAULT 'available', -- available, pending, paid, failed
  stripe_payment_intent_id varchar(100),
  amount_paid numeric(10,2),
  calculated_amount numeric(10,2), -- For dynamic pricing services like accommodation tax
  is_tax_exempted boolean DEFAULT false, -- Admin can exempt from accommodation tax
  tax_calculation_details jsonb, -- Store calculation breakdown for transparency
  access_time_override time, -- Calculated specific override time for this reservation
  departure_time_override time, -- Calculated specific override time for this reservation
  purchased_at timestamptz,
  exempted_at timestamptz, -- When exemption was granted
  exempted_by uuid REFERENCES users(id), -- Admin who granted exemption
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT reservation_addons_status_check CHECK (
    purchase_status IN ('available', 'pending', 'paid', 'failed', 'exempted')
  ),
  CONSTRAINT reservation_addons_unique_service UNIQUE (reservation_id, service_id)
);

-- Indexes for performance
CREATE INDEX idx_guest_services_active ON guest_services(is_active) WHERE is_active = true;
CREATE INDEX idx_guest_services_service_key ON guest_services(service_key);
CREATE INDEX idx_reservation_addons_reservation ON reservation_addons(reservation_id);
CREATE INDEX idx_reservation_addons_status ON reservation_addons(purchase_status);
CREATE INDEX idx_reservation_addons_admin_enabled ON reservation_addons(admin_enabled) WHERE admin_enabled = true;

-- Triggers for updated_at
CREATE TRIGGER update_guest_services_updated_at 
  BEFORE UPDATE ON guest_services 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservation_addons_updated_at 
  BEFORE UPDATE ON reservation_addons 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default services
INSERT INTO guest_services (service_key, name, description, price, currency, requires_admin_activation, is_mandatory, requires_calculation, access_time_override_hours, departure_time_override_hours) VALUES
('accommodation_tax', 'Accommodation Tax', 'Local accommodation tax based on reservation amount. Tax rates: No tax (<¥5,000), ¥200 (¥5,000-¥15,000), ¥400 (¥15,000-¥20,000), ¥500 (≥¥20,000) per person per night.', 0, 'JPY', false, true, true, null, null),
('early_checkin', 'Early Check-in', 'Check in up to 2 hours before standard time', 2000, 'JPY', true, false, false, -2, null),
('late_checkout', 'Late Check-out', 'Check out up to 3 hours after standard time', 3000, 'JPY', true, false, false, null, 3),
('extra_cleaning', 'Extra Cleaning Service', 'Additional deep cleaning service', 5000, 'JPY', true, false, false, null, null),
('luggage_storage', 'Luggage Storage', 'Store luggage before check-in or after check-out', 1000, 'JPY', true, false, false, null, null);

-- Comments for documentation
COMMENT ON TABLE guest_services IS 'Catalog of available guest services/addons with pricing and time override configurations';
COMMENT ON TABLE reservation_addons IS 'Tracks which services are enabled/purchased for specific reservations';
COMMENT ON COLUMN guest_services.access_time_override_hours IS 'Hours to adjust access time (negative for early, positive for late)';
COMMENT ON COLUMN guest_services.departure_time_override_hours IS 'Hours to adjust departure time (positive for extension)';
COMMENT ON COLUMN reservation_addons.admin_enabled IS 'Whether admin has made this service available for this specific reservation';
COMMENT ON COLUMN reservation_addons.access_time_override IS 'Calculated specific override time for this reservation based on property time + service offset';
COMMENT ON COLUMN reservation_addons.departure_time_override IS 'Calculated specific override time for this reservation based on property time + service offset';

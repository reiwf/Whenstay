-- Create comprehensive payment transactions table for tracking all payment events
CREATE TABLE payment_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    payment_intent_id uuid REFERENCES payment_intents(id) ON DELETE CASCADE,
    stripe_transaction_id character varying(100) NOT NULL,
    transaction_type character varying(20) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) NOT NULL DEFAULT 'JPY',
    status character varying(50) NOT NULL,
    stripe_data jsonb,
    processed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT payment_transactions_type_check 
        CHECK (transaction_type IN ('payment', 'refund', 'partial_refund', 'void')),
    CONSTRAINT payment_transactions_status_check 
        CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'requires_action')),
    CONSTRAINT payment_transactions_amount_positive 
        CHECK (amount > 0)
);

-- Create indexes for efficient querying
CREATE INDEX idx_payment_transactions_payment_intent_id 
    ON payment_transactions (payment_intent_id);
CREATE INDEX idx_payment_transactions_stripe_id 
    ON payment_transactions (stripe_transaction_id);
CREATE INDEX idx_payment_transactions_type_status 
    ON payment_transactions (transaction_type, status);
CREATE INDEX idx_payment_transactions_created_at 
    ON payment_transactions (created_at DESC);
CREATE INDEX idx_payment_transactions_amount 
    ON payment_transactions (amount);

-- Create unique constraint to prevent duplicate transactions
CREATE UNIQUE INDEX idx_payment_transactions_stripe_unique 
    ON payment_transactions (stripe_transaction_id);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create comprehensive view for payment reporting
CREATE VIEW payment_transactions_detailed AS
SELECT 
    pt.id,
    pt.payment_intent_id,
    pt.stripe_transaction_id,
    pt.transaction_type,
    pt.amount,
    pt.currency,
    pt.status,
    pt.processed_at,
    pt.created_at,
    pt.updated_at,
    pi.reservation_id,
    pi.service_type,
    r.beds24_booking_id,
    r.booking_name,
    r.booking_email,
    r.check_in_date,
    r.check_out_date,
    p.name as property_name,
    -- Calculate total refunded amount for this payment intent
    (SELECT COALESCE(SUM(pt2.amount), 0) 
     FROM payment_transactions pt2 
     WHERE pt2.payment_intent_id = pt.payment_intent_id 
     AND pt2.transaction_type IN ('refund', 'partial_refund')
     AND pt2.status = 'succeeded') as total_refunded,
    -- Calculate net amount (original payment minus refunds)
    CASE 
        WHEN pt.transaction_type = 'payment' 
        THEN pt.amount - (SELECT COALESCE(SUM(pt2.amount), 0) 
                         FROM payment_transactions pt2 
                         WHERE pt2.payment_intent_id = pt.payment_intent_id 
                         AND pt2.transaction_type IN ('refund', 'partial_refund')
                         AND pt2.status = 'succeeded')
        ELSE pt.amount
    END as net_amount
FROM payment_transactions pt
LEFT JOIN payment_intents pi ON pt.payment_intent_id = pi.id
LEFT JOIN reservations r ON pi.reservation_id = r.id
LEFT JOIN properties p ON r.property_id = p.id;

-- Add comment for documentation
COMMENT ON TABLE payment_transactions IS 'Comprehensive tracking of all payment events including payments, refunds, and voids';
COMMENT ON COLUMN payment_transactions.transaction_type IS 'Type of transaction: payment, refund, partial_refund, void';
COMMENT ON COLUMN payment_transactions.stripe_data IS 'Complete Stripe object data for audit trail';
COMMENT ON VIEW payment_transactions_detailed IS 'Detailed view of payment transactions with reservation and refund summary data';

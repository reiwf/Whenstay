const Stripe = require('stripe');
const { supabaseAdmin } = require('../config/supabase');

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  /**
   * Create a Stripe hosted checkout session for guest services
   */
  async createCheckoutSession({
    amount,
    currency = 'jpy',
    reservationId,
    serviceType,
    guestEmail,
    metadata = {},
    successUrl,
    cancelUrl
  }) {
    try {
      // Fetch primary guest information for the description and email
      const { data: guestData } = await supabaseAdmin
        .from('reservation_guests')
        .select('guest_firstname, guest_lastname, guest_mail')
        .eq('reservation_id', reservationId)
        .eq('is_primary_guest', true)
        .single();

      // Create guest name string, fallback to reservation ID if guest data not found
      const guestName = guestData && guestData.guest_firstname && guestData.guest_lastname
        ? `${guestData.guest_firstname} ${guestData.guest_lastname}`
        : `reservation ${reservationId}`;

      // Use guest email from reservation_guests table, fallback to provided guestEmail
      const primaryGuestEmail = guestData && guestData.guest_mail ? guestData.guest_mail : guestEmail;

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: this.getServiceName(serviceType),
                description: `for ${guestName}`,
              },
              unit_amount: this.convertToSmallestUnit(amount, currency), // Convert to smallest currency unit
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: primaryGuestEmail,
        metadata: {
          reservation_id: reservationId,
          service_type: serviceType,
          ...metadata
        },
        automatic_tax: {
          enabled: false, // We're handling accommodation tax manually
        },
      });

      // Store checkout session in database
      const { data, error } = await supabaseAdmin
        .from('payment_intents')
        .insert({
          reservation_id: reservationId,
          service_type: serviceType,
          stripe_payment_intent_id: session.id, // Store session ID in payment_intent_id field
          amount: amount,
          currency: currency.toUpperCase(),
          status: 'pending',
          client_secret: session.url, // Store checkout URL
          metadata: {
            stripe_metadata: session.metadata,
            checkout_url: session.url,
            checkout_session_id: session.id, // Store session ID in metadata
            ...metadata
          }
        });

      if (error) {
        console.error('Error storing checkout session:', error);
        throw new Error('Failed to store checkout session');
      }

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
        amount: amount,
        currency: currency.toUpperCase(),
        status: 'pending'
      };

    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Convert amount to smallest currency unit for Stripe
   * JPY is already in smallest unit (yen), so no conversion needed
   * Most other currencies need to be multiplied by 100
   */
  convertToSmallestUnit(amount, currency) {
    const currencyCode = currency.toLowerCase();
    
    // Currencies that don't need conversion (already in smallest unit)
    const noConversionCurrencies = ['jpy', 'krw', 'vnd', 'clp'];
    
    if (noConversionCurrencies.includes(currencyCode)) {
      return Math.round(amount);
    }
    
    // Default: multiply by 100 for cents-based currencies
    return Math.round(amount * 100);
  }

  /**
   * Convert amount from smallest currency unit back to major currency unit
   * JPY is already in smallest unit (yen), so no conversion needed
   * Most other currencies need to be divided by 100
   */
  convertFromSmallestUnit(amount, currency) {
    const currencyCode = currency.toLowerCase();
    
    // Currencies that don't need conversion (already in smallest unit)
    const noConversionCurrencies = ['jpy', 'krw', 'vnd', 'clp', 'pyg', 'rwf', 'ugx', 'vuf', 'xaf', 'xof', 'xpf'];
    
    if (noConversionCurrencies.includes(currencyCode)) {
      return Math.round(amount);
    }
    
    // Default: divide by 100 for cents-based currencies
    return Math.round(amount) / 100;
  }

  /**
   * Get service display name
   */
  getServiceName(serviceType) {
    const names = {
      accommodation_tax: 'Accommodation Tax / 宿泊税',
      cleaning_fee: 'Cleaning Fee',
      amenity_fee: 'Amenity Fee'
    };
    return names[serviceType] || 'Guest Service';
  }

  /**
   * Create a payment intent for guest services (legacy method, keep for compatibility)
   */
  async createPaymentIntent({
    amount,
    currency = 'jpy',
    reservationId,
    serviceType,
    guestEmail,
    metadata = {}
  }) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: this.convertToSmallestUnit(amount, currency), // Convert to smallest currency unit
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: guestEmail,
        metadata: {
          reservation_id: reservationId,
          service_type: serviceType,
          ...metadata
        },
        description: `${serviceType} payment for reservation ${reservationId}`,
      });

      // Store payment intent in database
      const { data, error } = await supabaseAdmin
        .from('payment_intents')
        .insert({
          reservation_id: reservationId,
          service_type: serviceType,
          stripe_payment_intent_id: paymentIntent.id,
          amount: amount,
          currency: currency.toUpperCase(),
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret,
          metadata: {
            stripe_metadata: paymentIntent.metadata,
            ...metadata
          }
        });

      if (error) {
        console.error('Error storing payment intent:', error);
        throw new Error('Failed to store payment intent');
      }

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amount,
        currency: currency.toUpperCase(),
        status: paymentIntent.status
      };

    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Confirm a payment intent (usually done by frontend, but can be used for testing)
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethod) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod,
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw new Error(`Failed to confirm payment intent: ${error.message}`);
    }
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object);
          break;
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'checkout.session.expired':
          await this.handleCheckoutSessionExpired(event.data.object);
          break;
        case 'charge.dispute.created':
          console.log('Dispute created:', event.data.object.id);
          break;
        case 'refund.created':
        case 'refund.updated':
          await this.handleRefundWebhook(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle successful checkout session completion
   */
  async handleCheckoutSessionCompleted(session) {
    try {
      const { reservation_id, service_type } = session.metadata;
      
      console.log('Processing checkout session completion:', {
        sessionId: session.id,
        paymentIntent: session.payment_intent,
        reservationId: reservation_id,
        serviceType: service_type,
        paymentStatus: session.payment_status
      });

      // Only process if payment is actually completed
      if (session.payment_status !== 'paid') {
        console.log(`Session ${session.id} payment status is ${session.payment_status}, not processing as paid`);
        return;
      }
      
      // Try to find payment intent record by session ID first
      let { data: updatedPayment, error: updateError } = await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: 'succeeded',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', session.id)
        .select();

      // If primary lookup failed, try fallback methods
      if ((!updatedPayment || updatedPayment.length === 0) && !updateError) {
        console.log(`🔍 Primary lookup failed, trying fallback methods for session: ${session.id}`);
        
        // Try to find by reservation_id and service_type with pending status
        const { data: fallbackPayment, error: fallbackError } = await supabaseAdmin
          .from('payment_intents')
          .update({ 
            status: 'succeeded',
            updated_at: new Date().toISOString(),
            stripe_payment_intent_id: session.id // Update to use session ID if it was different
          })
          .eq('reservation_id', reservation_id)
          .eq('service_type', service_type)
          .eq('status', 'pending')
          .select();
          
        if (!fallbackError && fallbackPayment && fallbackPayment.length > 0) {
          console.log(`✅ Found payment intent via fallback method: ${fallbackPayment[0].id}`);
          updatedPayment = fallbackPayment;
          updateError = fallbackError;
        }
      }

      if (updateError) {
        console.error('Error updating payment intent:', updateError);
        throw updateError;
      }
      
      let paymentIntentId = null;
      let paymentAmount = null;
      let paymentCurrency = null;
      
      if (!updatedPayment || updatedPayment.length === 0) {
        console.warn(`❌ No payment intent found for session ID: ${session.id}`);
        console.error('DEBUG: Failed to find payment_intent record for session:', {
          sessionId: session.id,
          reservationId: reservation_id,
          serviceType: service_type,
          amount: session.amount_total ? session.amount_total / 100 : 'unknown',
          currency: session.currency || 'unknown'
        });
        
        // Create missing payment intent record as recovery
        if (reservation_id && service_type && session.amount_total) {
          console.log(`🔄 Creating missing payment_intent record for recovery...`);
          try {
            const { data: newPaymentIntent, error: createError } = await supabaseAdmin
              .from('payment_intents')
              .insert({
                reservation_id: reservation_id,
                service_type: service_type,
                stripe_payment_intent_id: session.id,
                amount: session.amount_total / 100, // Convert from cents
                currency: (session.currency || 'JPY').toUpperCase(),
                status: 'succeeded',
                client_secret: session.url,
                metadata: {
                  stripe_metadata: session.metadata,
                  checkout_url: session.url,
                  checkout_session_id: session.id,
                  recovered_from_webhook: true,
                  recovery_timestamp: new Date().toISOString()
                }
              })
              .select()
              .single();
              
            if (createError) {
              console.error('❌ Failed to create recovery payment_intent record:', createError);
            } else {
              console.log(`✅ Created recovery payment_intent record: ${newPaymentIntent.id}`);
              paymentIntentId = newPaymentIntent.id;
              paymentAmount = newPaymentIntent.amount;
              paymentCurrency = newPaymentIntent.currency;
            }
          } catch (recoveryError) {
            console.error('❌ Recovery payment_intent creation failed:', recoveryError);
          }
        }
      } else {
        console.log(`✅ Updated ${updatedPayment.length} payment intent(s) to succeeded for session: ${session.id}`);
        const paymentIntent = updatedPayment[0];
        paymentIntentId = paymentIntent.id;
        paymentAmount = paymentIntent.amount;
        paymentCurrency = paymentIntent.currency;
      }

      // Always try to record the payment transaction if we have the necessary data
      if (paymentIntentId && paymentAmount && paymentCurrency) {
        try {
          console.log(`🔄 Attempting to record payment transaction:`, {
            paymentIntentId,
            stripeTransactionId: session.payment_intent || session.id,
            amount: paymentAmount,
            currency: paymentCurrency,
            sessionId: session.id
          });
          
          const transactionResult = await this.recordPaymentTransaction(
            paymentIntentId,
            session.payment_intent || session.id, // Use actual payment intent ID if available
            'payment',
            paymentAmount,
            paymentCurrency,
            'succeeded',
            session
          );
          
          console.log(`✅ Payment transaction recorded successfully:`, {
            transactionId: transactionResult.id,
            sessionId: session.id,
            amount: paymentAmount,
            currency: paymentCurrency
          });
        } catch (transactionError) {
          console.error(`❌ CRITICAL: Failed to record payment transaction for session ${session.id}:`, {
            error: transactionError.message,
            stack: transactionError.stack,
            paymentIntentId,
            paymentAmount,
            paymentCurrency,
            sessionData: {
              id: session.id,
              payment_intent: session.payment_intent,
              payment_status: session.payment_status,
              metadata: session.metadata
            }
          });
          
          // Don't let transaction recording failure break the webhook, but make it very visible
          console.error(`❌ ALERT: Payment was successful but transaction record was NOT created!`);
          
          // Optionally, you could throw here if you want webhook to fail when transaction recording fails
          // throw new Error(`Transaction recording failed: ${transactionError.message}`);
        }
      } else {
        console.error(`❌ CRITICAL: Unable to record payment transaction - missing required data:`, {
          paymentIntentId: paymentIntentId || 'MISSING',
          paymentAmount: paymentAmount || 'MISSING',
          paymentCurrency: paymentCurrency || 'MISSING',
          sessionId: session.id,
          sessionMetadata: session.metadata,
          sessionPaymentStatus: session.payment_status,
          fullSessionData: session
        });
        
        // Log this as a critical issue that needs immediate attention
        console.error(`❌ ALERT: Payment transaction could NOT be recorded due to missing data!`);
      }

      // Handle service-specific success logic using new service system
      await this.handleServicePaymentSuccess(reservation_id, service_type, session.id);

      console.log(`✅ Checkout session completed for ${service_type}: ${session.id}`);
    } catch (error) {
      console.error('Error handling checkout session completion:', error);
      throw error;
    }
  }

  /**
   * Handle expired checkout session
   */
  async handleCheckoutSessionExpired(session) {
    try {
      // Update payment intent status in database - find by session ID  
      await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', session.id);

      console.log(`Checkout session expired: ${session.id}`);
    } catch (error) {
      console.error('Error handling checkout session expiration:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentIntent) {
    try {
      const { reservation_id, service_type } = paymentIntent.metadata;
      
      // Update payment intent status in database
      await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: paymentIntent.status,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      // Handle service-specific success logic using new service system
      await this.handleServicePaymentSuccess(reservation_id, service_type, paymentIntent.id);

      console.log(`Payment successful for ${service_type}: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(paymentIntent) {
    try {
      const { reservation_id, service_type } = paymentIntent.metadata;
      
      // Update payment intent status in database
      await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: paymentIntent.status,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      // Handle service-specific failure logic
      if (service_type === 'accommodation_tax') {
        await this.handleAccommodationTaxFailure(reservation_id);
      }

      console.log(`Payment failed for ${service_type}: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Handle canceled payment
   */
  async handlePaymentCanceled(paymentIntent) {
    try {
      // Update payment intent status in database
      await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: paymentIntent.status,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      console.log(`Payment canceled: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error handling payment cancellation:', error);
      throw error;
    }
  }

  /**
   * Handle successful service payment (new service system)
   */
  async handleServicePaymentSuccess(reservationId, serviceType, stripePaymentIntentId) {
    try {
      console.log(`Updating service payment status for reservation: ${reservationId}, Service: ${serviceType}, Stripe ID: ${stripePaymentIntentId}`);
      
      // Get accommodation tax service ID
      const { data: taxService, error: serviceError } = await supabaseAdmin
        .from('guest_services')
        .select('id')
        .eq('service_key', serviceType)
        .single();

      if (serviceError || !taxService) {
        console.error(`Service ${serviceType} not found`);
        return;
      }

      // Update the reservation addon status to paid
      const { data, error } = await supabaseAdmin
        .from('reservation_addons')
        .update({
          purchase_status: 'paid',
          stripe_payment_intent_id: stripePaymentIntentId,
          purchased_at: new Date().toISOString(),
          amount_paid: null // Will be calculated from Stripe session
        })
        .eq('reservation_id', reservationId)
        .eq('service_id', taxService.id)
        .select();

      if (error) {
        console.error('Error updating service payment status:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn(`No service addon found for reservation: ${reservationId}, service: ${serviceType}`);
      } else {
        console.log(`✅ Successfully marked ${serviceType} as paid for reservation: ${reservationId}`);
      }
    } catch (error) {
      console.error('Error handling service payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed accommodation tax payment
   */
  async handleAccommodationTaxFailure(reservationId) {
    try {
      const { error } = await supabaseAdmin
        .from('accommodation_tax_invoices')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('reservation_id', reservationId);

      if (error) {
        console.error('Error updating accommodation tax failure status:', error);
        throw error;
      }

      console.log(`Accommodation tax marked as failed for reservation: ${reservationId}`);
    } catch (error) {
      console.error('Error handling accommodation tax failure:', error);
      throw error;
    }
  }

  /**
   * Construct webhook event with signature verification
   */
  constructEvent(payload, signature, endpointSecret) {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Webhook signature verification failed');
    }
  }

  /**
   * Check if we've already processed this Stripe event (idempotency guard)
   */
  async hasProcessedEvent(eventId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('stripe_events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking processed event:', error);
      return false; // Fail open - better to process twice than miss an event
    }
  }

  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId) {
    try {
      const { error } = await supabaseAdmin
        .from('stripe_events')
        .insert({ 
          id: eventId, 
          processed_at: new Date().toISOString() 
        });
      
      if (error) {
        // If it's a duplicate key error, that's fine - event already processed
        if (error.code === '23505') {
          console.log('Event already marked as processed:', eventId);
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error marking event as processed:', error);
      throw error;
    }
  }

  /**
   * Refund a payment (full or partial)
   */
  async refundPayment(stripeId, amount = null, reason = 'requested_by_customer', metadata = {}) {
    try {
      console.log('Processing refund:', { stripeId, amount, reason });
      
      let actualPaymentIntentId = stripeId;
      let paymentIntent = null;
      
      // Check if this is a checkout session ID (starts with cs_) vs payment intent ID (starts with pi_)
      if (stripeId.startsWith('cs_')) {
        console.log('🔍 Detected checkout session ID, retrieving session to get payment intent...');
        
        // Get the checkout session first
        const session = await this.stripe.checkout.sessions.retrieve(stripeId);
        
        if (!session) {
          throw new Error('Checkout session not found');
        }
        
        if (!session.payment_intent) {
          throw new Error('No payment intent found in checkout session');
        }
        
        // Get the actual payment intent ID from the session
        actualPaymentIntentId = session.payment_intent;
        console.log('✅ Found payment intent from session:', actualPaymentIntentId);
      }
      
      // Now get the payment intent using the correct ID
      paymentIntent = await this.stripe.paymentIntents.retrieve(actualPaymentIntentId);
      
      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }
      
      console.log('✅ Payment intent retrieved:', {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Cannot refund payment with status: ${paymentIntent.status}`);
      }

      // Check for existing refunds before attempting new refund
      console.log('🔍 Checking for existing refunds...');
      const existingRefunds = await this.getRefundHistory(actualPaymentIntentId);
      
      const totalAlreadyRefunded = existingRefunds.totalRefunded;
      const originalAmount = this.convertFromSmallestUnit(paymentIntent.amount, paymentIntent.currency);
      const requestedRefundAmount = amount !== null ? amount : originalAmount;
      
      console.log('📊 Refund status check:', {
        originalAmount,
        totalAlreadyRefunded,
        requestedRefundAmount,
        availableToRefund: originalAmount - totalAlreadyRefunded
      });
      
      // Check if charge is already fully refunded
      if (totalAlreadyRefunded >= originalAmount) {
        console.log('❌ Charge already fully refunded');
        
        // Update our database to reflect the actual Stripe status
        await this.syncPaymentStatusFromStripe(stripeId, actualPaymentIntentId);
        
        throw new Error(`Charge has already been fully refunded. Total refunded: ${totalAlreadyRefunded} ${paymentIntent.currency.toUpperCase()}`);
      }
      
      // Check if requested refund amount would exceed available amount
      if (totalAlreadyRefunded + requestedRefundAmount > originalAmount) {
        const availableAmount = originalAmount - totalAlreadyRefunded;
        throw new Error(`Requested refund amount (${requestedRefundAmount}) would exceed available refund amount (${availableAmount}). Total already refunded: ${totalAlreadyRefunded}`);
      }
      
      // If there are existing refunds but we can still process this one
      if (totalAlreadyRefunded > 0) {
        console.log(`⚠️  Partial refunds exist. Processing additional refund of ${requestedRefundAmount} (${originalAmount - totalAlreadyRefunded - requestedRefundAmount} will remain)`);
      }
      
      // Prepare refund data
      const refundData = {
        payment_intent: actualPaymentIntentId, // Use the actual payment intent ID
        reason: reason,
        metadata: {
          refund_reason: reason,
          refunded_by: 'admin',
          refund_timestamp: new Date().toISOString(),
          original_stripe_id: stripeId, // Keep track of original ID (session or payment intent)
          previous_refunds_total: totalAlreadyRefunded,
          ...metadata
        }
      };
      
      // Add amount if specified (partial refund)
      if (amount !== null) {
        refundData.amount = this.convertToSmallestUnit(amount, paymentIntent.currency);
      }
      
      console.log('🔍 Creating refund with data:', refundData);
      
      // Create the refund
      const refund = await this.stripe.refunds.create(refundData);
      
      console.log('✅ Stripe refund created:', {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status
      });
      
      // Update payment intent status in database using the original stored ID (which might be session ID)
      const originalAmountConverted = this.convertFromSmallestUnit(paymentIntent.amount, paymentIntent.currency);
      const refundAmountConverted = this.convertFromSmallestUnit(refund.amount, refund.currency);
      
      const { data: updatedRecord, error: updateError } = await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: amount !== null && amount < originalAmountConverted ? 'partially_refunded' : 'refunded',
          updated_at: new Date().toISOString(),
          metadata: {
            ...paymentIntent.metadata,
            refund_id: refund.id,
            refund_amount: refundAmountConverted,
            refund_reason: reason,
            refunded_at: new Date().toISOString(),
            actual_payment_intent_id: actualPaymentIntentId // Store the actual payment intent ID for reference
          }
        })
        .eq('stripe_payment_intent_id', stripeId) // Use original stored ID for lookup
        .select();
      
      if (updateError) {
        console.error('Error updating payment intent record:', updateError);
        // Don't throw here since Stripe refund succeeded
      } else {
        console.log('✅ Updated payment_intents record:', updatedRecord);
      }
      
      console.log(`✅ Refund processed successfully: ${refund.id}`);
      
      return {
        refundId: refund.id,
        amount: this.convertFromSmallestUnit(refund.amount, refund.currency), // Use currency-aware conversion
        currency: refund.currency.toUpperCase(),
        status: refund.status,
        reason: refund.reason,
        created: refund.created,
        actualPaymentIntentId: actualPaymentIntentId // Include for debugging
      };
      
    } catch (error) {
      console.error('Error processing refund:', error);
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Void/Cancel a payment intent (only works for uncaptured payments)
   */
  async voidPayment(paymentIntentId, reason = 'requested_by_customer') {
    try {
      console.log('Processing void:', { paymentIntentId, reason });
      
      // Get the payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }
      
      // Check if payment can be canceled
      if (!['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
        throw new Error(`Cannot void payment with status: ${paymentIntent.status}. Use refund instead.`);
      }
      
      // Cancel the payment intent
      const canceledPayment = await this.stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: reason
      });
      
      // Update payment intent status in database
      await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: 'canceled',
          updated_at: new Date().toISOString(),
          metadata: {
            ...paymentIntent.metadata,
            void_reason: reason,
            voided_at: new Date().toISOString(),
            voided_by: 'admin'
          }
        })
        .eq('stripe_payment_intent_id', paymentIntentId);
      
      console.log(`✅ Payment voided successfully: ${paymentIntentId}`);
      
      return {
        paymentIntentId: canceledPayment.id,
        status: canceledPayment.status,
        cancellation_reason: canceledPayment.cancellation_reason,
        amount: canceledPayment.amount / 100 // Convert back to major currency unit
      };
      
    } catch (error) {
      console.error('Error voiding payment:', error);
      throw new Error(`Failed to void payment: ${error.message}`);
    }
  }

  /**
   * Get refund history for a payment intent
   */
  async getRefundHistory(paymentIntentId) {
    try {
      console.log('Getting refund history for:', paymentIntentId);
      
      // Get all refunds for this payment intent
      const refunds = await this.stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 100
      });
      
      // Format refund data - use proper currency conversion
      const refundHistory = refunds.data.map(refund => ({
        refundId: refund.id,
        amount: this.convertFromSmallestUnit(refund.amount, refund.currency), // Use currency-aware conversion
        currency: refund.currency.toUpperCase(),
        status: refund.status,
        reason: refund.reason,
        created: refund.created,
        createdDate: new Date(refund.created * 1000).toISOString(),
        metadata: refund.metadata
      }));
      
      // Calculate total refunded amount
      const totalRefunded = refundHistory.reduce((total, refund) => {
        return refund.status === 'succeeded' ? total + refund.amount : total;
      }, 0);
      
      console.log('📊 Refund history summary:', {
        totalRefunds: refundHistory.length,
        totalRefunded: totalRefunded,
        currency: refunds.data[0]?.currency?.toUpperCase() || 'unknown',
        refundDetails: refundHistory.map(r => ({ id: r.refundId, amount: r.amount, status: r.status }))
      });
      
      return {
        refunds: refundHistory,
        totalRefunded: totalRefunded,
        count: refundHistory.length
      };
      
    } catch (error) {
      console.error('Error getting refund history:', error);
      throw new Error(`Failed to get refund history: ${error.message}`);
    }
  }

  /**
   * Record a payment transaction in the database with enhanced validation and error handling
   */
  async recordPaymentTransaction(paymentIntentId, stripeTransactionId, transactionType, amount, currency, status, stripeData = null) {
    try {
      // Validate required parameters
      if (!paymentIntentId) {
        throw new Error('paymentIntentId is required');
      }
      if (!stripeTransactionId) {
        throw new Error('stripeTransactionId is required');
      }
      if (!transactionType) {
        throw new Error('transactionType is required');
      }
      if (!amount || amount <= 0) {
        throw new Error(`Invalid amount: ${amount}. Must be greater than 0`);
      }
      if (!currency) {
        throw new Error('currency is required');
      }
      if (!status) {
        throw new Error('status is required');
      }

      console.log(`🔄 Recording payment transaction with validated data:`, {
        paymentIntentId,
        stripeTransactionId,
        transactionType,
        amount,
        currency: currency.toUpperCase(),
        status
      });

      // Check if transaction already exists to prevent duplicates
      const { data: existingTransaction, error: checkError } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, stripe_transaction_id')
        .eq('stripe_transaction_id', stripeTransactionId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error checking for existing transaction:', checkError);
        throw new Error(`Failed to check for duplicate transaction: ${checkError.message}`);
      }

      if (existingTransaction) {
        console.log(`⚠️  Transaction already exists with ID: ${existingTransaction.id}, skipping duplicate`);
        return existingTransaction;
      }

      // Prepare transaction data with proper type conversion
      const transactionData = {
        payment_intent_id: paymentIntentId,
        stripe_transaction_id: stripeTransactionId,
        transaction_type: transactionType,
        amount: parseFloat(amount), // Ensure numeric type
        currency: currency.toUpperCase(),
        status: status,
        stripe_data: stripeData,
        processed_at: new Date().toISOString()
      };

      console.log(`💾 Inserting payment transaction:`, transactionData);

      const { data, error } = await supabaseAdmin
        .from('payment_transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        console.error(`❌ Database error recording payment transaction:`, {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          transactionData
        });

        // Provide more specific error messages
        if (error.code === '23503') { // Foreign key violation
          throw new Error(`Payment intent ID ${paymentIntentId} not found in payment_intents table`);
        } else if (error.code === '23505') { // Unique violation
          throw new Error(`Duplicate transaction ID: ${stripeTransactionId}`);
        } else if (error.code === '23514') { // Check constraint violation
          throw new Error(`Invalid data for transaction: ${error.details}`);
        } else {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      if (!data) {
        throw new Error('Transaction was created but no data was returned');
      }

      console.log(`✅ Successfully recorded ${transactionType} transaction:`, {
        transactionId: data.id,
        stripeTransactionId: data.stripe_transaction_id,
        amount: data.amount,
        currency: data.currency,
        status: data.status
      });

      return data;
    } catch (error) {
      console.error(`❌ Failed to record payment transaction:`, {
        error: error.message,
        stack: error.stack,
        paymentIntentId,
        stripeTransactionId,
        transactionType,
        amount,
        currency,
        status
      });
      throw error;
    }
  }

  /**
   * Sync payment status from Stripe to local database
   */
  async syncPaymentStatusFromStripe(originalStripeId, actualPaymentIntentId) {
    try {
      console.log('🔄 Syncing payment status from Stripe:', { originalStripeId, actualPaymentIntentId });
      
      // Get current refund status from Stripe
      const refundHistory = await this.getRefundHistory(actualPaymentIntentId);
      const paymentIntent = await this.stripe.paymentIntents.retrieve(actualPaymentIntentId);
      
      const originalAmount = paymentIntent.amount / 100;
      const totalRefunded = refundHistory.totalRefunded;
      
      let newStatus = 'succeeded';
      if (totalRefunded >= originalAmount) {
        newStatus = 'refunded';
      } else if (totalRefunded > 0) {
        newStatus = 'partially_refunded';
      }
      
      console.log('📊 Stripe status sync:', {
        originalAmount,
        totalRefunded,
        newStatus,
        refundCount: refundHistory.count
      });
      
      // Update payment intent status in database
      const { data: updatedRecord, error: updateError } = await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          metadata: {
            last_stripe_sync: new Date().toISOString(),
            stripe_refund_total: totalRefunded,
            stripe_refund_count: refundHistory.count,
            actual_payment_intent_id: actualPaymentIntentId
          }
        })
        .eq('stripe_payment_intent_id', originalStripeId)
        .select();
      
      if (updateError) {
        console.error('Error syncing payment status:', updateError);
        throw updateError;
      }
      
      // Also update reservation addon status if applicable
      if (updatedRecord && updatedRecord.length > 0) {
        const paymentRecord = updatedRecord[0];
        
        // Get service ID for this payment
        const { data: service } = await supabaseAdmin
          .from('guest_services')
          .select('id')
          .eq('service_key', paymentRecord.service_type)
          .single();
        
        if (service) {
          const addonStatus = newStatus === 'refunded' ? 'refunded' : 
                             newStatus === 'partially_refunded' ? 'partially_refunded' : 'paid';
          
          await supabaseAdmin
            .from('reservation_addons')
            .update({
              purchase_status: addonStatus,
              refund_amount: totalRefunded,
              refunded_at: totalRefunded > 0 ? new Date().toISOString() : null,
              metadata: {
                last_stripe_sync: new Date().toISOString(),
                stripe_sync_reason: 'duplicate_refund_prevention'
              }
            })
            .eq('reservation_id', paymentRecord.reservation_id)
            .eq('service_id', service.id);
        }
      }
      
      console.log('✅ Payment status synced successfully:', {
        originalStripeId,
        newStatus,
        totalRefunded
      });
      
      return {
        originalStatus: paymentIntent.status,
        newStatus: newStatus,
        totalRefunded: totalRefunded,
        refundHistory: refundHistory
      };
      
    } catch (error) {
      console.error('Error syncing payment status from Stripe:', error);
      throw error;
    }
  }

  /**
   * Handle refund webhook events (enhanced for external refunds)
   */
  async handleRefundWebhook(refund) {
    try {
      console.log('Processing refund webhook:', {
        refundId: refund.id,
        paymentIntent: refund.payment_intent,
        status: refund.status,
        amount: refund.amount,
        reason: refund.reason
      });
      
      // Try to find payment intent record by actual payment intent ID first
      let { data: paymentIntentRecord } = await supabaseAdmin
        .from('payment_intents')
        .select('id, reservation_id, service_type, metadata, amount, stripe_payment_intent_id')
        .eq('stripe_payment_intent_id', refund.payment_intent)
        .single();
      
      // If not found, try to find by checking metadata for actual payment intent ID
      // This handles cases where we store session IDs but the refund references the actual payment intent
      if (!paymentIntentRecord) {
        console.log('🔍 Payment intent not found by direct match, checking metadata...');
        
        const { data: allPaymentIntents } = await supabaseAdmin
          .from('payment_intents')
          .select('id, reservation_id, service_type, metadata, amount, stripe_payment_intent_id')
          .not('metadata', 'is', null);
        
        for (const record of allPaymentIntents || []) {
          if (record.metadata && record.metadata.actual_payment_intent_id === refund.payment_intent) {
            paymentIntentRecord = record;
            console.log(`✅ Found payment intent via metadata: ${record.id}`);
            break;
          }
        }
      }
      
      if (paymentIntentRecord) {
        console.log('✅ Found matching payment intent record:', {
          id: paymentIntentRecord.id,
          reservationId: paymentIntentRecord.reservation_id,
          serviceType: paymentIntentRecord.service_type
        });
        
        // Record refund transaction with proper currency conversion
        const refundAmount = this.convertFromSmallestUnit(refund.amount, refund.currency);
        const transactionType = refundAmount < paymentIntentRecord.amount ? 'partial_refund' : 'refund';
        
        console.log(`🔄 Recording payment transaction with validated data:`, {
          paymentIntentId: paymentIntentRecord.id,
          stripeTransactionId: refund.id,
          transactionType,
          amount: refundAmount,
          currency: refund.currency.toUpperCase(),
          status: refund.status
        });
        
        try {
          await this.recordPaymentTransaction(
            paymentIntentRecord.id,
            refund.id,
            transactionType,
            refundAmount,
            refund.currency.toUpperCase(),
            refund.status,
            refund
          );
          console.log('✅ Refund transaction recorded successfully');
        } catch (transactionError) {
          console.error('❌ Error recording refund transaction:', transactionError);
          // Continue processing even if transaction recording fails
        }

        // Update payment intent status
        const totalRefunded = await this.calculateTotalRefunded(refund.payment_intent);
        const newStatus = totalRefunded >= paymentIntentRecord.amount ? 'refunded' : 'partially_refunded';
        
        await supabaseAdmin
          .from('payment_intents')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
            metadata: {
              ...paymentIntentRecord.metadata,
              last_refund_id: refund.id,
              last_refund_amount: refundAmount,
              last_refund_at: new Date().toISOString(),
              external_refund_webhook: true
            }
          })
          .eq('id', paymentIntentRecord.id);

        // Update the reservation addon to reflect refund
        const { data: service } = await supabaseAdmin
          .from('guest_services')
          .select('id')
          .eq('service_key', paymentIntentRecord.service_type)
          .single();
        
        if (service) {
          // For service refunds (like accommodation tax), keep the addon as 'paid' since service was delivered
          // Only change to 'refunded' for full cancellations where the entire service is cancelled
          const isFullRefund = totalRefunded >= paymentIntentRecord.amount;
          
          // Keep service addon as 'paid' for partial refunds since the service was delivered
          // Only mark as 'refunded' if the entire payment was refunded (full cancellation)
          const addonStatus = refund.status === 'succeeded' && isFullRefund ? 'refunded' : 'paid';
          
          await supabaseAdmin
            .from('reservation_addons')
            .update({
              purchase_status: addonStatus,
              refund_amount: totalRefunded,
              refunded_at: refund.status === 'succeeded' ? new Date().toISOString() : null,
              metadata: {
                ...paymentIntentRecord.metadata,
                refund_id: refund.id,
                refund_status: refund.status,
                refund_reason: refund.reason,
                refund_type: isFullRefund ? 'full_refund' : 'partial_refund',
                service_delivered: true, // Mark that service was delivered
                external_refund: true,
                webhook_processed_at: new Date().toISOString()
              }
            })
            .eq('reservation_id', paymentIntentRecord.reservation_id)
            .eq('service_id', service.id);
          
          console.log(`✅ Updated reservation addon for reservation ${paymentIntentRecord.reservation_id}: status=${addonStatus}, refund_amount=${totalRefunded}`);
        }
      } else {
        console.warn(`❌ No matching payment intent record found for refund: ${refund.id}, payment intent: ${refund.payment_intent}`);
        
        // Log this as a critical issue for manual review
        console.error(`🚨 ALERT: External refund processed in Stripe but no matching payment record found!`, {
          refundId: refund.id,
          paymentIntentId: refund.payment_intent,
          amount: refund.amount / 100,
          currency: refund.currency,
          reason: refund.reason,
          status: refund.status
        });
      }
      
      console.log(`✅ Refund webhook processed: ${refund.id}`);
      
    } catch (error) {
      console.error('Error handling refund webhook:', error);
      throw error;
    }
  }

  /**
   * Calculate total refunded amount for a payment intent from Stripe
   */
  async calculateTotalRefunded(paymentIntentId) {
    try {
      console.log(`🔍 Calculating total refunded for payment intent: ${paymentIntentId}`);
      
      const refunds = await this.stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 100
      });
      
      // Use proper currency-aware conversion
      const totalRefunded = refunds.data.reduce((total, refund) => {
        if (refund.status === 'succeeded') {
          const convertedAmount = this.convertFromSmallestUnit(refund.amount, refund.currency);
          console.log(`Adding refund ${refund.id}: ${convertedAmount} ${refund.currency.toUpperCase()}`);
          return total + convertedAmount;
        }
        return total;
      }, 0);
      
      console.log(`📊 Total refunded for ${paymentIntentId}: ${totalRefunded}`);
      return totalRefunded;
      
    } catch (error) {
      console.error('Error calculating total refunded:', error);
      
      // Handle specific Stripe errors gracefully
      if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
        console.warn(`⚠️  Payment intent ${paymentIntentId} not found in Stripe, returning 0 for total refunded`);
        return 0;
      }
      
      // For other errors, log them but don't break the webhook
      console.error(`❌ Unexpected error calculating refunds for ${paymentIntentId}:`, {
        type: error.type,
        code: error.code,
        message: error.message
      });
      return 0;
    }
  }

  /**
   * Verify webhook signature (for security) - legacy method
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
      }

      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Webhook signature verification failed');
    }
  }
}

module.exports = new StripeService();

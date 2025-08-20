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
                description: `${serviceType} for ${guestName}`,
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
      
      // Update payment intent status in database - find by session ID (since we store session ID in stripe_payment_intent_id for checkout sessions)
      const { data: updatedPayment, error: updateError } = await supabaseAdmin
        .from('payment_intents')
        .update({ 
          status: 'succeeded',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', session.id)
        .select();

      if (updateError) {
        console.error('Error updating payment intent:', updateError);
        throw updateError;
      }
      
      if (!updatedPayment || updatedPayment.length === 0) {
        console.warn(`No payment intent found for session ID: ${session.id}`);
        // This is a critical issue - log more details for debugging
        console.error('DEBUG: Failed to find payment_intent record for session:', {
          sessionId: session.id,
          reservationId: reservation_id,
          serviceType: service_type
        });
      } else {
        console.log(`✅ Updated ${updatedPayment.length} payment intent(s) to succeeded for session: ${session.id}`);
      }

      // Handle service-specific success logic
      if (service_type === 'accommodation_tax') {
        // For checkout sessions, we pass the session ID as the stripe reference
        // since that's what we stored in our payment_intents table
        await this.handleAccommodationTaxSuccess(reservation_id, session.id);
      }

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

      // Handle service-specific success logic
      if (service_type === 'accommodation_tax') {
        await this.handleAccommodationTaxSuccess(reservation_id, paymentIntent.id);
      }

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
   * Handle successful accommodation tax payment
   */
  async handleAccommodationTaxSuccess(reservationId, stripePaymentIntentId) {
    try {
      console.log(`Updating accommodation tax status for reservation: ${reservationId}, Stripe ID: ${stripePaymentIntentId}`);
      
      const { data, error } = await supabaseAdmin
        .from('accommodation_tax_invoices')
        .update({
          status: 'paid',
          stripe_payment_intent_id: stripePaymentIntentId,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('reservation_id', reservationId)
        .select();

      if (error) {
        console.error('Error updating accommodation tax status:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn(`No accommodation tax invoice found for reservation: ${reservationId}`);
        // Try to find by any existing stripe payment intent ID as fallback
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('accommodation_tax_invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', stripePaymentIntentId)
          .select();
        
        if (fallbackError) {
          console.error('Fallback update also failed:', fallbackError);
        } else if (fallbackData && fallbackData.length > 0) {
          console.log(`✅ Successfully updated accommodation tax via fallback lookup for: ${stripePaymentIntentId}`);
        } else {
          console.warn(`No accommodation tax invoice found for either reservation ${reservationId} or Stripe ID ${stripePaymentIntentId}`);
        }
      } else {
        console.log(`✅ Successfully marked accommodation tax as paid for reservation: ${reservationId}`);
      }
    } catch (error) {
      console.error('Error handling accommodation tax success:', error);
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

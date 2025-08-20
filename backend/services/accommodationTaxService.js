const { supabaseAdmin } = require('../config/supabase');
const stripeService = require('./stripeService');
const reservationService = require('./reservationService');

class AccommodationTaxService {
  /**
   * Calculate accommodation tax based on room rate per person per night
   * Rules:
   * - < 5,000 yen: No tax (0 yen)
   * - 5,000 to < 15,000 yen: 200 yen per person per night
   * - 15,000 to < 20,000 yen: 400 yen per person per night
   * - 20,000+ yen: 500 yen per person per night
   */
  calculateTaxRate(roomRatePerPersonPerNight) {
    if (roomRatePerPersonPerNight < 5000) {
      return { rate: 0, bracket: 'exempt' };
    } else if (roomRatePerPersonPerNight < 15000) {
      return { rate: 200, bracket: 'standard' };
    } else if (roomRatePerPersonPerNight < 20000) {
      return { rate: 400, bracket: 'premium' };
    } else {
      return { rate: 500, bracket: 'luxury' };
    }
  }

  /**
   * Calculate total accommodation tax for a reservation
   */
  calculateAccommodationTax(totalAmount, nights, numGuests) {
    // Calculate room rate per person per night
    const roomRatePerPersonPerNight = totalAmount / nights / numGuests;
    
    // Get tax rate based on room rate
    const { rate, bracket } = this.calculateTaxRate(roomRatePerPersonPerNight);
    
    // Calculate total tax amount
    const totalTaxAmount = rate * nights * numGuests;
    
    return {
      roomRatePerPersonPerNight: Math.round(roomRatePerPersonPerNight),
      taxRatePerPersonPerNight: rate,
      totalTaxAmount: totalTaxAmount,
      taxBracket: bracket,
      breakdown: {
        nights,
        numGuests,
        ratePerPersonPerNight: rate,
        calculation: rate > 0 ? `¥${rate} × ${nights} nights × ${numGuests} guests = ¥${totalTaxAmount}` : 'Tax exempt'
      }
    };
  }

  /**
   * Create or update accommodation tax invoice for a reservation
   * CRITICAL: This method MUST preserve 'paid' status at all costs
   */
  async createOrUpdateTaxInvoice(reservationId, guestToken) {
    try {
      // Get reservation details
      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error('Reservation not found');
      }

      // Calculate check-in/out dates and nights
      const checkInDate = new Date(reservation.check_in_date);
      const checkOutDate = new Date(reservation.check_out_date);
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      // Use reservation data for calculation
      const totalAmount = parseFloat(reservation.total_amount) || parseFloat(reservation.price) || 0;
      const numGuests = reservation.num_guests || 1;

      if (totalAmount <= 0) {
        throw new Error('Invalid reservation amount for tax calculation');
      }

      // Calculate tax
      const taxCalculation = this.calculateAccommodationTax(totalAmount, nights, numGuests);

      // Check if invoice already exists
      const { data: existingInvoice } = await supabaseAdmin
        .from('accommodation_tax_invoices')
        .select('*')
        .eq('reservation_id', reservationId)
        .single();

      let invoice;

      if (existingInvoice) {
        // CRITICAL: NEVER CHANGE PAID STATUS
        if (existingInvoice.status === 'paid') {
          console.log(`PRESERVING PAID STATUS: Reservation ${reservationId} tax is already paid, not updating invoice`);
          return {
            invoice: existingInvoice,
            calculation: taxCalculation
          };
        }

        // Log status preservation logic
        const originalStatus = existingInvoice.status;
        const preservedStatuses = ['paid', 'failed'];
        const shouldPreserveStatus = preservedStatuses.includes(existingInvoice.status);
        const newStatus = shouldPreserveStatus 
          ? existingInvoice.status 
          : (taxCalculation.totalTaxAmount === 0 ? 'exempted' : 'pending');

        console.log(`Updating tax invoice for reservation ${reservationId}: ${originalStatus} -> ${newStatus}${shouldPreserveStatus ? ' (preserved)' : ''}`);

        const { data: updatedInvoice, error: updateError } = await supabaseAdmin
          .from('accommodation_tax_invoices')
          .update({
            guest_token: guestToken,
            nights: nights,
            num_guests: numGuests,
            total_amount: totalAmount,
            room_rate_per_person_per_night: taxCalculation.roomRatePerPersonPerNight,
            tax_rate: taxCalculation.taxRatePerPersonPerNight,
            tax_amount: taxCalculation.totalTaxAmount,
            status: newStatus, // Preserve existing paid/failed status
            updated_at: new Date().toISOString()
          })
          .eq('reservation_id', reservationId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }
        invoice = updatedInvoice;
      } else {
        // Create new invoice
        const newStatus = taxCalculation.totalTaxAmount === 0 ? 'exempted' : 'pending';
        console.log(`Creating new tax invoice for reservation ${reservationId} with status: ${newStatus}`);

        const { data: newInvoice, error: insertError } = await supabaseAdmin
          .from('accommodation_tax_invoices')
          .insert({
            reservation_id: reservationId,
            guest_token: guestToken,
            nights: nights,
            num_guests: numGuests,
            total_amount: totalAmount,
            room_rate_per_person_per_night: taxCalculation.roomRatePerPersonPerNight,
            tax_rate: taxCalculation.taxRatePerPersonPerNight,
            tax_amount: taxCalculation.totalTaxAmount,
            currency: 'JPY',
            status: newStatus
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
        invoice = newInvoice;
      }

      return {
        invoice,
        calculation: taxCalculation
      };

    } catch (error) {
      console.error('Error creating/updating tax invoice:', error);
      throw new Error(`Failed to process accommodation tax: ${error.message}`);
    }
  }

  /**
   * Get accommodation tax invoice by guest token (read-only, no modifications)
   */
  async getTaxInvoiceByToken(guestToken) {
    try {
      const { data: invoice, error } = await supabaseAdmin
        .from('accommodation_tax_details')
        .select('*')
        .eq('guest_token', guestToken)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No invoice found
        }
        throw error;
      }

      return invoice;
    } catch (error) {
      console.error('Error getting tax invoice by token:', error);
      throw new Error(`Failed to get tax invoice: ${error.message}`);
    }
  }

  /**
   * Get existing accommodation tax invoice by reservation ID (read-only)
   */
  async getExistingTaxInvoice(reservationId) {
    try {
      const { data: invoice, error } = await supabaseAdmin
        .from('accommodation_tax_invoices')
        .select('*')
        .eq('reservation_id', reservationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No invoice found
        }
        throw error;
      }

      return invoice;
    } catch (error) {
      console.error('Error getting existing tax invoice:', error);
      throw new Error(`Failed to get existing tax invoice: ${error.message}`);
    }
  }

  /**
   * Get accommodation tax service descriptor for frontend
   */
  async getServiceDescriptor(guestToken) {
    try {
      // Get reservation using the service method for consistency
      const reservation = await reservationService.getReservationByToken(guestToken);

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // First check if invoice already exists
      let invoice = await this.getExistingTaxInvoice(reservation.id);
      let calculation;

      // If invoice exists and status is 'paid', return paid descriptor immediately
      // NEVER recalculate or update a paid invoice
      if (invoice && invoice.status === 'paid') {
        console.log(`Tax already paid for reservation ${reservation.id}, preserving paid status`);
        
        // Build service descriptor for paid status
        const descriptor = {
          service: 'accommodation_tax',
          referenceId: reservation.id,
          title: '宿泊税 / Accommodation Tax',
          description: 'City accommodation tax as required by local regulations',
          currency: 'JPY',
          amount: invoice.tax_amount,
          status: 'paid', // Explicitly set to paid
          breakdown: []
        };

        descriptor.breakdown.push({
          label: `¥${invoice.tax_rate.toLocaleString()} × ${invoice.nights} night${invoice.nights > 1 ? 's' : ''} × ${invoice.num_guests} guest${invoice.num_guests > 1 ? 's' : ''}`,
          amount: invoice.tax_amount
        });
        descriptor.rateInfo = `Room rate: ¥${invoice.room_rate_per_person_per_night.toLocaleString()} per person per night`;
        descriptor.paidAt = invoice.paid_at;
        descriptor.paymentId = invoice.stripe_payment_intent_id;

        return descriptor;
      }

      if (!invoice) {
        // Invoice doesn't exist, create it
        const result = await this.createOrUpdateTaxInvoice(reservation.id, guestToken);
        invoice = result.invoice;
        calculation = result.calculation;
      } else {
        // Invoice exists but not paid, only update if status is pending/failed
        // NEVER update paid or exempted status
        if (['pending', 'failed'].includes(invoice.status)) {
          const result = await this.createOrUpdateTaxInvoice(reservation.id, guestToken);
          invoice = result.invoice;
          calculation = result.calculation;
        } else {
          // For exempted status, just recalculate for display
          const checkInDate = new Date(reservation.check_in_date);
          const checkOutDate = new Date(reservation.check_out_date);
          const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
          const totalAmount = parseFloat(reservation.total_amount) || parseFloat(reservation.price) || 0;
          const numGuests = reservation.num_guests || 1;
          calculation = this.calculateAccommodationTax(totalAmount, nights, numGuests);
        }
      }

      // Build service descriptor
      const descriptor = {
        service: 'accommodation_tax',
        referenceId: reservation.id,
        title: '宿泊税 / Accommodation Tax',
        description: 'City accommodation tax as required by local regulations',
        currency: 'JPY',
        amount: invoice.tax_amount,
        status: invoice.status,
        breakdown: []
      };

      if (invoice.status === 'exempted') {
        descriptor.breakdown.push({
          label: 'Tax exempt (room rate below ¥5,000 per person per night)',
          amount: 0
        });
        descriptor.exemptReason = `Room rate: ¥${invoice.room_rate_per_person_per_night.toLocaleString()} per person per night`;
      } else {
        descriptor.breakdown.push({
          label: `¥${invoice.tax_rate.toLocaleString()} × ${invoice.nights} night${invoice.nights > 1 ? 's' : ''} × ${invoice.num_guests} guest${invoice.num_guests > 1 ? 's' : ''}`,
          amount: invoice.tax_amount
        });
        descriptor.rateInfo = `Room rate: ¥${invoice.room_rate_per_person_per_night.toLocaleString()} per person per night`;
      }

      return descriptor;

    } catch (error) {
      console.error('Error getting service descriptor:', error);
      throw new Error(`Failed to get service descriptor: ${error.message}`);
    }
  }

  /**
   * Create Stripe hosted checkout session for accommodation tax
   */
  async createCheckoutSession(guestToken, req) {
    try {
      // Get reservation using the service method
      const reservation = await reservationService.getReservationByToken(guestToken);
      
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get or create tax invoice for this reservation
      const { invoice } = await this.createOrUpdateTaxInvoice(reservation.id, guestToken);
      
      if (!invoice) {
        throw new Error('Tax invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new Error('Tax already paid');
      }

      if (invoice.status === 'exempted') {
        throw new Error('Tax payment not required (exempted)');
      }

      if (invoice.tax_amount <= 0) {
        throw new Error('Invalid tax amount');
      }

      // Build URLs for success and cancel
      const baseUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/guest/${guestToken}?payment_success=true`;
      const cancelUrl = `${baseUrl}/guest/${guestToken}?payment_canceled=true`;

      // Build guest name from primary guest fields
      const guestName = [reservation.guest_firstname, reservation.guest_lastname]
        .filter(Boolean)
        .join(' ') || reservation.booking_name; // fallback to booking_name if guest fields are empty

      // Create Stripe checkout session
      const checkoutSession = await stripeService.createCheckoutSession({
        amount: invoice.tax_amount,
        currency: 'JPY',
        reservationId: reservation.id,
        serviceType: 'accommodation_tax',
        guestEmail: reservation.guest_mail || reservation.booking_email, // use guest email, fallback to booking email
        successUrl,
        cancelUrl,
        metadata: {
          guest_token: guestToken,
          guest_name: guestName,
          nights: invoice.nights,
          num_guests: invoice.num_guests,
          tax_rate: invoice.tax_rate
        }
      });

      return checkoutSession;

    } catch (error) {
      console.error('Error creating accommodation tax checkout session:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Create payment intent for accommodation tax (legacy method)
   */
  async createPaymentIntent(guestToken) {
    try {
      // Get reservation using the service method
      const reservation = await reservationService.getReservationByToken(guestToken);
      
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get or create tax invoice for this reservation
      const { invoice } = await this.createOrUpdateTaxInvoice(reservation.id, guestToken);
      
      if (!invoice) {
        throw new Error('Tax invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new Error('Tax already paid');
      }

      if (invoice.status === 'exempted') {
        throw new Error('Tax payment not required (exempted)');
      }

      if (invoice.tax_amount <= 0) {
        throw new Error('Invalid tax amount');
      }

      // Build guest name from primary guest fields
      const guestName = [reservation.guest_firstname, reservation.guest_lastname]
        .filter(Boolean)
        .join(' ') || reservation.booking_name; // fallback to booking_name if guest fields are empty

      // Create Stripe payment intent
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: invoice.tax_amount,
        currency: 'JPY',
        reservationId: reservation.id,
        serviceType: 'accommodation_tax',
        guestEmail: reservation.guest_mail || reservation.booking_email, // use guest email, fallback to booking email
        metadata: {
          guest_token: guestToken,
          guest_name: guestName,
          nights: invoice.nights,
          num_guests: invoice.num_guests,
          tax_rate: invoice.tax_rate
        }
      });

      return paymentIntent;

    } catch (error) {
      console.error('Error creating accommodation tax payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Get payment status for a guest token
   */
  async getPaymentStatus(guestToken) {
    try {
      const invoice = await this.getTaxInvoiceByToken(guestToken);
      
      if (!invoice) {
        return { status: 'not_required', message: 'No tax invoice found' };
      }

      const status = {
        status: invoice.status,
        amount: invoice.tax_amount,
        currency: invoice.currency,
        paidAt: invoice.paid_at,
        stripePaymentIntentId: invoice.stripe_payment_intent_id
      };

      switch (invoice.status) {
        case 'exempted':
          status.message = 'Tax payment not required';
          break;
        case 'pending':
          status.message = 'Payment required';
          break;
        case 'paid':
          status.message = 'Payment completed';
          break;
        case 'failed':
          status.message = 'Payment failed - please retry';
          break;
        default:
          status.message = 'Unknown status';
      }

      return status;

    } catch (error) {
      console.error('Error getting payment status:', error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }
}

module.exports = new AccommodationTaxService();

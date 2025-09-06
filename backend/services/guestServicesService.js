const { supabaseAdmin } = require('../config/supabase');
const stripeService = require('./stripeService');
const reservationService = require('./reservationService');
const accommodationTaxCalculator = require('./accommodationTaxCalculator');

class GuestServicesService {
  /**
   * Get all available guest services
   */
  async getAllServices() {
    try {
      const { data: services, error } = await supabaseAdmin
        .from('guest_services')
        .select('*')
        .eq('is_active', true)
        .order('service_key');

      if (error) throw error;
      return services;
    } catch (error) {
      console.error('Error getting guest services:', error);
      throw new Error(`Failed to get guest services: ${error.message}`);
    }
  }

  /**
   * Get services available/purchased for a specific reservation
   */
  async getReservationServices(reservationId) {
    try {
      const { data: addons, error } = await supabaseAdmin
        .from('reservation_addons')
        .select(`
          *,
          guest_services (
            service_key,
            name,
            description,
            price,
            currency,
            access_time_override_hours,
            departure_time_override_hours
          )
        `)
        .eq('reservation_id', reservationId)
        .order('created_at');

      if (error) throw error;
      return addons || [];
    } catch (error) {
      console.error('Error getting reservation services:', error);
      throw new Error(`Failed to get reservation services: ${error.message}`);
    }
  }

  /**
   * Calculate effective access and departure times for a reservation
   * considering property defaults and any purchased service overrides
   */
  async calculateEffectiveTimes(reservationId) {
    try {
      // Get reservation and property data
      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .select(`
          id,
          check_in_date,
          check_out_date,
          property_id,
          properties (
            access_time,
            departure_time
          )
        `)
        .eq('id', reservationId)
        .single();

      if (reservationError) throw reservationError;

      const property = reservation.properties;
      let effectiveAccessTime = property.access_time;
      let effectiveDepartureTime = property.departure_time;

      // Get purchased services with time overrides
      const { data: paidAddons, error: addonsError } = await supabaseAdmin
        .from('reservation_addons')
        .select(`
          access_time_override,
          departure_time_override,
          guest_services (
            service_key,
            access_time_override_hours,
            departure_time_override_hours
          )
        `)
        .eq('reservation_id', reservationId)
        .eq('purchase_status', 'paid');

      if (addonsError) throw addonsError;

      // Apply overrides from paid services
      if (paidAddons && paidAddons.length > 0) {
        for (const addon of paidAddons) {
          if (addon.access_time_override) {
            effectiveAccessTime = addon.access_time_override;
          }
          if (addon.departure_time_override) {
            effectiveDepartureTime = addon.departure_time_override;
          }
        }
      }

      return {
        accessTime: effectiveAccessTime,
        departureTime: effectiveDepartureTime,
        hasOverrides: paidAddons && paidAddons.length > 0
      };
    } catch (error) {
      console.error('Error calculating effective times:', error);
      throw new Error(`Failed to calculate effective times: ${error.message}`);
    }
  }

  /**
   * Admin: Enable a service for a specific reservation
   * This makes the service available for guest purchase
   */
  async enableServiceForReservation(reservationId, serviceKey, adminUserId) {
    try {
      // Get the service details
      const { data: service, error: serviceError } = await supabaseAdmin
        .from('guest_services')
        .select('*')
        .eq('service_key', serviceKey)
        .eq('is_active', true)
        .single();

      if (serviceError || !service) {
        throw new Error('Service not found or inactive');
      }

      // Get reservation details for time calculations
      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .select(`
          id,
          check_in_date,
          check_out_date,
          property_id,
          properties (
            access_time,
            departure_time
          )
        `)
        .eq('id', reservationId)
        .single();

      if (reservationError) throw reservationError;

      // Calculate override times if service affects timing
      let accessTimeOverride = null;
      let departureTimeOverride = null;

      if (service.access_time_override_hours !== null && reservation.properties.access_time) {
        const baseAccessTime = reservation.properties.access_time;
        const [hours, minutes] = baseAccessTime.split(':');
        const baseDate = new Date();
        baseDate.setHours(parseInt(hours) + service.access_time_override_hours, parseInt(minutes), 0);
        accessTimeOverride = `${String(baseDate.getHours()).padStart(2, '0')}:${String(baseDate.getMinutes()).padStart(2, '0')}:00`;
      }

      if (service.departure_time_override_hours !== null && reservation.properties.departure_time) {
        const baseDepartureTime = reservation.properties.departure_time;
        const [hours, minutes] = baseDepartureTime.split(':');
        const baseDate = new Date();
        baseDate.setHours(parseInt(hours) + service.departure_time_override_hours, parseInt(minutes), 0);
        departureTimeOverride = `${String(baseDate.getHours()).padStart(2, '0')}:${String(baseDate.getMinutes()).padStart(2, '0')}:00`;
      }

      // Insert or update the reservation addon
      const { data: addon, error: addonError } = await supabaseAdmin
        .from('reservation_addons')
        .upsert({
          reservation_id: reservationId,
          service_id: service.id,
          admin_enabled: true,
          purchase_status: 'available',
          access_time_override: accessTimeOverride,
          departure_time_override: departureTimeOverride
        }, {
          onConflict: 'reservation_id,service_id'
        })
        .select()
        .single();

      if (addonError) throw addonError;

      console.log(`Service ${serviceKey} enabled for reservation ${reservationId} by admin ${adminUserId}`);
      return addon;

    } catch (error) {
      console.error('Error enabling service for reservation:', error);
      throw new Error(`Failed to enable service: ${error.message}`);
    }
  }

  /**
   * Admin: Disable a service for a specific reservation
   */
  async disableServiceForReservation(reservationId, serviceKey, adminUserId) {
    try {
      // Get the service details
      const { data: service, error: serviceError } = await supabaseAdmin
        .from('guest_services')
        .select('id')
        .eq('service_key', serviceKey)
        .single();

      if (serviceError || !service) {
        throw new Error('Service not found');
      }

      // Delete the reservation addon if not paid, or mark as disabled if paid
      const { data: existingAddon, error: getError } = await supabaseAdmin
        .from('reservation_addons')
        .select('purchase_status')
        .eq('reservation_id', reservationId)
        .eq('service_id', service.id)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      if (existingAddon) {
        if (existingAddon.purchase_status === 'paid') {
          // Can't disable paid services, just mark as admin disabled
          const { error: updateError } = await supabaseAdmin
            .from('reservation_addons')
            .update({ admin_enabled: false })
            .eq('reservation_id', reservationId)
            .eq('service_id', service.id);

          if (updateError) throw updateError;
        } else {
          // Delete unpaid services
          const { error: deleteError } = await supabaseAdmin
            .from('reservation_addons')
            .delete()
            .eq('reservation_id', reservationId)
            .eq('service_id', service.id);

          if (deleteError) throw deleteError;
        }
      }

      console.log(`Service ${serviceKey} disabled for reservation ${reservationId} by admin ${adminUserId}`);
      return { success: true };

    } catch (error) {
      console.error('Error disabling service for reservation:', error);
      throw new Error(`Failed to disable service: ${error.message}`);
    }
  }

  /**
   * Create Stripe checkout session for a service
   */
  async createServiceCheckout(reservationId, serviceKey, guestToken, req) {
    try {
      console.log(`Creating service checkout for reservation ${reservationId}, service ${serviceKey}`);
      
      // Get reservation details
      const reservation = await reservationService.getReservationByToken(guestToken);
      if (!reservation || reservation.id !== reservationId) {
        throw new Error('Reservation not found or token mismatch');
      }

      // Get the enabled service addon - now including 'pending' status for retry scenarios
      const { data: addon, error: addonError } = await supabaseAdmin
        .from('reservation_addons')
        .select(`
          *,
          guest_services (
            service_key,
            name,
            description,
            price,
            currency
          )
        `)
        .eq('reservation_id', reservationId)
        .eq('guest_services.service_key', serviceKey)
        .eq('admin_enabled', true)
        .in('purchase_status', ['available', 'failed', 'pending'])
        .single();

      if (addonError || !addon) {
        console.error(`Service addon not found for reservation ${reservationId}, service ${serviceKey}:`, addonError);
        throw new Error('Service not available for purchase');
      }

      // Handle pending payments - cleanup old session and reset status
      if (addon.purchase_status === 'pending') {
        console.log(`Found pending payment for reservation ${reservationId}, service ${serviceKey}. Cleaning up...`);
        
        // Cancel any existing Stripe session if it exists
        if (addon.stripe_payment_intent_id) {
          try {
            // Check if it's a checkout session ID (starts with 'cs_') or payment intent ('pi_')
            if (addon.stripe_payment_intent_id.startsWith('cs_')) {
              console.log(`Attempting to expire existing Stripe checkout session: ${addon.stripe_payment_intent_id}`);
              await stripeService.stripe.checkout.sessions.expire(addon.stripe_payment_intent_id);
            }
          } catch (stripeError) {
            console.log(`Failed to expire old Stripe session (non-critical): ${stripeError.message}`);
            // Non-critical error - continue with new session creation
          }
        }

        // Reset the addon status to available for retry
        await supabaseAdmin
          .from('reservation_addons')
          .update({ 
            purchase_status: 'available',
            stripe_payment_intent_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', addon.id);

        console.log(`Reset pending payment status for addon ${addon.id} to allow retry`);
        
        // Update the addon object for the rest of the function
        addon.purchase_status = 'available';
        addon.stripe_payment_intent_id = null;
      }

      const service = addon.guest_services;

      // Build URLs for success and cancel
      const baseUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/guest/${guestToken}?payment_success=true&service=${serviceKey}`;
      const cancelUrl = `${baseUrl}/guest/${guestToken}?payment_canceled=true&service=${serviceKey}`;

      // Build guest name
      const guestName = [reservation.guest_firstname, reservation.guest_lastname]
        .filter(Boolean)
        .join(' ') || reservation.booking_name;

      // Use calculated amount for dynamic pricing services, otherwise use service price
      const amount = addon.calculated_amount || service.price;

      // Create Stripe checkout session
      const checkoutSession = await stripeService.createCheckoutSession({
        amount: amount,
        currency: service.currency,
        reservationId: reservationId,
        serviceType: serviceKey,
        guestEmail: reservation.guest_mail || reservation.booking_email,
        successUrl,
        cancelUrl,
        metadata: {
          guest_token: guestToken,
          guest_name: guestName,
          service_key: serviceKey,
          addon_id: addon.id
        }
      });

      // Update addon status to pending
      await supabaseAdmin
        .from('reservation_addons')
        .update({ 
          purchase_status: 'pending',
          stripe_payment_intent_id: checkoutSession.payment_intent 
        })
        .eq('id', addon.id);

      return checkoutSession;

    } catch (error) {
      console.error('Error creating service checkout:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Get available services for guest purchase (admin-enabled only)
   */
  async getAvailableServicesForGuest(guestToken) {
    try {
      // Get reservation details
      const reservation = await reservationService.getReservationByToken(guestToken);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get admin-enabled services for this reservation with dynamic pricing
      const { data: availableServices, error } = await supabaseAdmin
        .from('reservation_addons')
        .select(`
          *,
          guest_services (
            service_key,
            name,
            description,
            price,
            currency,
            requires_calculation,
            is_mandatory
          )
        `)
        .eq('reservation_id', reservation.id)
        .eq('admin_enabled', true)
        .order('created_at');

      if (error) throw error;

      // Process services with dynamic pricing
      const processedServices = availableServices.map(addon => {
        const service = addon.guest_services;
        return {
          id: addon.id,
          service_id: addon.service_id,
          service_type: service.service_key,
          name: service.name,
          description: service.description,
          price: addon.calculated_amount || service.price, // Use calculated amount if available
          currency: service.currency,
          is_mandatory: service.is_mandatory,
          requires_admin_approval: service.requires_admin_activation,
          admin_enabled: addon.admin_enabled,
          payment_status: addon.is_tax_exempted ? 'exempted' : addon.purchase_status,
          tax_calculation_details: addon.tax_calculation_details,
          access_time_offset: addon.access_time_override,
          departure_time_offset: addon.departure_time_override
        };
      });

      return processedServices;

    } catch (error) {
      console.error('Error getting available services for guest:', error);
      throw new Error(`Failed to get available services: ${error.message}`);
    }
  }

  /**
   * Auto-attach accommodation tax to a reservation
   * Called when a new reservation is created
   */
  async attachAccommodationTax(reservationId) {
    try {
      // Get accommodation tax service
      const { data: taxService, error: serviceError } = await supabaseAdmin
        .from('guest_services')
        .select('*')
        .eq('service_key', 'accommodation_tax')
        .eq('is_active', true)
        .single();

      if (serviceError || !taxService) {
        console.log('Accommodation tax service not found - skipping auto-attachment');
        return null;
      }

      // Check if accommodation tax already exists for this reservation
      const { data: existingAddon, error: existingError } = await supabaseAdmin
        .from('reservation_addons')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('service_id', taxService.id)
        .single();

      // If already exists and is paid or exempted, don't overwrite
      if (existingAddon && (existingAddon.purchase_status === 'paid' || existingAddon.purchase_status === 'exempted')) {
        console.log(`Accommodation tax already ${existingAddon.purchase_status} for reservation ${reservationId} - skipping recalculation`);
        return existingAddon;
      }

      // Get full reservation details for tax calculation
      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (reservationError) throw reservationError;

      // Calculate accommodation tax
      const taxCalculation = accommodationTaxCalculator.calculateForReservation(reservation);

      // If existing addon, preserve payment-related fields when updating
      let addonData = {
        reservation_id: reservationId,
        service_id: taxService.id,
        admin_enabled: true, // Auto-enabled for mandatory services
        purchase_status: taxCalculation.isExempt ? 'exempted' : 'available',
        calculated_amount: taxCalculation.amount,
        tax_calculation_details: taxCalculation.details,
        is_tax_exempted: taxCalculation.isExempt
      };

      // If updating existing addon, preserve important payment fields
      if (existingAddon) {
        addonData = {
          ...addonData,
          // Only update calculation if not paid/exempted
          purchase_status: existingAddon.purchase_status === 'paid' ? 'paid' : 
                          (taxCalculation.isExempt ? 'exempted' : existingAddon.purchase_status),
          stripe_payment_intent_id: existingAddon.stripe_payment_intent_id,
          paid_at: existingAddon.paid_at
        };
      }

      // Create or update the accommodation tax addon
      const { data: addon, error: addonError } = await supabaseAdmin
        .from('reservation_addons')
        .upsert(addonData, {
          onConflict: 'reservation_id,service_id'
        })
        .select()
        .single();

      if (addonError) throw addonError;

      console.log(`Accommodation tax attached to reservation ${reservationId}:`, {
        amount: taxCalculation.amount,
        isExempt: taxCalculation.isExempt
      });

      return addon;

    } catch (error) {
      console.error('Error attaching accommodation tax:', error);
      throw new Error(`Failed to attach accommodation tax: ${error.message}`);
    }
  }

  /**
   * Admin: Exempt a reservation from accommodation tax
   */
  async exemptFromAccommodationTax(reservationId, adminUserId, reason = null) {
    try {
      // Get accommodation tax service
      const { data: taxService, error: serviceError } = await supabaseAdmin
        .from('guest_services')
        .select('id')
        .eq('service_key', 'accommodation_tax')
        .single();

      if (serviceError || !taxService) {
        throw new Error('Accommodation tax service not found');
      }

      // Update the tax addon to exempted status
      const { data: addon, error: updateError } = await supabaseAdmin
        .from('reservation_addons')
        .update({
          purchase_status: 'exempted',
          is_tax_exempted: true,
          exempted_at: new Date().toISOString(),
          exempted_by: adminUserId,
          tax_calculation_details: {
            ...{}, // Keep existing details if any
            exemptionReason: reason,
            exemptedAt: new Date().toISOString(),
            exemptedBy: adminUserId
          }
        })
        .eq('reservation_id', reservationId)
        .eq('service_id', taxService.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`Accommodation tax exempted for reservation ${reservationId} by admin ${adminUserId}`);
      return addon;

    } catch (error) {
      console.error('Error exempting accommodation tax:', error);
      throw new Error(`Failed to exempt accommodation tax: ${error.message}`);
    }
  }

  /**
   * Admin: Remove exemption from accommodation tax
   */
  async removeAccommodationTaxExemption(reservationId, adminUserId) {
    try {
      // Get accommodation tax service
      const { data: taxService, error: serviceError } = await supabaseAdmin
        .from('guest_services')
        .select('id')
        .eq('service_key', 'accommodation_tax')
        .single();

      if (serviceError || !taxService) {
        throw new Error('Accommodation tax service not found');
      }

      // Get reservation for recalculation
      const { data: reservation, error: reservationError } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (reservationError) throw reservationError;

      // Recalculate tax amount
      const taxCalculation = accommodationTaxCalculator.calculateForReservation(reservation);

      // Update the tax addon back to available status
      const { data: addon, error: updateError } = await supabaseAdmin
        .from('reservation_addons')
        .update({
          purchase_status: taxCalculation.isExempt ? 'exempted' : 'available',
          is_tax_exempted: taxCalculation.isExempt,
          calculated_amount: taxCalculation.amount,
          tax_calculation_details: taxCalculation.details,
          exempted_at: null,
          exempted_by: null
        })
        .eq('reservation_id', reservationId)
        .eq('service_id', taxService.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`Accommodation tax exemption removed for reservation ${reservationId} by admin ${adminUserId}`);
      return addon;

    } catch (error) {
      console.error('Error removing accommodation tax exemption:', error);
      throw new Error(`Failed to remove accommodation tax exemption: ${error.message}`);
    }
  }

  /**
   * Admin: Update reservation addon refund status
   * Used for refund operations
   */
  async updateReservationAddonRefundStatus(reservationId, serviceId, refundData) {
    try {
      const { error } = await supabaseAdmin
        .from('reservation_addons')
        .update({
          purchase_status: refundData.purchase_status,
          refund_amount: refundData.refund_amount,
          refunded_at: refundData.refunded_at,
          updated_at: new Date().toISOString()
        })
        .eq('reservation_id', reservationId)
        .eq('service_id', serviceId);

      if (error) throw error;

      console.log(`Refund status updated for reservation ${reservationId}, service ${serviceId}`);
      return { success: true };

    } catch (error) {
      console.error('Error updating addon refund status:', error);
      throw new Error(`Failed to update refund status: ${error.message}`);
    }
  }

  /**
   * Admin: Update reservation addon status
   * Used for void operations and general status updates
   */
  async updateReservationAddonStatus(reservationId, serviceId, statusData) {
    try {
      const updateData = {
        ...statusData,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseAdmin
        .from('reservation_addons')
        .update(updateData)
        .eq('reservation_id', reservationId)
        .eq('service_id', serviceId);

      if (error) throw error;

      console.log(`Addon status updated for reservation ${reservationId}, service ${serviceId}`);
      return { success: true };

    } catch (error) {
      console.error('Error updating addon status:', error);
      throw new Error(`Failed to update addon status: ${error.message}`);
    }
  }
}

module.exports = new GuestServicesService();

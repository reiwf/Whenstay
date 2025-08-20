const express = require('express');
const router = express.Router();
const accommodationTaxService = require('../services/accommodationTaxService');
const stripeService = require('../services/stripeService');

/**
 * GET /api/upsell/service-descriptor
 * Get service descriptor for a guest token (accommodation tax details)
 */
router.get('/service-descriptor', async (req, res) => {
  try {
    const { service, token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Guest token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // For now, only support accommodation_tax service
    if (service && service !== 'accommodation_tax') {
      return res.status(400).json({ 
        error: 'Unsupported service type',
        code: 'UNSUPPORTED_SERVICE'
      });
    }

    const descriptor = await accommodationTaxService.getServiceDescriptor(token);

    res.status(200).json({
      success: true,
      data: descriptor
    });

  } catch (error) {
    console.error('Error getting service descriptor:', error);
    
    // Handle specific error cases
    if (error.message.includes('Reservation not found')) {
      return res.status(404).json({ 
        error: 'Reservation not found',
        code: 'RESERVATION_NOT_FOUND'
      });
    }

    res.status(500).json({ 
      error: 'Failed to get service descriptor',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/upsell/create-checkout-session
 * Create Stripe hosted checkout session for guest services
 */
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { service = 'accommodation_tax', token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Guest token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // For now, only support accommodation_tax service
    if (service !== 'accommodation_tax') {
      return res.status(400).json({ 
        error: 'Unsupported service type',
        code: 'UNSUPPORTED_SERVICE'
      });
    }

    const checkoutSession = await accommodationTaxService.createCheckoutSession(token, req);

    res.status(200).json({
      success: true,
      data: {
        sessionId: checkoutSession.sessionId,
        checkoutUrl: checkoutSession.checkoutUrl,
        amount: checkoutSession.amount,
        currency: checkoutSession.currency,
        status: checkoutSession.status
      }
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    // Handle specific error cases
    if (error.message.includes('Tax invoice not found')) {
      return res.status(404).json({ 
        error: 'Tax invoice not found',
        code: 'INVOICE_NOT_FOUND'
      });
    }

    if (error.message.includes('Tax already paid')) {
      return res.status(400).json({ 
        error: 'Tax already paid',
        code: 'ALREADY_PAID'
      });
    }

    if (error.message.includes('Tax payment not required')) {
      return res.status(400).json({ 
        error: 'Tax payment not required (exempted)',
        code: 'PAYMENT_NOT_REQUIRED'
      });
    }

    res.status(500).json({ 
      error: 'Failed to create checkout session',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/upsell/create-intent
 * Create payment intent for guest services (legacy method)
 */
router.post('/create-intent', async (req, res) => {
  try {
    const { service = 'accommodation_tax', token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Guest token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // For now, only support accommodation_tax service
    if (service !== 'accommodation_tax') {
      return res.status(400).json({ 
        error: 'Unsupported service type',
        code: 'UNSUPPORTED_SERVICE'
      });
    }

    const paymentIntent = await accommodationTaxService.createPaymentIntent(token);

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      }
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    // Handle specific error cases
    if (error.message.includes('Tax invoice not found')) {
      return res.status(404).json({ 
        error: 'Tax invoice not found',
        code: 'INVOICE_NOT_FOUND'
      });
    }

    if (error.message.includes('Tax already paid')) {
      return res.status(400).json({ 
        error: 'Tax already paid',
        code: 'ALREADY_PAID'
      });
    }

    if (error.message.includes('Tax payment not required')) {
      return res.status(400).json({ 
        error: 'Tax payment not required (exempted)',
        code: 'PAYMENT_NOT_REQUIRED'
      });
    }

    res.status(500).json({ 
      error: 'Failed to create payment intent',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/upsell/status
 * Get payment status for a guest token
 */
router.get('/status', async (req, res) => {
  try {
    const { service = 'accommodation_tax', token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Guest token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // For now, only support accommodation_tax service
    if (service !== 'accommodation_tax') {
      return res.status(400).json({ 
        error: 'Unsupported service type',
        code: 'UNSUPPORTED_SERVICE'
      });
    }

    const status = await accommodationTaxService.getPaymentStatus(token);

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting payment status:', error);
    
    res.status(500).json({ 
      error: 'Failed to get payment status',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/upsell/stripe-webhook
 * Handle Stripe webhook events (raw body required for signature verification)
 */
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).json({ 
        error: 'Missing stripe signature',
        code: 'MISSING_SIGNATURE'
      });
    }

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(req.body, sig);
    
    console.log(`Processing webhook event: ${event.type} - ${event.id}`);

    // Handle the event
    await stripeService.handleWebhookEvent(event);

    // Return success response to Stripe
    res.status(200).json({ 
      success: true,
      eventId: event.id,
      eventType: event.type
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    if (error.message.includes('Webhook signature verification failed')) {
      return res.status(400).json({ 
        error: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    res.status(500).json({ 
      error: 'Webhook processing failed',
      code: 'WEBHOOK_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/upsell/test-tax-calculation
 * Test endpoint for tax calculation (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/test-tax-calculation', async (req, res) => {
    try {
      const { totalAmount, nights, numGuests } = req.query;
      
      const amount = parseFloat(totalAmount) || 10000;
      const nightsCount = parseInt(nights) || 1;
      const guestsCount = parseInt(numGuests) || 1;

      const calculation = accommodationTaxService.calculateAccommodationTax(
        amount, 
        nightsCount, 
        guestsCount
      );

      res.status(200).json({
        success: true,
        input: {
          totalAmount: amount,
          nights: nightsCount,
          numGuests: guestsCount
        },
        calculation: calculation
      });

    } catch (error) {
      console.error('Error in test calculation:', error);
      res.status(500).json({ 
        error: 'Test calculation failed',
        details: error.message 
      });
    }
  });
}

module.exports = router;

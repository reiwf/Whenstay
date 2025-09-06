const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const stripeService = require('../services/stripeService');
const { adminAuth } = require('../middleware/auth');

// Apply admin authentication to all payment routes
router.use(adminAuth);

/**
 * GET /api/payments - Get all payments with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = '', 
      service_type = '',
      date_from = '',
      date_to = '',
      transaction_type = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    // Build the query
    let query = supabaseAdmin
      .from('payment_transactions_detailed')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`booking_name.ilike.%${search}%,booking_email.ilike.%${search}%,beds24_booking_id.ilike.%${search}%,stripe_transaction_id.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (service_type) {
      query = query.eq('service_type', service_type);
    }

    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    // Apply sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by, { ascending });

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: payments, error, count } = await query;

    if (error) throw error;

    // Calculate summary statistics
    const { data: summaryData, error: summaryError } = await supabaseAdmin
      .from('payment_transactions_detailed')
      .select('transaction_type, amount, status');

    if (summaryError) throw summaryError;

    const summary = {
      total_payments: summaryData.filter(p => p.transaction_type === 'payment' && p.status === 'succeeded').length,
      total_refunds: summaryData.filter(p => p.transaction_type.includes('refund') && p.status === 'succeeded').length,
      total_payment_amount: summaryData
        .filter(p => p.transaction_type === 'payment' && p.status === 'succeeded')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
      total_refund_amount: summaryData
        .filter(p => p.transaction_type.includes('refund') && p.status === 'succeeded')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    };

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * GET /api/payments/by-stripe-id/:stripeId - Get payment intent by Stripe ID
 */
router.get('/by-stripe-id/:stripeId', async (req, res) => {
  try {
    const { stripeId } = req.params;

    if (!stripeId) {
      return res.status(400).json({ error: 'Stripe ID is required' });
    }

    // Get payment intent by stripe_payment_intent_id
    const { data: paymentIntent, error } = await supabaseAdmin
      .from('payment_intents')
      .select('id, stripe_payment_intent_id, amount, currency, status, service_type, created_at')
      .eq('stripe_payment_intent_id', stripeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Payment intent not found for this Stripe ID' });
      }
      throw error;
    }

    res.json({
      success: true,
      data: paymentIntent,
      message: 'Payment intent found'
    });

  } catch (error) {
    console.error('Error fetching payment intent by Stripe ID:', error);
    res.status(500).json({ error: 'Failed to fetch payment intent' });
  }
});

/**
 * GET /api/payments/:id - Get detailed payment information
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get payment intent with all related data
    const { data: paymentIntent, error } = await supabaseAdmin
      .from('payment_intents')
      .select(`
        *,
        reservations (
          id,
          beds24_booking_id,
          booking_name,
          booking_email,
          check_in_date,
          check_out_date,
          num_guests,
          total_amount,
          properties (
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Payment not found' });
      }
      throw error;
    }

    // Get all transactions for this payment intent
    const { data: transactions, error: transError } = await supabaseAdmin
      .from('payment_transactions')
      .select('*')
      .eq('payment_intent_id', id)
      .order('created_at', { ascending: false });

    if (transError) throw transError;

    // 1) If we stored a Checkout Session ID, resolve the actual Payment Intent ID
    let actualPaymentIntentId = paymentIntent.stripe_payment_intent_id;
    
    // If this is a checkout session ID (starts with cs_), get the actual payment intent ID
    if (paymentIntent.stripe_payment_intent_id.startsWith('cs_')) {
      try {
        const syncResult = await stripeService.syncPaymentStatusFromStripe(
          paymentIntent.stripe_payment_intent_id,
          null // Let sync function discover the actual payment intent ID
        );
        // Extract actual payment intent ID from sync result or metadata
        if (paymentIntent.metadata && paymentIntent.metadata.actual_payment_intent_id) {
          actualPaymentIntentId = paymentIntent.metadata.actual_payment_intent_id;
        }
      } catch (syncError) {
        console.warn('Could not sync payment status from Stripe:', syncError.message);
      }
    }

    // 2) Calculate refunds from Stripe (source of truth)
    let stripeRefundHistory = null;
    let totalRefundedFromStripe = 0;
    
    try {
      if (actualPaymentIntentId.startsWith('pi_') || actualPaymentIntentId.startsWith('cs_')) {
        stripeRefundHistory = await stripeService.getRefundHistory(actualPaymentIntentId);
        totalRefundedFromStripe = stripeRefundHistory?.totalRefunded || 0;
      }
    } catch (stripeError) {
      console.warn('Could not fetch Stripe refund history:', stripeError.message);
    }

    // 3) Calculate refunds from DB ledger as fallback/cross-check
    let refundedFromLedger = 0;
    try {
      const { data: ledgerData } = await supabaseAdmin
        .from('payment_transactions_detailed')
        .select('*')
        .eq('payment_intent_id', id)
        .maybeSingle();
      
      // Calculate total refunded from transactions
      const refundedTransactions = transactions.filter(t => 
        (t.transaction_type === 'refund' || t.transaction_type === 'partial_refund') && 
        t.status === 'succeeded'
      );
      refundedFromLedger = refundedTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    } catch (ledgerError) {
      console.warn('Could not calculate refunded from ledger:', ledgerError.message);
    }

    // 4) Pick the higher confidence value (Stripe), but include both
    const totalRefunded = Math.max(totalRefundedFromStripe, refundedFromLedger);
    const originalAmount = parseFloat(paymentIntent.amount || 0);
    const availableToRefund = Math.max(0, originalAmount - totalRefunded);

    console.log('Refund calculation:', {
      paymentIntentId: id,
      originalAmount,
      totalRefundedFromStripe,
      refundedFromLedger,
      totalRefunded,
      availableToRefund
    });

    res.json({
      payment_intent: paymentIntent,
      transactions,
      stripe_refund_history: stripeRefundHistory || { refunds: [], totalRefunded: totalRefundedFromStripe, count: 0 },
      db_refund_total: refundedFromLedger,
      available_to_refund: availableToRefund,
      refund_calculation: {
        original_amount: originalAmount,
        total_refunded: totalRefunded,
        available_to_refund: availableToRefund,
        stripe_total: totalRefundedFromStripe,
        db_total: refundedFromLedger
      }
    });

  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

/**
 * POST /api/payments/:id/refund - Process a refund
 */
router.post('/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason = 'requested_by_customer', metadata = {} } = req.body;

    // Validate input
    if (amount && (isNaN(amount) || amount <= 0)) {
      return res.status(400).json({ error: 'Invalid refund amount' });
    }

    // Get payment intent
    const { data: paymentIntent, error } = await supabaseAdmin
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !paymentIntent) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Process refund through Stripe
    const refundResult = await stripeService.refundPayment(
      paymentIntent.stripe_payment_intent_id,
      amount,
      reason,
      {
        ...metadata,
        refunded_by_user_id: req.user.id,
        admin_refund: 'true'
      }
    );

    // Record transaction in our database
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        payment_intent_id: id,
        stripe_transaction_id: refundResult.refundId,
        transaction_type: amount ? 'partial_refund' : 'refund',
        amount: refundResult.amount,
        currency: refundResult.currency,
        status: refundResult.status,
        stripe_data: {
          refund_id: refundResult.refundId,
          reason: refundResult.reason,
          created: refundResult.created,
          refunded_by: req.user.id,
          metadata: metadata
        }
      })
      .select()
      .single();

    if (transError) {
      console.error('Error recording refund transaction:', transError);
      // Don't fail the request since Stripe refund succeeded
    }

    res.json({
      success: true,
      refund: refundResult,
      transaction
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ 
      error: 'Failed to process refund',
      details: error.message 
    });
  }
});

/**
 * POST /api/payments/reconcile - Reconcile payments with Stripe
 */
router.post('/reconcile', async (req, res) => {
  try {
    const { date_from, date_to, dry_run = true } = req.body;

    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from and date_to are required' });
    }

    const reconciliationResults = {
      missing_transactions: [],
      mismatched_amounts: [],
      processed_count: 0,
      errors: []
    };

    // Get all payment intents in the date range
    const { data: paymentIntents, error } = await supabaseAdmin
      .from('payment_intents')
      .select('*')
      .gte('created_at', date_from)
      .lte('created_at', date_to)
      .order('created_at');

    if (error) throw error;

    for (const paymentIntent of paymentIntents) {
      try {
        // Get existing transactions for this payment intent
        const { data: existingTransactions } = await supabaseAdmin
          .from('payment_transactions')
          .select('*')
          .eq('payment_intent_id', paymentIntent.id);

        // Get Stripe data for comparison
        let stripeData = null;
        if (paymentIntent.stripe_payment_intent_id.startsWith('pi_')) {
          stripeData = await stripeService.getPaymentIntent(paymentIntent.stripe_payment_intent_id);
        }

        // Check for missing payment transaction
        const hasPaymentTransaction = existingTransactions?.some(t => t.transaction_type === 'payment');
        if (!hasPaymentTransaction && paymentIntent.status === 'succeeded') {
          reconciliationResults.missing_transactions.push({
            payment_intent_id: paymentIntent.id,
            stripe_payment_intent_id: paymentIntent.stripe_payment_intent_id,
            type: 'payment',
            amount: paymentIntent.amount,
            reason: 'Missing payment transaction record'
          });

          // Create missing payment transaction if not dry run
          if (!dry_run && stripeData) {
            await supabaseAdmin
              .from('payment_transactions')
              .insert({
                payment_intent_id: paymentIntent.id,
                stripe_transaction_id: paymentIntent.stripe_payment_intent_id,
                transaction_type: 'payment',
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                stripe_data: stripeData,
                processed_at: paymentIntent.updated_at
              });
          }
        }

        // Check for missing refunds
        if (stripeData && paymentIntent.stripe_payment_intent_id.startsWith('pi_')) {
          const refundHistory = await stripeService.getRefundHistory(paymentIntent.stripe_payment_intent_id);
          
          for (const refund of refundHistory.refunds || []) {
            const hasRefundTransaction = existingTransactions?.some(
              t => t.stripe_transaction_id === refund.refundId
            );

            if (!hasRefundTransaction && refund.status === 'succeeded') {
              reconciliationResults.missing_transactions.push({
                payment_intent_id: paymentIntent.id,
                stripe_payment_intent_id: paymentIntent.stripe_payment_intent_id,
                type: 'refund',
                amount: refund.amount,
                refund_id: refund.refundId,
                reason: 'Missing refund transaction record'
              });

              // Create missing refund transaction if not dry run
              if (!dry_run) {
                await supabaseAdmin
                  .from('payment_transactions')
                  .insert({
                    payment_intent_id: paymentIntent.id,
                    stripe_transaction_id: refund.refundId,
                    transaction_type: 'refund',
                    amount: refund.amount,
                    currency: refund.currency,
                    status: refund.status,
                    stripe_data: refund,
                    processed_at: new Date(refund.created * 1000).toISOString()
                  });
              }
            }
          }
        }

        reconciliationResults.processed_count++;

      } catch (itemError) {
        console.error(`Error processing payment ${paymentIntent.id}:`, itemError);
        reconciliationResults.errors.push({
          payment_intent_id: paymentIntent.id,
          error: itemError.message
        });
      }
    }

    res.json({
      success: true,
      dry_run,
      results: reconciliationResults
    });

  } catch (error) {
    console.error('Error during reconciliation:', error);
    res.status(500).json({ error: 'Failed to reconcile payments' });
  }
});

/**
 * GET /api/payments/analytics/summary - Get payment analytics
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const { date_from, date_to, property_id } = req.query;

    let query = supabaseAdmin
      .from('payment_transactions_detailed')
      .select('*');

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    if (property_id) {
      // This would need to be joined through reservations
      // For now, we'll handle it in the summary calculation
    }

    const { data: transactions, error } = await query;

    if (error) throw error;

    // Calculate analytics
    const analytics = {
      total_transactions: transactions.length,
      payments: {
        count: transactions.filter(t => t.transaction_type === 'payment' && t.status === 'succeeded').length,
        amount: transactions
          .filter(t => t.transaction_type === 'payment' && t.status === 'succeeded')
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
      },
      refunds: {
        count: transactions.filter(t => t.transaction_type.includes('refund') && t.status === 'succeeded').length,
        amount: transactions
          .filter(t => t.transaction_type.includes('refund') && t.status === 'succeeded')
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
      },
      by_service_type: {},
      by_status: {},
      by_month: {}
    };

    // Group by service type
    transactions.forEach(t => {
      if (!analytics.by_service_type[t.service_type]) {
        analytics.by_service_type[t.service_type] = { count: 0, amount: 0 };
      }
      analytics.by_service_type[t.service_type].count++;
      analytics.by_service_type[t.service_type].amount += parseFloat(t.amount || 0);
    });

    // Group by status
    transactions.forEach(t => {
      if (!analytics.by_status[t.status]) {
        analytics.by_status[t.status] = { count: 0, amount: 0 };
      }
      analytics.by_status[t.status].count++;
      analytics.by_status[t.status].amount += parseFloat(t.amount || 0);
    });

    // Group by month
    transactions.forEach(t => {
      const month = new Date(t.created_at).toISOString().substring(0, 7); // YYYY-MM
      if (!analytics.by_month[month]) {
        analytics.by_month[month] = { count: 0, amount: 0 };
      }
      analytics.by_month[month].count++;
      analytics.by_month[month].amount += parseFloat(t.amount || 0);
    });

    // Calculate net revenue
    analytics.net_revenue = analytics.payments.amount - analytics.refunds.amount;

    res.json(analytics);

  } catch (error) {
    console.error('Error fetching payment analytics:', error);
    res.status(500).json({ error: 'Failed to fetch payment analytics' });
  }
});

/**
 * GET /api/payments/export - Export payments to CSV
 */
router.get('/export', async (req, res) => {
  try {
    const { 
      search = '', 
      status = '', 
      service_type = '',
      date_from = '',
      date_to = '',
      transaction_type = ''
    } = req.query;

    let query = supabaseAdmin
      .from('payment_transactions_detailed')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply the same filters as the main list
    if (search) {
      query = query.or(`booking_name.ilike.%${search}%,booking_email.ilike.%${search}%,beds24_booking_id.ilike.%${search}%,stripe_transaction_id.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (service_type) {
      query = query.eq('service_type', service_type);
    }

    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data: payments, error } = await query;

    if (error) throw error;

    // Convert to CSV format
    const csvHeaders = [
      'Transaction ID',
      'Payment Intent ID', 
      'Stripe Transaction ID',
      'Transaction Type',
      'Amount',
      'Currency',
      'Status',
      'Service Type',
      'Booking ID',
      'Guest Name',
      'Guest Email',
      'Property Name',
      'Check-in Date',
      'Check-out Date',
      'Processed At',
      'Created At'
    ];

    const csvData = payments.map(payment => [
      payment.id,
      payment.payment_intent_id,
      payment.stripe_transaction_id,
      payment.transaction_type,
      payment.amount,
      payment.currency,
      payment.status,
      payment.service_type || '',
      payment.beds24_booking_id || '',
      payment.booking_name || '',
      payment.booking_email || '',
      payment.property_name || '',
      payment.check_in_date || '',
      payment.check_out_date || '',
      payment.processed_at,
      payment.created_at
    ]);

    const csv = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field || ''}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Error exporting payments:', error);
    res.status(500).json({ error: 'Failed to export payments' });
  }
});

module.exports = router;

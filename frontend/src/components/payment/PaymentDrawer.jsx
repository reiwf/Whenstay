import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  RefreshCw, 
  Download, 
  Undo,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Calendar,
  DollarSign,
  Users,
  Building2,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

// UI Components
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

// API import
import { paymentAPI } from '../../services/api';

// Status badge component
const StatusBadge = ({ status, type = 'status' }) => {
  const getStatusConfig = () => {
    if (type === 'transaction') {
      switch (status) {
        case 'payment':
          return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: ArrowUpRight };
        case 'refund':
        case 'partial_refund':
          return { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200', icon: ArrowDownLeft };
        case 'void':
          return { variant: 'secondary', className: 'bg-gray-100 text-gray-800 border-gray-200', icon: XCircle };
        default:
          return { variant: 'outline', className: '', icon: FileText };
      }
    }

    switch (status) {
      case 'succeeded':
        return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle };
      case 'pending':
      case 'requires_action':
        return { variant: 'outline', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock };
      case 'failed':
      case 'canceled':
        return { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle };
      default:
        return { variant: 'secondary', className: '', icon: FileText };
    }
  };

  const { className, icon: Icon } = getStatusConfig();

  return (
    <Badge className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
};

export default function PaymentDrawer({ paymentId, isOpen, onClose }) {
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [processingRefund, setProcessingRefund] = useState(false);

  // Calculate available refund amount with defensive fallback
  const getAvailableRefundAmount = () => {
    if (!payment_intent) return 0;
    
    // 1) First, try to use the backend's calculated available_to_refund
    if (paymentDetails && typeof paymentDetails.available_to_refund === 'number') {
      return paymentDetails.available_to_refund;
    }
    
    // 2) Fallback: use stripe_refund_history if available
    if (stripe_refund_history && typeof stripe_refund_history.totalRefunded === 'number') {
      return Math.max(0, payment_intent.amount - stripe_refund_history.totalRefunded);
    }
    
    // 3) Final fallback: calculate from transaction history
    if (transactions && Array.isArray(transactions)) {
      const succeededRefunds = transactions
        .filter(t => 
          (t.transaction_type === 'refund' || t.transaction_type === 'partial_refund') && 
          t.status === 'succeeded'
        )
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      return Math.max(0, payment_intent.amount - succeededRefunds);
    }
    
    // 4) Ultimate fallback: full original amount
    return payment_intent.amount || 0;
  };

  // Check if refunds are available
  const canRefund = () => {
    return payment_intent && 
           ['succeeded', 'partially_refunded'].includes(payment_intent.status) && 
           getAvailableRefundAmount() > 0;
  };

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchPaymentDetails();
    }
  }, [isOpen, paymentId]);

  const fetchPaymentDetails = async () => {
    setLoading(true);
    try {
      const response = await paymentAPI.getPaymentDetails(paymentId);
      setPaymentDetails(response.data);
    } catch (error) {
      console.error('Error fetching payment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmRefund = async () => {
    const refundAmountValue = refundAmount ? parseFloat(refundAmount) : getAvailableRefundAmount();
    const ok = window.confirm(
      `Confirm refund of ${formatCurrency(refundAmountValue, payment_intent.currency)}?`
    );
    if (!ok) return;
    await handleRefund();
  };

  const handleRefund = async () => {
    setProcessingRefund(true);
    try {
      await paymentAPI.processRefund(paymentId, {
        amount: refundAmount ? parseFloat(refundAmount) : null,
        reason: refundReason
      });
      
      // Refresh payment details and close form
      await fetchPaymentDetails();
      setShowRefundForm(false);
      setRefundAmount('');
      setRefundReason('requested_by_customer');
      
      // Show success message
      toast.success('Refund processed successfully');
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error(error?.response?.data?.message || 'Failed to process refund');
    } finally {
      setProcessingRefund(false);
    }
  };

  const formatCurrency = (amount, currency = 'JPY') => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return 'N/A';
    return new Date(dateTime).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  const { payment_intent, transactions, stripe_refund_history } = paymentDetails || {};

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Details
              </h2>
              <div className="flex items-center space-x-3 mt-2">
                {payment_intent && (
                  <p className="text-sm text-gray-600">
                    Payment Intent: {payment_intent.stripe_payment_intent_id}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={fetchPaymentDetails}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading payment details...
              </div>
            ) : paymentDetails ? (
              <div className="space-y-6">
                {/* Payment Information Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Payment Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Original Amount:</span>
                        <span className="font-medium">{formatCurrency(payment_intent.amount, payment_intent.currency)}</span>
                      </div>
                      {stripe_refund_history && stripe_refund_history.totalRefunded > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Refunded:</span>
                            <span className="font-medium text-red-600">
                              -{formatCurrency(stripe_refund_history.totalRefunded, payment_intent.currency)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-sm text-gray-600 font-medium">Current Balance:</span>
                            <span className="font-bold text-lg text-green-600">
                              {formatCurrency(payment_intent.amount - stripe_refund_history.totalRefunded, payment_intent.currency)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <StatusBadge status={payment_intent.status} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Service Type:</span>
                        <span className="font-medium">{payment_intent.service_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="text-sm">{format(parseISO(payment_intent.created_at), 'PPp')}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canRefund() && !showRefundForm && (
                        <div className="space-y-3">
                          <Button 
                            onClick={() => setShowRefundForm(true)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Undo className="w-4 h-4 mr-2" />
                            Process Refund
                          </Button>
                        </div>
                      )}
                      {!canRefund() && payment_intent && (
                        <div className="text-sm text-gray-500 text-center py-4">
                          {payment_intent.status === 'refunded' ? 'Fully refunded' : 
                           getAvailableRefundAmount() <= 0 ? 'No amount available to refund' :
                           'Refund not available for this payment status'}
                        </div>
                      )}
                      {showRefundForm && (
                        <div className="space-y-4">                          
                          <div>
                            <label className="block text-sm font-medium mb-1">Refund Amount</label>
                            
                            {/* Preset refund amount chips */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Button variant="secondary" size="sm"
                                onClick={() => setRefundAmount(String(getAvailableRefundAmount()))}>
                                Refund All
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setRefundAmount('')}>
                                Clear
                              </Button>
                            </div>
                            
                            <Input
                              type="number"
                              placeholder={`Max: ${getAvailableRefundAmount()}`}
                              value={refundAmount}
                              onChange={(e) => setRefundAmount(e.target.value)}
                              max={getAvailableRefundAmount()}
                              min="0"
                              step="100"
                            />
                            
                            {/* Live remaining balance calculation */}
                            {refundAmount && (
                              <div className="text-xs text-gray-600 mt-1">
                                Remaining after refund: <span className="font-medium">
                                  {formatCurrency(Math.max(0, getAvailableRefundAmount() - Number(refundAmount || 0)), payment_intent.currency)}
                                </span>
                              </div>
                            )}
                            
                            <div className="text-xs text-gray-500 mt-1">
                              Leave empty for full refund of remaining amount
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-1">Reason</label>
                            <Select value={refundReason} onValueChange={setRefundReason}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requested_by_customer">Requested by customer</SelectItem>
                                <SelectItem value="duplicate">Duplicate charge</SelectItem>
                                <SelectItem value="fraudulent">Fraudulent</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setShowRefundForm(false);
                                setRefundAmount('');
                                setRefundReason('requested_by_customer');
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={confirmRefund} 
                              disabled={processingRefund || (refundAmount && parseFloat(refundAmount) > getAvailableRefundAmount())}
                              size="sm"
                              className="flex-1"
                            >
                              {processingRefund ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Undo className="w-4 h-4 mr-2" />
                                  Process Refund
                                </>
                              )}
                            </Button>
                          </div>
                          {refundAmount && parseFloat(refundAmount) > getAvailableRefundAmount() && (
                            <div className="text-red-600 text-sm">
                              Refund amount cannot exceed available balance
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Refund Summary */}
                {stripe_refund_history && stripe_refund_history.refunds.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Refund Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Refunded:</span>
                          <span className="font-medium text-red-600">
                            -{formatCurrency(stripe_refund_history.totalRefunded, payment_intent.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Refund Count:</span>
                          <span className="font-medium">{stripe_refund_history.count}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Transactions Section */}
                {transactions && transactions.length > 0 && (() => {
                  // Calculate running balance for each transaction
                  const txWithBalance = (() => {
                    if (!transactions || !payment_intent) return [];
                    let bal = payment_intent.amount;
                    return transactions
                      .slice()
                      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                      .map(t => {
                        if ((t.transaction_type === 'refund' || t.transaction_type === 'partial_refund') && t.status === 'succeeded') {
                          bal -= Number(t.amount || 0);
                        }
                        return { ...t, running_balance: bal };
                      })
                      .reverse(); // Show newest first
                  })();

                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Transaction History
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {txWithBalance.map((transaction) => (
                          <div key={transaction.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <StatusBadge status={transaction.transaction_type} type="transaction" />
                                <div>
                                  <div className="font-medium">{formatCurrency(transaction.amount, transaction.currency)}</div>
                                  <div className="text-sm text-gray-600">{transaction.stripe_transaction_id}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <StatusBadge status={transaction.status} />
                                  <div className="font-medium text-sm">
                                    {formatCurrency(transaction.running_balance, transaction.currency)}
                                  </div>
                                  <div className="text-xs text-gray-500">Balance</div>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {format(parseISO(transaction.created_at), 'PPp')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Reservation Details Section */}
                {payment_intent?.reservations && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Reservation Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Booking ID:</span>
                            <span className="font-medium">{payment_intent.reservations.beds24_booking_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Guest:</span>
                            <span className="font-medium">{payment_intent.reservations.booking_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Email:</span>
                            <span className="font-medium">{payment_intent.reservations.booking_email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Property:</span>
                            <span className="font-medium">{payment_intent.reservations.properties?.name}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Check-in:</span>
                            <span className="font-medium">{format(parseISO(payment_intent.reservations.check_in_date), 'PPP')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Check-out:</span>
                            <span className="font-medium">{format(parseISO(payment_intent.reservations.check_out_date), 'PPP')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Guests:</span>
                            <span className="font-medium">{payment_intent.reservations.num_guests || 1}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Amount:</span>
                            <span className="font-medium">{formatCurrency(payment_intent.reservations.total_amount, payment_intent.currency)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">No payment details found</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

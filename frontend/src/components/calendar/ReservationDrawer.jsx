import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Calendar, 
  DollarSign, 
  Building2, 
  Phone, 
  Mail, 
  CreditCard, 
  Users, 
  Key,
  Clock,
  FileText,
  Shield,
  Plus,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Receipt,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Activity,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { adminAPI, paymentAPI } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import MessageDrawer from '../communication/MessageDrawer';
import PaymentDrawer from '../payment/PaymentDrawer';
import toast from 'react-hot-toast';

// Import booking source logos
import airbnbLogo from '../../../shared/airbnblogo.png';
import bookingLogo from '../../../shared/bookinglogo.png';
import tripLogo from '../../../shared/triplogo.png';

export default function ReservationDrawer({ 
  reservation, 
  isOpen, 
  onClose 
}) {
  const [loading, setLoading] = useState(false);
  const [reservationDetails, setReservationDetails] = useState(null);
  const [reservationServices, setReservationServices] = useState([]);
  const [purchasedServices, setPurchasedServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [showMessageDrawer, setShowMessageDrawer] = useState(false);
  
  // PaymentDrawer state
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  // Fetch detailed reservation data when drawer opens
  useEffect(() => {
    if (isOpen && reservation) {
      console.log('ReservationDrawer: Opening with reservation:', reservation);
      fetchReservationDetails();
      fetchGuestServices();
    }
  }, [isOpen, reservation]);

  const fetchReservationDetails = async () => {
    if (!reservation) {
      console.warn('ReservationDrawer: No reservation provided');
      return;
    }
    
    // Try multiple possible ID properties
    const reservationId = reservation.id || reservation.reservationId || reservation.reservation_id;
    
    console.log('ReservationDrawer: Attempting to fetch details for reservation:', {
      originalReservation: reservation,
      extractedId: reservationId,
      availableProps: Object.keys(reservation)
    });
    
    if (!reservationId) {
      console.error('ReservationDrawer: No valid ID found in reservation object');
      toast.error('Invalid reservation data - no ID found');
      return;
    }
    
    setLoading(true);
    try {
      console.log('ReservationDrawer: Calling API with ID:', reservationId);
      const response = await adminAPI.getReservationDetails(reservationId);
      
      console.log('ReservationDrawer: API response received:', response);
      
      // Handle the actual API response structure: { data: { message: '...', data: { reservation: {...} } } }
      if (response.data && response.data.data && response.data.data.reservation) {
        // Handle nested API response format: { data: { data: { reservation: {...} } } }
        setReservationDetails(response.data.data.reservation);
        console.log('ReservationDrawer: Set reservation details from nested API data');
      } else if (response.data && response.data.data) {
        // Handle direct reservation data in nested format: { data: { data: {...} } }
        setReservationDetails(response.data.data);
        console.log('ReservationDrawer: Set reservation details from nested data');
      } else if (response.data && response.data.reservation) {
        // Handle legacy API response format: { data: { reservation: {...} } }
        setReservationDetails(response.data.reservation);
        console.log('ReservationDrawer: Set reservation details from legacy nested data');
      } else if (response.data) {
        // Handle direct reservation data format: { data: {...} } (fallback)
        setReservationDetails(response.data);
        console.log('ReservationDrawer: Set reservation details from direct data (fallback)');
      } else {
        console.warn('ReservationDrawer: Unexpected API response format:', response);
        setReservationDetails(null);
      }
    } catch (error) {
      console.error('ReservationDrawer: Error fetching reservation details:', {
        error: error,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        reservationId: reservationId
      });
      
      // Provide more specific error messages
      if (error.response?.status === 404) {
        toast.error('Reservation not found');
      } else if (error.response?.status === 401) {
        toast.error('Authentication required');
      } else if (error.response?.status === 403) {
        toast.error('Access denied');
      } else {
        toast.error(`Failed to load reservation details: ${error.message || 'Unknown error'}`);
      }
      
      // Set reservation details to the passed reservation object as fallback
      setReservationDetails(reservation);
      console.log('ReservationDrawer: Using fallback reservation data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGuestServices = async () => {
    const reservationId = reservation?.id || reservation?.reservationId || reservation?.reservation_id;
    if (!reservationId) return;
    
    setServicesLoading(true);
    try {
      console.log('ReservationDrawer: Fetching services for reservation:', reservationId);
      
      // Fetch all services (available and enabled) for this reservation
      const servicesResponse = await adminAPI.getReservationServices(reservationId);
      console.log('ReservationDrawer: Services response:', servicesResponse);
      
      if (servicesResponse.data && servicesResponse.data.data && servicesResponse.data.data.services) {
        setReservationServices(servicesResponse.data.data.services);
      }
      
      // Fetch purchased services for this reservation
      const purchasedResponse = await adminAPI.getPurchasedServices(reservationId);
      console.log('ReservationDrawer: Purchased services response:', purchasedResponse);
      
      if (purchasedResponse.data && purchasedResponse.data.data && purchasedResponse.data.data.purchased_services) {
        setPurchasedServices(purchasedResponse.data.data.purchased_services);
      }
      
    } catch (error) {
      console.error('Error fetching guest services:', error);
      // Don't show error toast for services as it's not critical
      // Set empty arrays as fallback
      setReservationServices([]);
      setPurchasedServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const handleOpenGuestPage = () => {
    if (!reservationDetails?.check_in_token) return;
    
    const guestUrl = `${window.location.origin}/guest/${reservationDetails.check_in_token}`;
    window.open(guestUrl, '_blank');
  };

  const handleAddGuestService = async (serviceType) => {
    if (!reservation?.id) return;
    
    try {
      // For now, show a placeholder message since the guest services API isn't implemented yet
      toast.success('Guest service functionality coming soon');
    } catch (error) {
      console.error('Error adding guest service:', error);
      toast.error('Failed to add service');
    }
  };

  // PaymentDrawer handlers
  const handleOpenPaymentDrawer = async (service) => {
    // Get the Stripe payment intent ID from the service
    const stripePaymentIntentId = service.stripe_payment_intent_id;
    
    if (!stripePaymentIntentId) {
      console.log('Service object:', service);
      toast.error('No payment information found for this service');
      return;
    }
    
    console.log('Looking up payment intent for Stripe ID:', stripePaymentIntentId);
    
    try {
      // Query the payment_intents table to find the matching record
      const response = await paymentAPI.getPaymentIntentByStripeId(stripePaymentIntentId);
      
      if (response.data && response.data.success && response.data.data) {
        console.log('Found payment intent record:', response.data.data);
        // Pass the payment intent record ID to PaymentDrawer
        setSelectedPaymentId(response.data.data.id);
        setShowPaymentDrawer(true);
      } else {
        console.warn('Payment intent lookup failed:', response);
        toast.error('Payment record not found in system');
      }
    } catch (error) {
      console.error('Error finding payment intent:', error);
      if (error.response?.status === 404) {
        toast.error('Payment record not found for this service');
      } else {
        toast.error('Failed to load payment details');
      }
    }
  };

  const handlePaymentDrawerClose = () => {
    setShowPaymentDrawer(false);
    setSelectedPaymentId(null);
    // Refresh services data after payment drawer closes to show any refund updates
    fetchGuestServices();
  };

  const canRefund = (service) => {
    return service.purchase_status === 'paid' && service.stripe_payment_intent_id;
  };

  const canVoid = (service) => {
    return ['pending', 'requires_payment_method', 'requires_confirmation'].includes(service.purchase_status) && service.stripe_payment_intent_id;
  };

  const formatCurrency = (amount, currency = 'JPY') => {
    if (!amount) return '0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'checked_in': return 'bg-green-100 text-green-800';
      case 'checked_out': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getRoomDisplayInfo = (details) => {
    if (!details) return { roomType: 'Standard Room', roomUnit: 'TBD' };
    
    // Handle group booking logic
    if (details.group_room_count && details.group_room_count > 1) {
      return {
        roomType: `${details.room_type_name || 'Standard Room'} (Group: ${details.group_room_count} rooms)`,
        roomUnit: details.unit_number || details.room_number || 'Multiple Units'
      };
    }
    
    return {
      roomType: details.room_type_name || details.room_name || 'Standard Room',
      roomUnit: details.unit_number || details.room_number || 'TBD'
    };
  };

  const getBookingSourceLogo = (bookingSource) => {
    if (!bookingSource) return null;
    
    const source = bookingSource.toLowerCase();
    
    if (source.includes('airbnb')) {
      return airbnbLogo;
    } else if (source.includes('booking')) {
      return bookingLogo;
    } else if (source.includes('ctrip') || source.includes('trip')) {
      return tripLogo;
    }
    
    return null;
  };

  if (!isOpen) return null;

  const details = reservationDetails || reservation;
  const roomInfo = getRoomDisplayInfo(details);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              {getBookingSourceLogo(details?.booking_source) ? (
                <div className="flex items-center">
                  <img 
                    src={getBookingSourceLogo(details.booking_source)} 
                    alt={`${details.booking_source} logo`}
                    className="h-8 w-auto"
                  />
                  
                {details?.check_in_token && (
                  <span className="ml-2 text-sm text-gray-800">
                    {details.booking_name}
                  </span>
                )}
                <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(details?.status)}`}>
                  {details?.status || 'pending'}
                </span>
                </div>
              ) : (
                <h2 className="text-xl font-semibold text-gray-900">
                  Reservation Details
                </h2>
              )}
              <div className="flex items-center space-x-3 mt-2">
                
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowMessageDrawer(true)}
                className="flex items-center px-3 py-2 text-sm  rounded-md hover:bg-primary-200 transition-colors"
                title="Open messages"
              >
                <MessageCircle className="w-6 h-6  text-gray-600" />
              </button>
              {details?.check_in_token && (
                <button
                  onClick={handleOpenGuestPage}
                  className="flex items-center px-3 py-2 text-sm  rounded-md hover:bg-primary-200 transition-colors"
                  title="Open guest page"
                >
                  <ExternalLink className="w-6 h-6 text-gray-600" />
                </button>
              )}
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
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Read-only Booking Section */}
                <section>
                  <div className="flex items-center mb-4">
                    <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">Booking Information</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Booking Source</label>
                        <p className="text-sm text-gray-900">{details?.booking_source || 'Direct'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">API Reference</label>
                        <p className="text-sm text-gray-900">{details?.apiReference || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Booking Name</label>
                        <p className="text-sm text-gray-900">{details?.booking_name || details?.guest_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Label ID (Check-in Token)</label>
                        <p className="text-sm text-gray-900 font-mono">{details?.check_in_token || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Booking Email</label>
                        <p className="text-sm text-gray-900">{details?.booking_email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Booking Phone</label>
                        <p className="text-sm text-gray-900">{details?.booking_phone || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Check-in Date</label>
                        <p className="text-sm text-gray-900">{formatDate(details?.check_in_date)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Check-out Date</label>
                        <p className="text-sm text-gray-900">{formatDate(details?.check_out_date)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Number of Guests</label>
                        <p className="text-sm text-gray-900">{details?.num_guests || 1}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Room Count</label>
                        <p className="text-sm text-gray-900">{details?.group_room_count || 1}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Guest Section */}
                <section>
                  <div className="flex items-center mb-4">
                    <User className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">Guest Information</h3>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Is Primary Guest</label>
                        <p className="text-sm text-gray-900">
                          {details?.is_primary_guest || details?.guest_number === 1 ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Guest Name</label>
                        <p className="text-sm text-gray-900">
                          {details?.guest_firstname && details?.guest_lastname 
                            ? `${details.guest_firstname} ${details.guest_lastname}`
                            : details?.guest_name || 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Guest Contact</label>
                        <p className="text-sm text-gray-900">{details?.guest_contact || details?.guest_phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Guest Email</label>
                        <p className="text-sm text-gray-900">{details?.guest_mail || details?.guest_email || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {/* Passport URL Image Preview */}
                    {details?.passport_url && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">Passport/ID Document</label>
                        <div className="relative inline-block">
                          <img 
                            src={details.passport_url} 
                            alt="Passport/ID" 
                            className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => window.open(details.passport_url, '_blank')}
                            className="absolute top-1 right-1 p-1 bg-white bg-opacity-80 rounded hover:bg-opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Room Type</label>
                        <p className="text-sm text-gray-900">{roomInfo.roomType}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Room Unit</label>
                        <p className="text-sm text-gray-900">{roomInfo.roomUnit}</p>
                      </div>
                    </div>
                    
                    {details?.access_code && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Access Code</label>
                        <p className="text-sm text-gray-900  px-2 py-1 rounded">
                          {details.access_code}
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Adults / Children</label>
                        <p className="text-sm text-gray-900">
                          {details?.num_adults || 1} adults, {details?.num_children || 0} children
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Estimated Check-in Time</label>
                        <p className="text-sm text-gray-900">{details?.estimated_checkin_time || 'Not specified'}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Check-in Status</label>
                      <div className="flex items-center space-x-2 mt-1">
                        {details?.checkin_submitted_at ? (
                          <>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Completed
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(details.checkin_submitted_at)}
                            </span>
                            {details?.admin_verified && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                Verified
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Payment Section */}
                <section>
                  <div className="flex items-center mb-4">
                    <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">Payment Information</h3>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Amount</label>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(details?.total_amount, details?.currency)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Commission</label>
                        <p className="text-sm text-gray-900">
                          {details?.commission ? formatCurrency(details.commission, details?.currency) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Guest Services/Addons */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-500">Reservation Add-ons</label>
                        <button
                          onClick={() => handleAddGuestService('accommodation_tax')}
                          className="flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          disabled={servicesLoading}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Service
                        </button>
                      </div>
                      
                      {servicesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <LoadingSpinner />
                          <span className="ml-2 text-sm text-gray-500">Loading services...</span>
                        </div>
                      ) : (
                        <>
                          {/* Purchased Services */}
                          {purchasedServices.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Purchased Services</h4>
                              <div className="space-y-2">
                                {purchasedServices.map((service, index) => {
                                  // Parse tax calculation details for accommodation tax
                                  let taxDetails = null;
                                  if (service.guest_services?.service_key === 'accommodation_tax' && service.tax_calculation_details) {
                                    try {
                                      taxDetails = typeof service.tax_calculation_details === 'string' 
                                        ? JSON.parse(service.tax_calculation_details) 
                                        : service.tax_calculation_details;
                                    } catch (e) {
                                      console.warn('Failed to parse tax calculation details:', e);
                                    }
                                  }

                                  return (
                                    <div key={service.id || index} className="p-3 bg-white rounded border border-green-200">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">
                                            {service.guest_services?.name || service.service_name || service.name || 'Unknown Service'}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-1">
                                            Status: {service.purchase_status || 'Purchased'} • 
                                            Paid: {formatCurrency(service.amount_paid || service.calculated_amount, service.currency || 'JPY')}
                                          </p>
                                          {service.purchased_at && (
                                            <p className="text-xs text-gray-400">
                                              Purchased: {formatDateTime(service.purchased_at)}
                                            </p>
                                          )}
                                          
                                          {/* Accommodation Tax Details */}
                                          {taxDetails && (
                                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                                              <p className="font-medium text-blue-900 mb-1">Tax Calculation Breakdown:</p>
                                              {taxDetails.breakdown?.taxRate && (
                                                <p className="text-blue-800">
                                                  <span className="font-medium">Rate:</span> {taxDetails.breakdown.taxRate}
                                                </p>
                                              )}
                                              {taxDetails.breakdown?.calculation && (
                                                <p className="text-blue-800">
                                                  <span className="font-medium">Base calculation:</span> {taxDetails.breakdown.calculation}
                                                </p>
                                              )}
                                              {taxDetails.breakdown?.finalCalculation && (
                                                <p className="text-blue-800">
                                                  <span className="font-medium">Final:</span> {taxDetails.breakdown.finalCalculation}
                                                </p>
                                              )}
                                              {taxDetails.numGuests && taxDetails.numNights && (
                                                <p className="text-blue-700 mt-1">
                                                  <span className="font-medium">Applied to:</span> {taxDetails.numGuests} guest(s) × {taxDetails.numNights} night(s)
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-right ml-3">
                                          <p className="text-sm font-semibold text-green-700">
                                            {formatCurrency(service.calculated_amount || service.amount_paid, service.currency || 'JPY')}
                                          </p>
                                          {service.stripe_payment_intent_id && (
                                            <p className="text-xs text-gray-400">
                                              ID: {service.stripe_payment_intent_id.substring(0, 8)}...
                                            </p>
                                          )}
                                          
                                          {/* Payment Management Button */}
                                          <div className="flex space-x-1 mt-2">
                                            {(canRefund(service) || canVoid(service)) && (
                                              <button
                                                onClick={() => handleOpenPaymentDrawer(service)}
                                                className="flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                title="View payment details"
                                              >
                                                <CreditCard className="w-3 h-3 mr-1" />
                                                View Payment
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Available Services */}
                          {reservationServices.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Available Services</h4>
                              <div className="space-y-2">
                                {reservationServices.filter(service => service.is_enabled && !service.is_purchased).map((service, index) => {
                                  // Parse tax calculation details for accommodation tax
                                  let taxDetails = null;
                                  if (service.service_key === 'accommodation_tax' && service.tax_calculation_details) {
                                    try {
                                      taxDetails = typeof service.tax_calculation_details === 'string' 
                                        ? JSON.parse(service.tax_calculation_details) 
                                        : service.tax_calculation_details;
                                    } catch (e) {
                                      console.warn('Failed to parse tax calculation details:', e);
                                    }
                                  }

                                  return (
                                    <div key={service.id || index} className="p-3 bg-blue-50 rounded border">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium text-gray-900">
                                              {service.name || service.service_name || 'Unknown Service'}
                                            </p>
                                            {/* Prominent Amount Display for Accommodation Tax */}
                                            {service.service_key === 'accommodation_tax' && (
                                              <p className="text-lg font-bold text-blue-800">
                                                {service.is_tax_exempted ? 'EXEMPTED' : formatCurrency(service.calculated_amount || service.price, service.currency || 'JPY')}
                                              </p>
                                            )}
                                          </div>
                                          
                                          {/* Enhanced Accommodation Tax Details */}
                                          {service.service_key === 'accommodation_tax' && taxDetails ? (
                                            <div className="space-y-2">
                                              {service.is_tax_exempted ? (
                                                <div className="p-2 bg-orange-50 rounded border border-orange-200">
                                                  <p className="text-sm font-medium text-orange-800">
                                                    Tax Exempted - No payment required
                                                  </p>
                                                </div>
                                              ) : (
                                                <div className="p-2 bg-white rounded border">
                                                  <p className="text-sm font-medium text-gray-900 mb-1">Tax Calculation Details:</p>
                                                  {taxDetails.breakdown?.taxRate && (
                                                    <p className="text-sm text-gray-700">
                                                      <span className="font-medium">Rate:</span> {taxDetails.breakdown.taxRate}
                                                    </p>
                                                  )}
                                                  {taxDetails.breakdown?.finalCalculation && (
                                                    <p className="text-sm text-blue-700 font-medium">
                                                      {taxDetails.breakdown.finalCalculation}
                                                    </p>
                                                  )}
                                                  {taxDetails.numGuests && taxDetails.numNights && (
                                                    <p className="text-xs text-gray-600 mt-1">
                                                      Applied to: {taxDetails.numGuests} guest(s) × {taxDetails.numNights} night(s)
                                                    </p>
                                                  )}
                                                  {taxDetails.totalReservationAmount && (
                                                    <p className="text-xs text-gray-600">
                                                      Reservation amount: {formatCurrency(taxDetails.totalReservationAmount, service.currency || 'JPY')}
                                                    </p>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <>
                                              <p className="text-xs text-gray-500 mt-1">
                                                {service.description || 'Service available for purchase'}
                                              </p>
                                              {service.enabled_at && (
                                                <p className="text-xs text-gray-400">
                                                  Enabled: {formatDateTime(service.enabled_at)}
                                                </p>
                                              )}
                                            </>
                                          )}
                                        </div>
                                        <div className="text-right ml-3">
                                          {service.service_key !== 'accommodation_tax' && (
                                            <>
                                              {service.is_tax_exempted ? (
                                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                                  Exempted
                                                </span>
                                              ) : (
                                                <>
                                                  <p className="text-sm font-semibold text-blue-700 mb-1">
                                                    {formatCurrency(service.calculated_amount || service.price, service.currency || 'JPY')}
                                                  </p>
                                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    Available
                                                  </span>
                                                </>
                                              )}
                                            </>
                                          )}
                                          {service.service_key === 'accommodation_tax' && (
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                              service.is_tax_exempted 
                                                ? 'bg-orange-100 text-orange-800' 
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                              {service.is_tax_exempted ? 'Exempted' : 'Available'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* No Services Message */}
                          {!servicesLoading && purchasedServices.length === 0 && reservationServices.length === 0 && (
                            <p className="text-sm text-gray-500 italic">No additional services</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* Additional Information */}
                {(details?.special_requests || details?.comments) && (
                  <section>
                    <div className="flex items-center mb-4">
                      <FileText className="w-5 h-5 text-gray-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
                      {details?.special_requests && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Special Requests</label>
                          <p className="text-sm text-gray-900 mt-1">{details.special_requests}</p>
                        </div>
                      )}
                      {details?.comments && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Comments</label>
                          <p className="text-sm text-gray-900 mt-1">{details.comments}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message Drawer - stacked on top */}
      <MessageDrawer
        reservation={details || reservation}
        isOpen={showMessageDrawer}
        onClose={() => setShowMessageDrawer(false)}
      />

      {/* PaymentDrawer - stacked on top */}
      <PaymentDrawer
        paymentId={selectedPaymentId}
        isOpen={showPaymentDrawer}
        onClose={handlePaymentDrawerClose}
      />
    </div>
  );
}

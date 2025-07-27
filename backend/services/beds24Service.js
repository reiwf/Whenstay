const axios = require('axios');

class Beds24Service {
  constructor() {
    this.apiKey = process.env.BEDS24_API_KEY;
    this.propKey = process.env.BEDS24_PROP_KEY;
    this.baseURL = 'https://beds24.com/api/v2';
    
    if (!this.apiKey || !this.propKey) {
      throw new Error('Missing Beds24 API credentials');
    }
  }

  // Get headers for Beds24 API requests
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'token': this.apiKey,
      'propkey': this.propKey
    };
  }

  // Fetch bookings from Beds24
  async getBookings(params = {}) {
    try {
      const defaultParams = {
        includeInvoice: false,
        includeInfoItems: true,
        checkIn: new Date().toISOString().split('T')[0], // Today's date
        ...params
      };

      const response = await axios.get(`${this.baseURL}/bookings`, {
        headers: this.getHeaders(),
        params: defaultParams
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching bookings from Beds24:', error.response?.data || error.message);
      throw new Error('Failed to fetch bookings from Beds24');
    }
  }

  // Get a specific booking by ID
  async getBooking(bookingId) {
    try {
      const response = await axios.get(`${this.baseURL}/booking/${bookingId}`, {
        headers: this.getHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching booking from Beds24:', error.response?.data || error.message);
      throw new Error('Failed to fetch booking from Beds24');
    }
  }

  // Verify webhook signature (if Beds24 provides one)
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const webhookSecret = process.env.BEDS24_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('No webhook secret configured, skipping signature verification');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Process webhook data and extract relevant booking information
  processWebhookData(webhookData) {
    try {
      // Extract booking information from webhook payload
      // This structure may vary based on Beds24's webhook format
      const booking = webhookData.booking || webhookData;
      
      return {
        beds24BookingId: booking.bookId || booking.id,
        guestName: booking.guestName || `${booking.firstName} ${booking.lastName}`, // For backward compatibility
        bookingName: booking.guestName || `${booking.firstName} ${booking.lastName}`, // New field name
        guestEmail: booking.email, // For backward compatibility
        bookingEmail: booking.email, // New field name
        guestPhone: booking.phone || booking.telephone, // New field name
        bookingPhone: booking.phone || booking.telephone, // New field name
        checkInDate: booking.arrival || booking.checkIn,
        checkOutDate: booking.departure || booking.checkOut,
        roomNumber: booking.roomId || booking.room,
        numGuests: booking.numAdult || booking.adults || 1,
        status: booking.status || 'confirmed',
        totalAmount: booking.price || booking.total,
        currency: booking.currency || 'USD'
      };
    } catch (error) {
      console.error('Error processing webhook data:', error);
      throw new Error('Invalid webhook data format');
    }
  }

  // Sync bookings (fallback method)
  async syncRecentBookings(daysBack = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Next 30 days
      
      const bookings = await this.getBookings({
        checkIn: startDate.toISOString().split('T')[0],
        checkOut: endDate.toISOString().split('T')[0]
      });

      return bookings.map(booking => this.processWebhookData({ booking }));
    } catch (error) {
      console.error('Error syncing recent bookings:', error);
      throw error;
    }
  }
}

module.exports = new Beds24Service();



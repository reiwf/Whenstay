const axios = require('axios');
const propertyService = require('./propertyService');
const roomService = require('./roomService');
const reservationService = require('./reservationService');
const { getTokyoToday } = require('./utils/dateUtils');
const { supabaseAdmin } = require('../config/supabase');

class Beds24Service {
  constructor() {
    this.propKey = process.env.BEDS24_PROPKEY;
    this.baseURL = 'https://api.beds24.com/v2';
    this.supabase = supabaseAdmin;
    
    if (!this.propKey) {
      throw new Error('Missing Beds24 PROPKEY credential');
    }
  }

  // Get stored authentication data from database
  async getStoredAuth() {
    const { data, error } = await this.supabase
      .from('beds24_auth')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('No Beds24 authentication data found in database');
    }

    return data;
  }

  // Store updated authentication data to database
  async storeAuth(authData) {
    const { error } = await this.supabase
      .from('beds24_auth')
      .upsert({
        id: 1, // Single row for auth data
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        expires_at: authData.expires_at,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing Beds24 auth data:', error);
      throw new Error('Failed to store Beds24 authentication data');
    }
  }

  // Check if access token is expiring within the next hour
  isTokenExpiring(expiresAt) {
    if (!expiresAt) return true;
    const expiryTime = new Date(expiresAt);
    const nowPlusHour = new Date(Date.now() + 6 * 60 * 60 * 1000);// 1 hour from now
    return expiryTime <= nowPlusHour;
  }

  // Refresh access token using refresh token
  async refreshAccessToken() {
    try {
      const auth = await this.getStoredAuth();
      
      if (!auth.refresh_token) {
        throw new Error('No refresh token available');
      }

      console.log('🔄 Refreshing Beds24 access token...');

      const response = await axios.post(`${this.baseURL}/authentication/token`, {
        refreshToken: auth.refresh_token
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Process the response based on the format you provided
      const newAuthData = {
        access_token: response.data.token,
        refresh_token: response.data.refreshToken, // New 30-day refresh token
        expires_at: new Date(Date.now() + (response.data.expiresIn * 1000)) // expiresIn is in seconds
      };

      // Store the new tokens
      await this.storeAuth(newAuthData);

      console.log('✅ Beds24 access token refreshed successfully', {
        expiresAt: newAuthData.expires_at,
        expiresIn: response.data.expiresIn
      });

      return newAuthData.access_token;

    } catch (error) {
      console.error('❌ Failed to refresh Beds24 access token:', {
        error: error.response?.data || error.message,
        status: error.response?.status
      });
      throw new Error(`Failed to refresh Beds24 access token: ${error.message}`);
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken() {
    try {
      const auth = await this.getStoredAuth();

      // Check if we have an access token and it's not expiring soon
      if (auth.access_token && !this.isTokenExpiring(auth.expires_at)) {
        return auth.access_token;
      }

      // Token is missing or expiring, refresh it
      console.log('🔄 Access token missing or expiring, refreshing...');
      return await this.refreshAccessToken();

    } catch (error) {
      console.error('Error getting valid access token:', error);
      throw error;
    }
  }

  // Get headers for Beds24 API requests with valid access token
  async getHeaders() {
    const accessToken = await this.getValidAccessToken();
    
    return {
      'Content-Type': 'application/json',
      'token': accessToken, // Now uses access token instead of refresh token
      'propkey': this.propKey
    };
  }

  // Fetch bookings from Beds24
  async getBookings(params = {}) {
    try {
      const defaultParams = {
        includeInvoice: false,
        includeInfoItems: true,
        checkIn: getTokyoToday(),
        ...params
      };

      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/bookings`, {
        headers: headers,
        params: defaultParams
      });

      return response.data;
    } catch (error) {
      // Handle authentication errors by attempting token refresh
      if (error.response?.status === 401 || error.response?.status === 403) {
        try {
          console.log('🔄 Authentication failed, attempting token refresh...');
          await this.refreshAccessToken();
          
          // Retry the request with new token
          const headers = await this.getHeaders();
          const response = await axios.get(`${this.baseURL}/bookings`, {
            headers: headers,
            params: defaultParams
          });

          return response.data;
        } catch (retryError) {
          console.error('Failed to retry after token refresh:', retryError);
          throw retryError;
        }
      }

      console.error('Error fetching bookings from Beds24:', error.response?.data || error.message);
      throw new Error('Failed to fetch bookings from Beds24');
    }
  }

  // Get a specific booking by ID
  async getBooking(bookingId) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/booking/${bookingId}`, {
        headers: headers
      });

      return response.data;
    } catch (error) {
      // Handle authentication errors by attempting token refresh
      if (error.response?.status === 401 || error.response?.status === 403) {
        try {
          console.log('🔄 Authentication failed, attempting token refresh...');
          await this.refreshAccessToken();
          
          // Retry the request with new token
          const headers = await this.getHeaders();
          const response = await axios.get(`${this.baseURL}/booking/${bookingId}`, {
            headers: headers
          });

          return response.data;
        } catch (retryError) {
          console.error('Failed to retry after token refresh:', retryError);
          throw retryError;
        }
      }

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

  // Map Beds24 booking status to our internal status
  mapBeds24Status(beds24Status) {
    const statusMap = {
      'new': 'new',
      'confirmed': 'confirmed',
      'cancelled': 'cancelled',
      'modified': 'confirmed'
    };
    
    return statusMap[beds24Status] || 'new';
  }

  // Detect currency from price context or country
  detectCurrency(booking) {
    if (booking.country === 'jp' || booking.country === 'JP') {
      return 'JPY';
    }
    return booking.currency || 'JPY';
  }

  // Find or create property by Beds24 property ID
  async findOrCreateProperty(beds24PropertyId) {
    try {
      // First try to find existing property
      const existingProperty = await propertyService.findPropertyByBeds24Id(beds24PropertyId);
      if (existingProperty) {
        return existingProperty.id;
      }

      // Create placeholder property
      console.log(`Creating placeholder property for Beds24 ID: ${beds24PropertyId}`);
      const propertyData = {
        name: `Beds24 Property ${beds24PropertyId}`,
        address: 'Address to be updated',
        description: 'Property imported from Beds24 - requires setup',
        propertyType: 'apartment',
        beds24PropertyId: beds24PropertyId,
        isActive: true
      };

      const newProperty = await propertyService.createProperty(propertyData);
      return newProperty.id;
    } catch (error) {
      console.error('Error finding or creating property:', error);
      throw new Error(`Failed to resolve property for Beds24 ID: ${beds24PropertyId}`);
    }
  }

  // Find or create room type by Beds24 room type ID
  async findOrCreateRoomType(beds24RoomTypeId, propertyId) {
    try {
      // First try to find existing room type
      const existingRoomType = await roomService.findRoomTypeByBeds24Id(beds24RoomTypeId);
      if (existingRoomType) {
        return existingRoomType.id;
      }

      // Create placeholder room type
      console.log(`Creating placeholder room type for Beds24 ID: ${beds24RoomTypeId}`);
      const roomTypeData = {
        name: `Beds24 Room Type ${beds24RoomTypeId}`,
        description: 'Room type imported from Beds24 - requires setup',
        maxGuests: 2,
        basePrice: 0,
        currency: 'JPY',
        beds24RoomTypeId: beds24RoomTypeId
      };

      const newRoomType = await roomService.createRoomType(propertyId, roomTypeData);
      return newRoomType.id;
    } catch (error) {
      console.error('Error finding or creating room type:', error);
      throw new Error(`Failed to resolve room type for Beds24 ID: ${beds24RoomTypeId}`);
    }
  }

  // Find or create room unit by Beds24 unit ID
  async findOrCreateRoomUnit(beds24UnitId, roomTypeId) {
    try {
      // First try to find existing room unit by both room type and Beds24 unit ID
      const existingRoomUnit = await roomService.findRoomUnitByRoomTypeAndBeds24Id(roomTypeId, beds24UnitId);
      if (existingRoomUnit) {
        console.log(`Found existing room unit for Room Type: ${roomTypeId}, Beds24 Unit ID: ${beds24UnitId}`);
        return existingRoomUnit.id;
      }

      // If not found, create a new room unit
      console.log(`Creating placeholder room unit for Beds24 ID: ${beds24UnitId}`);
      try {
        const roomUnit = await roomService.createRoomUnit(roomTypeId, {
          unitNumber: `Unit ${beds24UnitId}`,
          beds24UnitId: beds24UnitId,
          accessCode: 'TBD',
          accessInstructions: `Access instructions for unit ${beds24UnitId} - to be updated by property manager`
        });

        return roomUnit.id;
      } catch (createError) {
        // If creation fails due to duplicate key constraint, try to find the existing one
        if (createError.message.includes('duplicate key') || createError.message.includes('already exists')) {
          console.log(`Room unit already exists, searching for existing room unit with unit number: Unit ${beds24UnitId}`);
          
          try {
            // Try to find room unit by Beds24 unit ID directly
            const existingUnit = await roomService.findRoomUnitByBeds24Id(beds24UnitId);
            if (existingUnit) {
              console.log(`Found existing room unit by beds24_unit_id: ${existingUnit.id}`);
              return existingUnit.id;
            }
          } catch (searchError) {
            console.error('Error searching for existing room unit:', searchError);
          }
        }
        
        throw createError;
      }
    } catch (error) {
      console.error('Error finding or creating room unit:', error);
      throw new Error(`Failed to resolve room unit for Beds24 ID: ${beds24UnitId}`);
    }
  }

  // Enhanced webhook data processing with complete field mapping
  async processWebhookData(webhookData) {
    try {
      // Extract booking information from webhook payload
      const booking = webhookData.booking || webhookData;
      const body = webhookData.body || webhookData;
      
      if (!booking) {
        throw new Error('No booking data found in webhook payload');
      }

      console.log('Processing Beds24 booking:', {
        id: booking.id,
        propertyId: booking.propertyId,
        roomId: booking.roomId,
        unitId: booking.unitId,
        firstName: booking.firstName,
        lastName: booking.lastName
      });

      // Resolve property and room mappings
      let propertyId = null;
      let roomTypeId = null;
      let roomUnitId = null;

      if (booking.propertyId) {
        propertyId = await this.findOrCreateProperty(booking.propertyId);
      }

      if (booking.roomId && propertyId) {
        roomTypeId = await this.findOrCreateRoomType(booking.roomId, propertyId);
      }

      if (booking.unitId && roomTypeId) {
        roomUnitId = await this.findOrCreateRoomUnit(booking.unitId, roomTypeId);
      }

      // Build comprehensive reservation data
      const reservationData = {
        // Core booking identification
        beds24BookingId: booking.id?.toString(),
        
        // Guest information (updated mapping)
        bookingName: booking.firstName || '', // As requested
        bookingLastname: booking.lastName || '',
        bookingEmail: booking.email || '',
        bookingPhone: booking.phone || booking.mobile || '',
        
        // Date and guest details
        checkInDate: booking.arrival,
        checkOutDate: booking.departure,
        numAdults: booking.numAdult || 1,
        numChildren: booking.numChild || 0,
        numGuests: (booking.numAdult || 1) + (booking.numChild || 0),
        
        // Financial information
        totalAmount: booking.price || 0,
        currency: this.detectCurrency(booking),
        commission: booking.commission || 0,
        
        // Property and room assignments
        propertyId: propertyId,
        roomTypeId: roomTypeId,
        roomUnitId: roomUnitId,
        
        // Booking source and metadata
        bookingSource: booking.referer || booking.channel || 'Beds24',
        status: this.mapBeds24Status(booking.status),
        
        // Additional Beds24 specific fields
        apiReference: booking.apiReference || '',
        rateDescription: booking.rateDescription || '',
        apiMessage: booking.apiMessage || '',
        bookingTime: booking.bookingTime || null,
        timeStamp: body.timeStamp || webhookData.timeStamp || null,
        lang: booking.lang || '',
        comments: booking.comments || booking.notes || '',
        price: booking.price || 0,
        
        // Special requests and notes
        specialRequests: booking.message || booking.notes || booking.comments || null,
        
        // Legacy compatibility fields
        guestName: `${booking.firstName || ''} ${booking.lastName || ''}`.trim(),
        guestEmail: booking.email || '',
        guestPhone: booking.phone || booking.mobile || '',
        roomNumber: booking.unitId || booking.roomId || null
      };

      // Validate required fields
      if (!reservationData.beds24BookingId) {
        throw new Error('Missing booking ID in webhook data');
      }

      if (!reservationData.checkInDate || !reservationData.checkOutDate) {
        throw new Error('Missing check-in or check-out date in webhook data');
      }

      console.log('Processed reservation data:', {
        beds24BookingId: reservationData.beds24BookingId,
        bookingName: reservationData.bookingName,
        bookingLastname: reservationData.bookingLastname,
        propertyId: reservationData.propertyId,
        roomTypeId: reservationData.roomTypeId,
        roomUnitId: reservationData.roomUnitId,
        checkInDate: reservationData.checkInDate,
        checkOutDate: reservationData.checkOutDate
      });

      return reservationData;
    } catch (error) {
      console.error('Error processing webhook data:', error);
      throw new Error(`Invalid webhook data format: ${error.message}`);
    }
  }


  // message through Beds24 API to Airbnb -- This is working 
async sendMessage(beds24BookingId, content, options = {}) {
  // 1) Validate input early
  const text = (content ?? '').toString().trim();
  if (!text) {
    throw new Error('Bad request: message cannot be empty');
  }

  try {
    const headers = await this.getHeaders(); // { token, propkey, Content-Type }
    if (options.messageId) headers['X-Idempotency-Key'] = options.messageId;

    const url = `${this.baseURL}/bookings/messages`;

    // 2) MUST be an array, and MUST use `message` key
    const body = [
      {
        bookingId: beds24BookingId,
        message: text,          // <-- key change fixes "no message"
        // externalId: options.messageId, // optional if Beds24 supports idempotency by item
      }
    ];

    const res = await axios.post(url, body, { headers });

    const results = Array.isArray(res.data) ? res.data : [res.data];
    console.log('Beds24 raw results:\n', JSON.stringify(results, null, 2));
    const first = results[0] ?? {};

    if (first.success !== true) {
      const errs = (first.errors || []).map(e => (typeof e === 'string' ? e : e?.message || JSON.stringify(e)));
      const msg = errs.length ? errs.join('; ') : 'Unknown Beds24 messaging error';
      console.error('Beds24 messaging failed:', { bookingId: beds24BookingId, messageId: options.messageId, results });
      const err = new Error(`Beds24 rejected message: ${msg}`);
      err.code = 'UPSTREAM_REJECTED';
      err.details = results;
      throw err;
    }

    console.log('Message sent successfully via Beds24:', {
      bookingId: beds24BookingId,
      messageId: options.messageId,
      response: results
    });

    return {
      success: true,
      beds24MessageId: first.messageId || first.id,
      data: results
    };

  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🔄 Authentication failed when sending message, attempting token refresh...');
      await this.refreshAccessToken();
      return this.sendMessage(beds24BookingId, text, options);
    }

    console.error('Error sending message via Beds24:', {
      bookingId: beds24BookingId,
      error: error.response?.data || error.message,
      status: error.response?.status,
      headers: error.response?.headers,
      url: error.config?.url
    });

    const status = error.response?.status;
    const responseData = error.response?.data;
    let errorMessage = 'Failed to send message via Beds24';

    if (status === 400) errorMessage = `Bad request: ${responseData?.message || responseData?.error || 'Invalid message data'}`;
    else if (status === 401) errorMessage = `401 Unauthorized: ${responseData?.message || 'Authentication failed - token may be invalid'}`;
    else if (status === 403) errorMessage = `403 Not authorized to send messages for this booking: ${responseData?.message || 'Insufficient permissions'}`;
    else if (status === 404) errorMessage = `Booking not found in Beds24: ${responseData?.message || 'Invalid bookingId'}`;
    else if (status === 429) errorMessage = `429 Rate limit exceeded, please try again later: ${responseData?.message || 'Too many requests'}`;
    else if (status >= 500 && status < 600) errorMessage = `${status} Beds24 server error: ${responseData?.message || responseData?.error || 'Could not process request'}`;
    else if (responseData?.message) errorMessage = `${status || 'Unknown'} API Error: ${responseData.message}`;
    else if (responseData?.error) errorMessage = `${status || 'Unknown'} API Error: ${responseData.error}`;
    else if (error.code === 'UPSTREAM_REJECTED') errorMessage = `Bad request: ${error.message.replace(/^Beds24 rejected message:\s*/, '')}`;

    throw new Error(errorMessage);
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
          checkIn: startDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }),
          checkOut: endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
        });

        return bookings.map(booking => this.processWebhookData({ booking }));
      } catch (error) {
        console.error('Error syncing recent bookings:', error);
        throw error;
      }
    }
  }

module.exports = new Beds24Service();

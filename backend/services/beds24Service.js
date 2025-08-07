const axios = require('axios');
const databaseService = require('./databaseService');

class Beds24Service {
  constructor() {
    this.apiKey = process.env.BEDS24_REFRESH_TOKEN;
    this.propKey = process.env.BEDS24_REFRESH_TOKEN;
    this.baseURL = 'https://api.beds24.com/v2';
    
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

  // Map Beds24 booking status to our internal status
  mapBeds24Status(beds24Status) {
    const statusMap = {
      'new': 'pending',
      'confirmed': 'confirmed',
      'cancelled': 'cancelled',
      'modified': 'confirmed'
    };
    
    return statusMap[beds24Status] || 'pending';
  }

  // Detect currency from price context or country
  detectCurrency(booking) {
    // Default to JPY for Japanese properties, USD otherwise
    if (booking.country === 'jp' || booking.country === 'JP') {
      return 'JPY';
    }
    return booking.currency || 'USD';
  }

  // Find or create property by Beds24 property ID
  async findOrCreateProperty(beds24PropertyId) {
    try {
      // First try to find existing property
      const existingProperty = await databaseService.findPropertyByBeds24Id(beds24PropertyId);
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

      const newProperty = await databaseService.createProperty(propertyData);
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
      const existingRoomType = await databaseService.findRoomTypeByBeds24Id(beds24RoomTypeId);
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
        currency: 'USD',
        beds24RoomTypeId: beds24RoomTypeId
      };

      const newRoomType = await databaseService.createRoomType(propertyId, roomTypeData);
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
      const existingRoomUnit = await databaseService.findRoomUnitByRoomTypeAndBeds24Id(roomTypeId, beds24UnitId);
      if (existingRoomUnit) {
        console.log(`Found existing room unit for Room Type: ${roomTypeId}, Beds24 Unit ID: ${beds24UnitId}`);
        return existingRoomUnit.id;
      }

      // If not found, create a new room unit
      console.log(`Creating placeholder room unit for Beds24 ID: ${beds24UnitId}`);
      try {
        const roomUnit = await databaseService.createRoomUnit(roomTypeId, {
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
            // Try to find room unit by room type and unit number using databaseService
            const { data: existingUnits, error } = await databaseService.supabaseAdmin
              .from('room_units')
              .select('id')
              .eq('room_type_id', roomTypeId)
              .eq('unit_number', `Unit ${beds24UnitId}`);
            
            if (error) {
              console.error('Error finding existing room unit:', error);
            } else if (existingUnits && existingUnits.length > 0) {
              console.log(`Found existing room unit by type and number: ${existingUnits[0].id}`);
              return existingUnits[0].id;
            }
            
            // If still not found, try a more general search for any room unit with this beds24UnitId
            const allRoomUnits = await databaseService.getAllRoomUnits();
            for (const unit of allRoomUnits) {
              if (unit.beds24_unit_id === beds24UnitId) {
                console.log(`Found existing room unit by beds24_unit_id: ${unit.id}`);
                return unit.id;
              }
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

require('dotenv').config();
// syncBookings.js
const beds24Service = require('./services/beds24Service');
const reservationService = require('./services/reservationService');

async function syncBookings() {
  // 1. Pull bookings from Beds24
  const { bookings } = await beds24Service.getBookings({
    checkIn: '2025-08-15',   // adjust filters as needed
    includeInfoItems: true
  });

  // 2. Convert each Beds24 booking to our reservation format
  for (const booking of bookings) {
    const reservationData = await beds24Service.processWebhookData({ booking });

    // 3. Store in database
    await reservationService.createReservation(reservationData);
    console.log(`Saved booking ${reservationData.beds24BookingId}`);
  }
}

syncBookings().catch(err => console.error('Sync failed:', err));

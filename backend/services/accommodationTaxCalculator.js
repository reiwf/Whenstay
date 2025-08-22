class AccommodationTaxCalculator {
  /**
   * Calculate accommodation tax based on Japanese local tax rates
   * @param {number} totalAmount - Total reservation amount in JPY
   * @param {number} numGuests - Number of guests
   * @param {number} numNights - Number of nights
   * @returns {object} Tax calculation details
   */
  calculateTaxAmount(totalAmount, numGuests, numNights) {
    try {
      // Calculate rate per person per night
      const ratePerPersonPerNight = totalAmount / numGuests / numNights;
      
      // Determine tax tier and rate
      let taxPerPersonPerNight = 0;
      let taxTier = 'no_tax';
      
      if (ratePerPersonPerNight < 5000) {
        taxPerPersonPerNight = 0;
        taxTier = 'no_tax';
      } else if (ratePerPersonPerNight < 15000) {
        taxPerPersonPerNight = 200;
        taxTier = 'tier_1';
      } else if (ratePerPersonPerNight < 20000) {
        taxPerPersonPerNight = 400;
        taxTier = 'tier_2';
      } else {
        taxPerPersonPerNight = 500;
        taxTier = 'tier_3';
      }
      
      // Calculate total tax amount
      const totalTaxAmount = taxPerPersonPerNight * numGuests * numNights;
      
      // Create detailed breakdown for transparency
      const calculationDetails = {
        totalReservationAmount: totalAmount,
        numGuests: numGuests,
        numNights: numNights,
        ratePerPersonPerNight: Math.round(ratePerPersonPerNight),
        taxTier: taxTier,
        taxPerPersonPerNight: taxPerPersonPerNight,
        totalTaxAmount: totalTaxAmount,
        breakdown: {
          calculation: `¥${totalAmount} ÷ ${numGuests} guests ÷ ${numNights} nights = ¥${Math.round(ratePerPersonPerNight)} per person per night`,
          taxRate: this.getTaxTierDescription(taxTier, taxPerPersonPerNight),
          finalCalculation: totalTaxAmount > 0 ? 
            `¥${taxPerPersonPerNight} × ${numGuests} guests × ${numNights} nights = ¥${totalTaxAmount}` : 
            'No tax applicable'
        },
        calculatedAt: new Date().toISOString()
      };
      
      return {
        amount: totalTaxAmount,
        details: calculationDetails,
        isExempt: totalTaxAmount === 0
      };
      
    } catch (error) {
      console.error('Error calculating accommodation tax:', error);
      throw new Error(`Tax calculation failed: ${error.message}`);
    }
  }
  
  /**
   * Get human-readable description of tax tier
   * @param {string} taxTier 
   * @param {number} taxRate 
   * @returns {string}
   */
  getTaxTierDescription(taxTier, taxRate) {
    switch (taxTier) {
      case 'no_tax':
        return 'No tax (rate under ¥5,000 per person per night)';
      case 'tier_1':
        return `¥${taxRate} per person per night (rate ¥5,000-¥15,000)`;
      case 'tier_2':
        return `¥${taxRate} per person per night (rate ¥15,000-¥20,000)`;
      case 'tier_3':
        return `¥${taxRate} per person per night (rate ¥20,000 or more)`;
      default:
        return 'Tax calculation error';
    }
  }
  
  /**
   * Validate tax calculation inputs
   * @param {number} totalAmount 
   * @param {number} numGuests 
   * @param {number} numNights 
   * @returns {boolean}
   */
  validateInputs(totalAmount, numGuests, numNights) {
    return (
      typeof totalAmount === 'number' && totalAmount >= 0 &&
      typeof numGuests === 'number' && numGuests > 0 &&
      typeof numNights === 'number' && numNights > 0
    );
  }
  
  /**
   * Calculate tax for a specific reservation
   * @param {object} reservation - Reservation object with total_amount, num_guests, check_in_date, check_out_date
   * @returns {object} Tax calculation result
   */
  calculateForReservation(reservation) {
    try {
      if (!reservation.total_amount || !reservation.num_guests) {
        throw new Error('Missing required reservation data for tax calculation');
      }
      
      // Calculate number of nights
      const checkInDate = new Date(reservation.check_in_date);
      const checkOutDate = new Date(reservation.check_out_date);
      const numNights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      if (!this.validateInputs(reservation.total_amount, reservation.num_guests, numNights)) {
        throw new Error('Invalid reservation data for tax calculation');
      }
      
      return this.calculateTaxAmount(reservation.total_amount, reservation.num_guests, numNights);
      
    } catch (error) {
      console.error('Error calculating tax for reservation:', error);
      throw new Error(`Failed to calculate tax for reservation: ${error.message}`);
    }
  }
}

module.exports = new AccommodationTaxCalculator();

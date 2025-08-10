const reservationService = require('./reservationService');
const propertyService = require('./propertyService');
const roomService = require('./roomService');
const userService = require('./userService');

module.exports = {
  ...reservationService,
  ...propertyService,
  ...roomService,
  ...userService,
};
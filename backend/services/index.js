const reservationsService = require('./reservationsService');
const propertiesService = require('./propertiesService');
const usersService = require('./usersService');

function bindAll(service) {
  const bound = {};
  for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(service))) {
    if (key !== 'constructor') {
      bound[key] = service[key].bind(service);
    }
  }
  return bound;
}

module.exports = {
  ...bindAll(reservationsService),
  ...bindAll(propertiesService),
  ...bindAll(usersService)
};

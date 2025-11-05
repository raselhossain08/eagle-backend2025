/**
 * Payment Controllers Index
 * Exports all payment controller functions
 */

const paypalExecute = require('./paypalExecute');
const paypalPayment = require('./paypalPayment');
const stripePayment = require('./stripePayment');

module.exports = {
  paypalExecute,
  paypalPayment,
  stripePayment
};
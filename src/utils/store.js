/**
 * Simple in-memory store for payments and refunds.
 *
 * In production this would be backed by a database; the in-memory map is
 * sufficient for the current simulated / stub implementation.
 */

/** @type {Map<string, object>} payment_id -> payment object */
const payments = new Map();

/** @type {Map<string, object[]>} payment_id -> array of refund objects */
const refunds = new Map();

function savePayment(payment) {
  payments.set(payment.id, payment);
}

function getPayment(paymentId) {
  return payments.get(paymentId) || null;
}

function saveRefund(refund) {
  const list = refunds.get(refund.payment_id) || [];
  list.push(refund);
  refunds.set(refund.payment_id, list);
}

function getRefunds(paymentId) {
  return refunds.get(paymentId) || [];
}

/**
 * Reset all data — useful for tests.
 */
function clearAll() {
  payments.clear();
  refunds.clear();
}

module.exports = { savePayment, getPayment, saveRefund, getRefunds, clearAll };

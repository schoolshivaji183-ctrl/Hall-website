const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/bookingController');
const PaymentController = require('../controllers/paymentController');

// REST API Endpoints for Booking Management & Lifecycle
router.get('/stats', BookingController.getStats);
router.get('/availability', BookingController.getAvailability);
router.get('/bookings', BookingController.getAllBookings);
router.get('/bookings/:id', BookingController.getBookingById);
router.post('/bookings', BookingController.createBooking);
router.put('/bookings/:id', BookingController.updateBooking);

// Financial Contract Updates
router.post('/bookings/:id/extra-charges', BookingController.addExtraCharge);
router.delete('/bookings/:id/extra-charges/:chargeId', BookingController.revertExtraCharge);
router.post('/bookings/:id/discounts', BookingController.addDiscount);
router.delete('/bookings/:id/discounts/:discountId', BookingController.revertDiscount);

// Lifecycle Actions
router.patch('/bookings/:id/archive', BookingController.archiveBooking);
router.patch('/bookings/:id/unarchive', BookingController.unarchiveBooking);
router.patch('/bookings/:id/cancel', BookingController.cancelBooking);
router.patch('/bookings/:id/uncancel', BookingController.uncancelBooking);
router.delete('/bookings/:id', BookingController.deleteBooking);

// REST API Endpoints for Payment Management & Financial Ledger
router.get('/payments/stats', PaymentController.getFinancialStats);
router.get('/payments', PaymentController.getAllPayments);
router.get('/payments/booking/:bookingId', PaymentController.getBookingSummary);
router.get('/payments/receipt/:receiptNumber', PaymentController.getReceiptDetails);
router.post('/payments', PaymentController.createPayment);
router.patch('/payments/:receiptNumber/void', PaymentController.voidPayment);
router.post('/payments/deposit-action', PaymentController.manageDeposit);
// Audit Trail Endpoints
router.get('/audit', BookingController.getAuditLogs);

module.exports = router;

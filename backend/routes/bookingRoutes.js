const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/bookingController');
const PaymentController = require('../controllers/paymentController');
const AuthController = require('../controllers/authController');
const FacultyController = require('../controllers/facultyController');
const authMiddleware = require('../utils/authMiddleware');

// =========================================================================
// 1. AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// =========================================================================
router.post('/auth/login', AuthController.login);
router.get('/auth/me', authMiddleware.attachUser, AuthController.getMe);
router.post('/auth/logout', AuthController.logout);
router.get('/users', authMiddleware.requireRole(['Admin']), AuthController.getUsers);
router.post('/users', authMiddleware.requireRole(['Admin']), AuthController.createUser);

// =========================================================================
// 2. STAFF OPERATIONAL ENDPOINTS (ZERO FINANCIAL FIGURES)
// =========================================================================
router.get('/staff/events', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.getEvents);
router.get('/staff/events/:id', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.getEventById);
router.patch('/staff/events/:id/requirements', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.updateRequirements);
router.post('/staff/events/:id/mark-prepared', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.markPrepared);
router.post('/staff/events/:id/acknowledge', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.acknowledgeTask);

// Backward Compatibility Aliases for Faculty endpoints
router.get('/faculty/events', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.getEvents);
router.get('/faculty/events/:id', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.getEventById);
router.patch('/faculty/events/:id/requirements', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.updateRequirements);
router.post('/faculty/events/:id/mark-prepared', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.markPrepared);
router.post('/faculty/events/:id/acknowledge', authMiddleware.requireRole(['Admin', 'Staff']), FacultyController.acknowledgeTask);

// =========================================================================
// 3. SCHEDULE & AVAILABILITY ENDPOINTS
// =========================================================================
router.get('/halls', BookingController.getAllHalls);
router.patch('/halls/:id/status', authMiddleware.requireRole(['Admin']), BookingController.updateHallStatus);
router.get('/availability', BookingController.getAvailability);
router.get('/stats/day-slots', BookingController.getDaySlots);
router.get('/day-slots', BookingController.getDaySlots);

// =========================================================================
// 4. ADMIN DASHBOARD & BOOKING MANAGEMENT CRUD (ADMIN ONLY FOR MUTATIONS)
// =========================================================================
router.get('/stats', BookingController.getStats);
router.get('/stats/yearly', authMiddleware.requireRole(['Admin']), BookingController.getYearlyStats);
router.get('/yearly-stats', authMiddleware.requireRole(['Admin']), BookingController.getYearlyStats);
router.get('/bookings', BookingController.getAllBookings);
router.get('/bookings/:id', BookingController.getBookingById);
router.post('/bookings', authMiddleware.requireRole(['Admin']), BookingController.createBooking);
router.put('/bookings/:id', authMiddleware.requireRole(['Admin']), BookingController.updateBooking);
router.delete('/bookings/:id', authMiddleware.requireRole(['Admin']), BookingController.deleteBooking);

// Financial Contract Updates (Admin Only)
router.post('/bookings/:id/extra-charges', authMiddleware.requireRole(['Admin']), BookingController.addExtraCharge);
router.delete('/bookings/:id/extra-charges/:chargeId', authMiddleware.requireRole(['Admin']), BookingController.revertExtraCharge);
router.post('/bookings/:id/discounts', authMiddleware.requireRole(['Admin']), BookingController.addDiscount);
router.delete('/bookings/:id/discounts/:discountId', authMiddleware.requireRole(['Admin']), BookingController.revertDiscount);

// Lifecycle Actions (Admin Only)
router.patch('/bookings/:id/archive', authMiddleware.requireRole(['Admin']), BookingController.archiveBooking);
router.patch('/bookings/:id/unarchive', authMiddleware.requireRole(['Admin']), BookingController.unarchiveBooking);
router.patch('/bookings/:id/cancel', authMiddleware.requireRole(['Admin']), BookingController.cancelBooking);
router.patch('/bookings/:id/uncancel', authMiddleware.requireRole(['Admin']), BookingController.uncancelBooking);

// =========================================================================
// 5. PAYMENT MANAGEMENT & FINANCIAL LEDGER (ADMIN ONLY)
// =========================================================================
router.get('/payments/stats', authMiddleware.requireRole(['Admin']), PaymentController.getFinancialStats);
router.get('/payments', authMiddleware.requireRole(['Admin']), PaymentController.getAllPayments);
router.get('/payments/booking/:bookingId', authMiddleware.requireRole(['Admin']), PaymentController.getBookingSummary);
router.get('/payments/receipt/:receiptNumber', authMiddleware.requireRole(['Admin']), PaymentController.getReceiptDetails);
router.post('/payments', authMiddleware.requireRole(['Admin']), PaymentController.createPayment);
router.patch('/payments/:receiptNumber/void', authMiddleware.requireRole(['Admin']), PaymentController.voidPayment);
router.post('/payments/deposit-action', authMiddleware.requireRole(['Admin']), PaymentController.manageDeposit);

// =========================================================================
// 6. AUDIT TRAIL ENDPOINTS
// =========================================================================
router.get('/audit', BookingController.getAuditLogs);

module.exports = router;

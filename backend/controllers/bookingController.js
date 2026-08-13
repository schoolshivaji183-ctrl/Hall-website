const BookingModel = require('../models/bookingModel');
const PaymentModel = require('../models/paymentModel');
const AuditModel = require('../models/auditModel');
const BookingValidator = require('../utils/bookingValidator');

/**
 * Controller handling Booking API requests & business validations
 */
class BookingController {
    /**
     * GET /api/bookings
     */
    static getAllBookings(req, res) {
        try {
            const { search, date, hall, status } = req.query;
            let bookings = BookingModel.findAll({ search, date, hall, status });

            // Attach financial summary to each booking
            const enrichedBookings = bookings.map(b => {
                const financial = PaymentModel.getBookingFinancialSummary(b.id);
                return {
                    ...b,
                    financial
                };
            });

            return res.status(200).json({
                success: true,
                count: enrichedBookings.length,
                data: enrichedBookings
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Server error retrieving bookings.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/bookings/:id
     */
    static getBookingById(req, res) {
        try {
            const booking = BookingModel.findById(req.params.id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            const financial = PaymentModel.getBookingFinancialSummary(booking.id);
            const auditLogs = AuditModel.findByBookingId(booking.id);

            return res.status(200).json({
                success: true,
                data: {
                    ...booking,
                    financial,
                    auditLogs
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching booking details.',
                error: error.message
            });
        }
    }

    /**
     * POST /api/bookings
     */
    static createBooking(req, res) {
        try {
            const { customerName, mobileNumber, eventName, hall, bookingDate, startTime, endTime, status, notes, hallRent, discount, extraCharges, securityDeposit, createdBy } = req.body;

            // Validation of required fields
            if (!customerName || !mobileNumber || !eventName || !hall || !bookingDate || !startTime || !endTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Please fill in all required fields.'
                });
            }

            // CRITICAL BOOKING VALIDATION ENGINE CHECK
            const allBookings = BookingModel.findAll();
            const validation = BookingValidator.validateSlot({
                hall,
                bookingDate,
                startTime,
                endTime,
                status: status || 'Confirmed',
                excludeId: null,
                existingBookings: allBookings
            });

            if (!validation.isValid) {
                return res.status(409).json({
                    success: false,
                    message: validation.message,
                    conflictingBooking: validation.conflictingBooking
                });
            }

            // Save booking
            const newBooking = BookingModel.create({
                customerName,
                mobileNumber,
                eventName,
                hall,
                bookingDate,
                startTime,
                endTime,
                status: status || 'Confirmed',
                notes,
                hallRent,
                discount,
                extraCharges,
                securityDeposit,
                createdBy: createdBy || 'Admin'
            });

            const enriched = {
                ...newBooking,
                financial: PaymentModel.getBookingFinancialSummary(newBooking.id)
            };

            return res.status(201).json({
                success: true,
                message: `Booking (${newBooking.id}) created successfully in ${newBooking.status} state!`,
                data: enriched
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create booking.',
                error: error.message
            });
        }
    }

    /**
     * PUT /api/bookings/:id
     */
    static updateBooking(req, res) {
        try {
            const { id } = req.params;
            const existing = BookingModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            const { customerName, mobileNumber, eventName, hall, bookingDate, startTime, endTime, status, notes, hallRent, discount, extraCharges, securityDeposit, updatedBy } = req.body;

            const targetHall = hall || existing.hall;
            const targetDate = bookingDate || existing.bookingDate;
            const targetStart = startTime || existing.startTime;
            const targetEnd = endTime || existing.endTime;
            const targetStatus = status || existing.status;

            // VALIDATION ENGINE CHECK EXCLUDING CURRENT BOOKING ID
            const allBookings = BookingModel.findAll();
            const validation = BookingValidator.validateSlot({
                hall: targetHall,
                bookingDate: targetDate,
                startTime: targetStart,
                endTime: targetEnd,
                status: targetStatus,
                excludeId: id,
                existingBookings: allBookings
            });

            if (!validation.isValid) {
                return res.status(409).json({
                    success: false,
                    message: validation.message,
                    conflictingBooking: validation.conflictingBooking
                });
            }

            const updated = BookingModel.update(id, {
                customerName,
                mobileNumber,
                eventName,
                hall: targetHall,
                bookingDate: targetDate,
                startTime: targetStart,
                endTime: targetEnd,
                status: targetStatus,
                notes,
                hallRent,
                discount,
                extraCharges,
                securityDeposit,
                updatedBy: updatedBy || 'Admin'
            });

            const enriched = {
                ...updated,
                financial: PaymentModel.getBookingFinancialSummary(id)
            };

            return res.status(200).json({
                success: true,
                message: 'Booking details updated successfully!',
                data: enriched
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update booking.',
                error: error.message
            });
        }
    }

    /**
     * POST /api/bookings/:id/extra-charges
     */
    static addExtraCharge(req, res) {
        try {
            const { id } = req.params;
            const { category, amount, remarks, addedBy } = req.body;

            if (!amount || Number(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid charge amount is required.'
                });
            }

            const chargeItem = BookingModel.addExtraCharge(id, {
                category: category || 'Other Charge',
                amount,
                remarks,
                addedBy: addedBy || 'Admin'
            });

            const summary = PaymentModel.getBookingFinancialSummary(id);

            return res.status(201).json({
                success: true,
                message: `Extra charge of ₹${Number(amount).toLocaleString()} added successfully. Dues updated!`,
                data: {
                    charge: chargeItem,
                    summary
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to add extra charge.'
            });
        }
    }

    /**
     * POST /api/bookings/:id/discounts
     */
    static addDiscount(req, res) {
        try {
            const { id } = req.params;
            const { amount, reason, approvedBy } = req.body;

            if (!amount || Number(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid discount amount is required.'
                });
            }

            if (!reason || !reason.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Discount approval reason is required.'
                });
            }

            const discountItem = BookingModel.addDiscount(id, {
                amount,
                reason,
                approvedBy: approvedBy || 'Admin'
            });

            const summary = PaymentModel.getBookingFinancialSummary(id);

            return res.status(201).json({
                success: true,
                message: `Discount of ₹${Number(amount).toLocaleString()} approved and applied!`,
                data: {
                    discount: discountItem,
                    summary
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to apply discount.'
            });
        }
    }

    /**
     * DELETE /api/bookings/:id/extra-charges/:chargeId
     */
    static revertExtraCharge(req, res) {
        try {
            const { id, chargeId } = req.params;
            const user = (req.body && req.body.user) || 'Admin';

            const chargeItem = BookingModel.revertExtraCharge(id, chargeId, user);
            const summary = PaymentModel.getBookingFinancialSummary(id);

            return res.status(200).json({
                success: true,
                message: `Extra charge (${chargeItem.category}) reverted successfully! Financial summary updated.`,
                data: {
                    revertedCharge: chargeItem,
                    summary
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to revert extra charge.'
            });
        }
    }

    /**
     * DELETE /api/bookings/:id/discounts/:discountId
     */
    static revertDiscount(req, res) {
        try {
            const { id, discountId } = req.params;
            const user = (req.body && req.body.user) || 'Admin';

            const discountItem = BookingModel.revertDiscount(id, discountId, user);
            const summary = PaymentModel.getBookingFinancialSummary(id);

            return res.status(200).json({
                success: true,
                message: `Discount of ₹${discountItem.amount.toLocaleString()} reverted successfully!`,
                data: {
                    revertedDiscount: discountItem,
                    summary
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to revert discount.'
            });
        }
    }

    /**
     * PATCH /api/bookings/:id/unarchive
     */
    static unarchiveBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = BookingModel.unarchive(id, user);
            const enriched = {
                ...updated,
                financial: PaymentModel.getBookingFinancialSummary(id)
            };

            return res.status(200).json({
                success: true,
                message: 'Booking restored from Archive successfully! Status set to Confirmed and booking is editable.',
                data: enriched
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to unarchive booking.'
            });
        }
    }

    /**
     * PATCH /api/bookings/:id/archive
     */
    static archiveBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = BookingModel.archive(id, user);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Booking moved to Archive successfully! Time slot freed.',
                data: updated
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to archive booking.',
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/bookings/:id/cancel
     */
    static cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = BookingModel.cancel(id, user);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Booking cancelled successfully.',
                data: updated
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel booking.',
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/bookings/:id/uncancel
     */
    static uncancelBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = BookingModel.uncancel(id, user);
            const enriched = {
                ...updated,
                financial: PaymentModel.getBookingFinancialSummary(id)
            };

            return res.status(200).json({
                success: true,
                message: 'Booking cancellation reverted successfully! Status restored to Confirmed.',
                data: enriched
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to restore cancelled booking.'
            });
        }
    }

    /**
     * DELETE /api/bookings/:id (Financial Safeguard Check)
     */
    static deleteBooking(req, res) {
        try {
            const { id } = req.params;
            
            // Check if booking has any financial transaction records (including voided)
            const transactions = PaymentModel.getTransactionsByBookingId(id, true);
            const auditLogs = AuditModel.findByBookingId(id);

            const hasFinancialRecords = (transactions && transactions.length > 0) || 
                                        (auditLogs && auditLogs.some(a => a.module === 'Payment Ledger' || a.module === 'Financial Contract'));

            try {
                BookingModel.delete(id, hasFinancialRecords);
                return res.status(200).json({
                    success: true,
                    message: 'Booking permanently deleted.'
                });
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    isProtected: true,
                    message: err.message || 'This booking contains financial records and cannot be permanently deleted. You can Archive this booking instead.'
                });
            }

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete booking.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/stats
     */
    static getStats(req, res) {
        try {
            const stats = BookingModel.getStats();
            return res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching stats.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/availability?date=YYYY-MM-DD
     */
    static getAvailability(req, res) {
        try {
            const targetDate = req.query.date || new Date().toISOString().split('T')[0];
            const allDateBookings = BookingModel.findAll({ date: targetDate });

            // Active bookings occupying slots (excluding Cancelled and Archived)
            const activeBookings = allDateBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');

            const hall1Bookings = activeBookings.filter(b => b.hall === 'Hall 1');
            const hall2Bookings = activeBookings.filter(b => b.hall === 'Hall 2');

            return res.status(200).json({
                success: true,
                date: targetDate,
                data: {
                    "Hall 1": {
                        totalBookings: hall1Bookings.length,
                        slots: hall1Bookings
                    },
                    "Hall 2": {
                        totalBookings: hall2Bookings.length,
                        slots: hall2Bookings
                    }
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching hall availability.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/audit
     */
    static getAuditLogs(req, res) {
        try {
            const { module, targetId, search } = req.query;
            const logs = AuditModel.findAll({ module, targetId, search });
            return res.status(200).json({
                success: true,
                count: logs.length,
                data: logs
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching audit logs.',
                error: error.message
            });
        }
    }
}

module.exports = BookingController;


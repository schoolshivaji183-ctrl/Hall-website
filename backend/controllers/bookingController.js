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
    static async getAllBookings(req, res) {
        try {
            // Parallelize database synchronization
            await Promise.all([
                BookingModel.syncFromDB(),
                PaymentModel.syncFromDB()
            ]);
            const { search, date, hall, status } = req.query;
            let bookings = await BookingModel.findAll({ search, date, hall, status }, true);

            // Attach financial summary to each booking
            const enrichedBookings = [];
            for (const b of bookings) {
                const financial = await PaymentModel.getBookingFinancialSummary(b.id, b);
                enrichedBookings.push({
                    ...b,
                    financial
                });
            }

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
    static async getBookingById(req, res) {
        try {
            const booking = await BookingModel.findById(req.params.id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            await PaymentModel.syncFromDB();
            const financial = await PaymentModel.getBookingFinancialSummary(booking.id, booking);
            const auditLogs = await AuditModel.findByBookingId(booking.id);

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
    static async createBooking(req, res) {
        try {
            const { customerName, mobileNumber, eventName, hall, bookingDate, startTime, endTime, status, notes, hallRent, discount, extraCharges, securityDeposit, rentPaid, depositCollected, paymentMethod, createdBy } = req.body;

            // Validation of required fields
            if (!customerName || !mobileNumber || !eventName || !hall || !bookingDate || !startTime || !endTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Please fill in all required fields.'
                });
            }

            // CRITICAL BOOKING VALIDATION ENGINE CHECK
            const allBookings = await BookingModel.findAll();
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
            const newBooking = await BookingModel.create({
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
                rentPaid,
                depositCollected,
                paymentMethod,
                createdBy: createdBy || 'Admin'
            });

            const enriched = {
                ...newBooking,
                financial: await PaymentModel.getBookingFinancialSummary(newBooking.id)
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
    static async updateBooking(req, res) {
        try {
            const { id } = req.params;
            const existing = await BookingModel.findById(id);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            const { customerName, mobileNumber, eventName, hall, bookingDate, startTime, endTime, status, notes, hallRent, discount, extraCharges, securityDeposit, rentPaid, depositCollected, paymentMethod, updatedBy } = req.body;

            const targetHall = hall || existing.hall;
            const targetDate = bookingDate || existing.bookingDate;
            const targetStart = startTime || existing.startTime;
            const targetEnd = endTime || existing.endTime;
            const targetStatus = status || existing.status;

            // Collision check only if time/hall/status changed
            if (targetStatus !== 'Cancelled' && targetStatus !== 'Archived') {
                const allBookings = await BookingModel.findAll();
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
            }

            const updated = await BookingModel.update(id, {
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
                rentPaid,
                depositCollected,
                paymentMethod,
                updatedBy: updatedBy || 'Admin'
            });

            const enriched = {
                ...updated,
                financial: PaymentModel.getBookingFinancialSummary(id, updated)
            };

            return res.status(200).json({
                success: true,
                message: 'Booking updated successfully!',
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
    static async addExtraCharge(req, res) {
        try {
            const { id } = req.params;
            const { category, amount, remarks, addedBy } = req.body;

            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid extra charge amount greater than 0.'
                });
            }

            const chargeItem = await BookingModel.addExtraCharge(id, {
                category: category || 'Other Extra Charge',
                amount: Number(amount),
                remarks: remarks || '',
                addedBy: addedBy || 'Admin'
            });

            const summary = await PaymentModel.getBookingFinancialSummary(id);

            return res.status(201).json({
                success: true,
                message: `Extra charge of ₹${Number(amount).toLocaleString()} added successfully!`,
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
    static async addDiscount(req, res) {
        try {
            const { id } = req.params;
            const { amount, reason, approvedBy } = req.body;

            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid discount amount.'
                });
            }

            if (!reason || !reason.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Reason for discount is required.'
                });
            }

            const discountItem = await BookingModel.addDiscount(id, {
                amount: Number(amount),
                reason: reason.trim(),
                approvedBy: approvedBy || 'Admin'
            });

            const summary = await PaymentModel.getBookingFinancialSummary(id);

            return res.status(201).json({
                success: true,
                message: `Discount of ₹${Number(amount).toLocaleString()} applied successfully!`,
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
    static async revertExtraCharge(req, res) {
        try {
            const { id, chargeId } = req.params;
            const user = (req.body && req.body.user) || 'Admin';

            const chargeItem = await BookingModel.revertExtraCharge(id, chargeId, user);
            const summary = await PaymentModel.getBookingFinancialSummary(id);

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
    static async revertDiscount(req, res) {
        try {
            const { id, discountId } = req.params;
            const user = (req.body && req.body.user) || 'Admin';

            const discountItem = await BookingModel.revertDiscount(id, discountId, user);
            const summary = await PaymentModel.getBookingFinancialSummary(id);

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
    static async unarchiveBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = await BookingModel.unarchive(id, user);
            const enriched = {
                ...updated,
                financial: await PaymentModel.getBookingFinancialSummary(id)
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
    static async archiveBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = await BookingModel.archive(id, user);
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
    static async cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = await BookingModel.cancel(id, user);
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
    static async uncancelBooking(req, res) {
        try {
            const { id } = req.params;
            const user = (req.body && req.body.user) || 'Admin';
            const updated = await BookingModel.uncancel(id, user);
            const enriched = {
                ...updated,
                financial: await PaymentModel.getBookingFinancialSummary(id)
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
    static async deleteBooking(req, res) {
        try {
            const { id } = req.params;

            const transactions = await PaymentModel.getTransactionsByBookingId(id, true);
            const auditLogs = await AuditModel.findByBookingId(id);

            const hasFinancialRecords = (transactions && transactions.length > 0) ||
                                        (auditLogs && auditLogs.some(a => a.module === 'Payment Ledger' || a.module === 'Financial Contract'));

            try {
                await BookingModel.delete(id, hasFinancialRecords);
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
    static async getStats(req, res) {
        try {
            const stats = await BookingModel.getStats();
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
     * GET /api/stats/yearly?year=YYYY
     */
    static async getYearlyStats(req, res) {
        try {
            const { year } = req.query;
            const yearlyStats = await BookingModel.getYearlyStats(year);
            return res.status(200).json({
                success: true,
                data: yearlyStats
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching yearly statistics.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/availability?date=YYYY-MM-DD
     */
    static async getAvailability(req, res) {
        try {
            const targetDate = req.query.date || new Date().toISOString().split('T')[0];
            const allDateBookings = await BookingModel.findAll({ date: targetDate });

            const activeBookings = allDateBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');
            const smallHallBookings = activeBookings.filter(b => b.hall === 'Small Hall' || b.hall === 'Hall 1');
            const bigHallBookings = activeBookings.filter(b => b.hall === 'Big Hall' || b.hall === 'Hall 2');

            return res.status(200).json({
                success: true,
                date: targetDate,
                data: {
                    "Small Hall": {
                        totalBookings: smallHallBookings.length,
                        slots: smallHallBookings
                    },
                    "Big Hall": {
                        totalBookings: bigHallBookings.length,
                        slots: bigHallBookings
                    },
                    "Hall 1": {
                        totalBookings: smallHallBookings.length,
                        slots: smallHallBookings
                    },
                    "Hall 2": {
                        totalBookings: bigHallBookings.length,
                        slots: bigHallBookings
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
     * GET /api/stats/day-slots?date=YYYY-MM-DD
     */
    static async getDaySlots(req, res) {
        try {
            const { date } = req.query;
            const stats = await BookingModel.getDaySlotStats(date);
            return res.status(200).json({
                success: true,
                date: stats.date,
                data: stats
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching day slot statistics.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/audit
     */
    static async getAuditLogs(req, res) {
        try {
            const { module, targetId, search } = req.query;
            const logs = await AuditModel.findAll({ module, targetId, search });
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

    /**
     * GET /api/halls
     */
    static async getAllHalls(req, res) {
        try {
            const HallModel = require('../models/hallModel');
            const halls = await HallModel.findAll();
            return res.status(200).json({
                success: true,
                count: halls.length,
                data: halls
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching halls.',
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/halls/:id/status
     */
    static async updateHallStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const HallModel = require('../models/hallModel');
            const updated = await HallModel.updateStatus(id, status);
            return res.status(200).json({
                success: true,
                message: `Hall status updated to ${status}.`,
                data: updated
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to update hall status.'
            });
        }
    }
}

module.exports = BookingController;

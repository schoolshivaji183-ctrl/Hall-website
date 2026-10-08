const PaymentModel = require('../models/paymentModel');
const BookingModel = require('../models/bookingModel');

/**
 * Controller handling payment transactions, financial ledger, receipts, and deposit operations
 */
class PaymentController {
    /**
     * GET /api/payments
     */
    static async getAllPayments(req, res) {
        try {
            const filters = req.query;
            const transactions = await PaymentModel.findAll(filters);
            return res.status(200).json({
                success: true,
                count: transactions.length,
                data: transactions
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching payment ledger.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/payments/booking/:bookingId
     */
    static async getBookingSummary(req, res) {
        try {
            const { bookingId } = req.params;
            await PaymentModel.syncFromDB();
            const summary = await PaymentModel.getBookingFinancialSummary(bookingId);
            if (!summary) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }
            return res.status(200).json({
                success: true,
                data: summary
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving financial summary.',
                error: error.message
            });
        }
    }

    /**
     * POST /api/payments
     */
    static async createPayment(req, res) {
        try {
            const { bookingId, amount, type, paymentMethod, collectedBy, referenceNumber, remarks } = req.body;

            if (!bookingId || !amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Booking ID and Amount are required.'
                });
            }

            const numAmount = Number(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Payment amount must be greater than 0.'
                });
            }

            const booking = await BookingModel.findById(bookingId);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            const transaction = await PaymentModel.createTransaction({
                bookingId,
                amount: numAmount,
                type: type || 'Rent Payment',
                paymentMethod: paymentMethod || 'Cash',
                collectedBy: collectedBy || 'Admin',
                referenceNumber: referenceNumber || 'N/A',
                remarks: remarks || ''
            });

            // Get updated summary
            const updatedSummary = await PaymentModel.getBookingFinancialSummary(bookingId);

            return res.status(201).json({
                success: true,
                message: `Payment of ₹${numAmount.toLocaleString()} recorded successfully! Receipt: ${transaction.receiptNumber}`,
                data: {
                    transaction,
                    summary: updatedSummary
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to record payment transaction.',
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/payments/:receiptNumber/void
     */
    static async voidPayment(req, res) {
        try {
            const { receiptNumber } = req.params;
            const { voidReason, voidedBy } = req.body;

            if (!voidReason || !voidReason.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Void reason is mandatory to void a payment receipt.'
                });
            }

            const voidedTxn = await PaymentModel.voidTransaction(receiptNumber, voidReason, voidedBy || 'Admin');
            const updatedSummary = await PaymentModel.getBookingFinancialSummary(voidedTxn.bookingId);

            return res.status(200).json({
                success: true,
                message: `Receipt ${receiptNumber} has been VOIDED successfully! Balances updated.`,
                data: {
                    transaction: voidedTxn,
                    summary: updatedSummary
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to void receipt.',
                error: error.message
            });
        }
    }

    /**
     * POST /api/payments/deposit-action
     */
    static async manageDeposit(req, res) {
        try {
            const { bookingId, action, amount, remarks, collectedBy } = req.body;

            if (!bookingId || !action || !amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Booking ID, action, and amount are required.'
                });
            }

            const transaction = await PaymentModel.manageDeposit(
                bookingId,
                action,
                amount,
                remarks,
                collectedBy || 'Admin'
            );

            const updatedSummary = await PaymentModel.getBookingFinancialSummary(bookingId);

            const actionLabelMap = {
                'receive': 'Security Deposit Received',
                'collect': 'Security Deposit Received',
                'return': 'Deposit Return',
                'forfeit': 'Deposit Forfeiture',
                'adjust': 'Deposit Adjustment into Rent'
            };

            return res.status(200).json({
                success: true,
                message: `${actionLabelMap[action] || 'Deposit action'} of ₹${Number(amount).toLocaleString()} processed successfully!`,
                data: {
                    transaction,
                    summary: updatedSummary
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to process deposit action.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/payments/receipt/:receiptNumber
     */
    static async getReceiptDetails(req, res) {
        try {
            const { receiptNumber } = req.params;
            const transaction = await PaymentModel.findByReceiptNumber(receiptNumber);
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Receipt not found.'
                });
            }

            const summary = await PaymentModel.getBookingFinancialSummary(transaction.bookingId);

            return res.status(200).json({
                success: true,
                data: {
                    receipt: transaction,
                    summary
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching receipt details.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/payments/stats
     */
    static async getFinancialStats(req, res) {
        try {
            const stats = await PaymentModel.getFinancialStats();
            return res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving financial statistics.',
                error: error.message
            });
        }
    }
}

module.exports = PaymentController;

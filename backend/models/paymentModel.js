/**
 * Payment Transaction Model & Financial Ledger (MongoDB Atlas & Mongoose)
 * 
 * DESIGN RATIONALE FOR FINANCIAL IMMUTABILITY & AUDIT COMPLIANCE:
 * Financial transactions and receipts are NEVER permanently deleted.
 * Transactions can be VOIDED with mandatory Reason & Approver, preserving historical audit logs.
 */

const { Payment } = require('./schemas/PaymentSchema');
const { isConnected } = require('../config/db');
const AuditModel = require('./auditModel');

// Helper to calculate date string formatted YYYY-MM-DD
function getFormattedDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const todayStr = getFormattedDate(0);

// In-memory payment ledger synchronized with MongoDB Atlas
let transactionsStore = [];

class PaymentModel {
    /**
     * Synchronize in-memory ledger with MongoDB Atlas
     */
    static async syncFromDB() {
        if (isConnected()) {
            try {
                const docs = await Payment.find({}).lean();
                transactionsStore = docs || [];
                return transactionsStore;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to sync payments from Atlas:', err.message);
            }
        }
        return transactionsStore;
    }

    /**
     * Clear all payments (used for clean slate resets)
     */
    static clearStore() {
        transactionsStore = [];
    }
    /**
     * Generate standard ERP receipt number: HBR-YYYY-XXXX
     */
    static generateReceiptNumber(year = new Date().getFullYear()) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `HBR-${year}-${randomNum}`;
    }

    /**
     * Create and record a new transaction in the ledger
     */
    static async createTransaction(data) {
        const BookingModel = require('./bookingModel');
        const currentYear = new Date().getFullYear();
        const receiptNumber = data.receiptNumber || this.generateReceiptNumber(currentYear);
        const txnId = `TXN-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;
        const now = new Date();

        const newTransaction = {
            id: txnId,
            receiptNumber,
            bookingId: data.bookingId,
            date: data.date || now.toISOString().split('T')[0],
            time: data.time || now.toTimeString().split(' ')[0],
            amount: Number(data.amount) || 0,
            type: data.type || 'Rent Payment',
            paymentMethod: data.paymentMethod || 'Cash',
            collectedBy: data.collectedBy || 'Admin',
            referenceNumber: data.referenceNumber || 'N/A',
            remarks: data.remarks || '',
            status: data.status || 'Success',
            isVoided: false,
            voidReason: null,
            voidedBy: null,
            voidedAt: null
        };

        transactionsStore.push(newTransaction);

        if (isConnected()) {
            try {
                await Payment.create(newTransaction);
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to persist transaction:', err.message);
            }
        }

        // Keep Booking document in MongoDB Atlas & in-memory store synchronized with real-time financial totals
        try {
            await this.syncBookingFinancialFields(data.bookingId);
        } catch (err) {
            console.warn('⚠️  [MongoDB] Failed to sync financial totals to booking:', err.message);
        }

        try {
            BookingModel.addTimelineEvent(data.bookingId, {
                title: `Payment Recorded: ${newTransaction.type} (₹${newTransaction.amount.toLocaleString()})`,
                description: `Receipt: ${newTransaction.receiptNumber} | Method: ${newTransaction.paymentMethod} | Collected by: ${newTransaction.collectedBy}`,
                category: 'Financial',
                user: newTransaction.collectedBy
            });
        } catch (e) { }

        AuditModel.log({
            module: 'Payment Ledger',
            action: `Payment Recorded (${newTransaction.type})`,
            targetId: data.bookingId,
            changes: [
                {
                    field: `Receipt ${newTransaction.receiptNumber}`,
                    oldVal: 'Pending',
                    newVal: `Paid: ₹${newTransaction.amount.toLocaleString()} (${newTransaction.paymentMethod})`
                }
            ],
            oldValue: 'Payment Pending',
            newValue: `Receipt: ${newTransaction.receiptNumber}, Amount: ₹${newTransaction.amount}, Method: ${newTransaction.paymentMethod}`,
            user: newTransaction.collectedBy
        });

        return newTransaction;
    }

    /**
     * Synchronize rentPaid, depositCollected, and depositRefunded directly on the Booking document in Atlas & memory
     */
    static async syncBookingFinancialFields(bookingId) {
        const BookingModel = require('./bookingModel');
        const { Booking } = require('./schemas/BookingSchema');
        if (!bookingId) return;

        const summary = this.getBookingFinancialSummary(bookingId);
        if (!summary) return;

        const rentPaid = summary.netRentPaid || 0;
        const depositCollected = summary.depositPaid || 0;
        const depositRefunded = summary.depositReturned || 0;

        // Update in-memory booking
        const memBooking = BookingModel.findByIdSync(bookingId);
        if (memBooking) {
            memBooking.rentPaid = rentPaid;
            memBooking.depositCollected = depositCollected;
            memBooking.depositRefunded = depositRefunded;
        }

        // Update MongoDB Atlas
        if (isConnected()) {
            try {
                await Booking.updateOne(
                    { id: bookingId },
                    {
                        $set: {
                            rentPaid,
                            depositCollected,
                            depositRefunded
                        }
                    }
                );
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to sync financial fields on booking:', err.message);
            }
        }
    }

    /**
     * VOID a payment receipt with mandatory reason and approver
     */
    static async voidTransaction(receiptNumber, voidReason, voidedBy = 'Admin') {
        const BookingModel = require('./bookingModel');
        const memTxn = transactionsStore.find(t => t.receiptNumber === receiptNumber);
        if (!memTxn) {
            throw new Error(`Receipt ${receiptNumber} not found.`);
        }

        if (memTxn.isVoided) throw new Error('Transaction is already voided.');
        memTxn.isVoided = true;
        memTxn.voidReason = voidReason;
        memTxn.voidedBy = voidedBy;
        memTxn.voidedAt = new Date().toISOString();

        if (isConnected()) {
            try {
                await Payment.updateOne(
                    { receiptNumber },
                    {
                        $set: {
                            isVoided: true,
                            voidReason,
                            voidedBy,
                            voidedAt: new Date()
                        }
                    }
                );
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to void transaction in DB:', err.message);
            }
        }

        // Synchronize updated totals to Booking document in Atlas & memory
        try {
            await this.syncBookingFinancialFields(memTxn.bookingId);
        } catch (err) {
            console.warn('⚠️  [MongoDB] Failed to sync voided financial totals to booking:', err.message);
        }

        try {
            BookingModel.addTimelineEvent(memTxn.bookingId, {
                title: `Receipt VOIDED: ${memTxn.receiptNumber}`,
                description: `Voided by ${voidedBy}. Reason: ${voidReason}. Amount reversed: ₹${memTxn.amount.toLocaleString()}`,
                category: 'Financial',
                user: voidedBy
            });
        } catch (e) { }

        AuditModel.log({
            module: 'Payment Ledger',
            action: 'Receipt Voided',
            targetId: memTxn.bookingId,
            changes: [
                {
                    field: `Receipt ${memTxn.receiptNumber}`,
                    oldVal: `Active (₹${memTxn.amount.toLocaleString()})`,
                    newVal: `VOIDED: ${voidReason} (by ${voidedBy})`
                }
            ],
            oldValue: `Receipt ${memTxn.receiptNumber} Active: ₹${memTxn.amount}`,
            newValue: `Receipt ${memTxn.receiptNumber} VOIDED. Reason: ${voidReason}`,
            user: voidedBy
        });

        return memTxn;
    }

    /**
     * Retrieve all transactions with optional filtering.
     * Syncs from MongoDB Atlas on each call to ensure fresh data.
     */
    static async findAll(filters = {}) {
        // Sync from MongoDB Atlas to ensure in-memory store is up to date
        if (isConnected()) {
            try {
                const docs = await Payment.find({}).lean();
                transactionsStore = docs || [];
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to query payments from Atlas:', err.message);
            }
        }

        let results = [...transactionsStore];

        if (filters.bookingId) {
            results = results.filter(t => t.bookingId === filters.bookingId);
        }
        if (filters.date) {
            results = results.filter(t => t.date === filters.date);
        }
        if (filters.paymentMethod && filters.paymentMethod !== 'All') {
            results = results.filter(t => t.paymentMethod === filters.paymentMethod);
        }
        if (filters.type && filters.type !== 'All') {
            results = results.filter(t => t.type === filters.type);
        }
        if (filters.status && filters.status !== 'All') {
            results = results.filter(t => t.status === filters.status);
        }
        if (filters.isVoided !== undefined) {
            const isV = filters.isVoided === 'true' || filters.isVoided === true;
            results = results.filter(t => t.isVoided === isV);
        }

        results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return results;
    }

    /**
     * Find single transaction by receipt number
     */
    static findByReceiptNumber(receiptNumber) {
        return transactionsStore.find(t => t.receiptNumber === receiptNumber) || null;
    }

    /**
     * Retrieve all active transactions for a specific booking ID
     */
    static getTransactionsByBookingId(bookingId, includeVoided = false) {
        let txns = transactionsStore.filter(t => t.bookingId === bookingId);
        if (!includeVoided) {
            txns = txns.filter(t => !t.isVoided);
        }
        return txns;
    }

    /**
     * Remove all transactions for a specific booking (used when booking is permanently deleted)
     */
    static async deleteTransactionsByBookingId(bookingId) {
        transactionsStore = transactionsStore.filter(t => t.bookingId !== bookingId);
        if (isConnected()) {
            try {
                await Payment.deleteMany({ bookingId });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to delete transactions for booking:', err.message);
            }
        }
    }

    /**
     * Compute Real-time Financial Summary for a Booking (Sync & Async compatible)
     */
    static getBookingFinancialSummary(bookingId, bookingData = null, txnsData = null) {
        const BookingModel = require('./bookingModel');
        // IMPORTANT: Use synchronous lookup — findById is async (returns Promise).
        // Since this method is sync, we must use findByIdSync to read from in-memory store.
        const booking = bookingData || BookingModel.findByIdSync(bookingId);
        if (!booking) return null;

        const transactions = txnsData || transactionsStore.filter(t => t.bookingId === bookingId && !t.isVoided);

        const contract = booking.contract || {};
        const hallRent = Number(contract.hallRent) || 10000;
        const securityDeposit = Number(contract.securityDeposit) || 0;
        const baseDiscount = Number(contract.baseDiscount) || 0;

        const extraChargesList = contract.extraChargesList || [];
        const totalExtraCharges = extraChargesList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const discountsList = contract.discountsList || [];
        const approvedDiscountsSum = discountsList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const totalDiscounts = baseDiscount + approvedDiscountsSum;

        const netRent = Math.max(0, hallRent + totalExtraCharges - totalDiscounts);

        let rentPaid = 0;
        let rentRefunded = 0;
        let depositPaid = 0;
        let depositReturned = 0;
        let depositForfeited = 0;
        let depositAdjusted = 0;

        transactions.forEach(t => {
            if (t.status !== 'Success') return;
            const amt = Number(t.amount) || 0;

            switch (t.type) {
                case 'Advance':
                case 'Rent Payment':
                case 'Installment':
                    rentPaid += amt;
                    break;
                case 'Refund':
                    rentRefunded += amt;
                    break;
                case 'Security Deposit':
                    depositPaid += amt;
                    break;
                case 'Deposit Return':
                    depositReturned += amt;
                    break;
                case 'Deposit Forfeiture':
                    depositForfeited += amt;
                    break;
                case 'Adjustment':
                    depositAdjusted += amt;
                    break;
            }
        });

        const netRentPaid = Math.max(0, rentPaid - rentRefunded);
        const effectiveRentCovered = netRentPaid + depositAdjusted;
        // Security Deposit Held = Configured contract deposit (or collected deposit if higher),
        // reduced by any returned, forfeited, or adjusted amounts. Fully DB-driven — no defaults.
        const effectiveDepositHeld = Math.max(0, Math.max(securityDeposit, depositPaid) - depositReturned - depositForfeited - depositAdjusted);

        const remainingRent = Math.max(0, netRent - effectiveRentCovered);
        const remainingDepositDue = Math.max(0, securityDeposit - depositPaid);
        const overpaidAmount = Math.max(0, effectiveRentCovered - netRent);

        const showDepositInContract = effectiveDepositHeld > 0;
        const totalContractAmount = showDepositInContract ? (netRent + securityDeposit) : netRent;
        const remainingTotal = remainingRent + (showDepositInContract ? remainingDepositDue : 0);

        const totalAmountPaid = netRentPaid + depositPaid;
        const totalRefunded = rentRefunded + depositReturned;

        let paymentPercentage = 0;
        if (netRent > 0) {
            paymentPercentage = Math.min(100, Math.round((effectiveRentCovered / netRent) * 100));
        } else if (netRent === 0 && effectiveRentCovered >= 0) {
            paymentPercentage = 100;
        }

        let paymentStatus = 'Pending';
        if (booking.status === 'Cancelled') {
            paymentStatus = 'Cancelled';
        } else if (effectiveRentCovered >= netRent && netRent > 0 && overpaidAmount === 0) {
            paymentStatus = 'Fully Paid';
        } else if (overpaidAmount > 0) {
            paymentStatus = 'Overpaid';
        } else if (effectiveRentCovered > 0 && effectiveRentCovered < netRent) {
            paymentStatus = 'Partially Paid';
        } else if (effectiveRentCovered === 0) {
            paymentStatus = 'Pending';
        }

        let depositStatus = 'Not Required';
        if (securityDeposit === 0 && depositPaid === 0) {
            depositStatus = 'Not Required';
        } else if (depositReturned >= depositPaid && depositPaid > 0 && effectiveDepositHeld === 0) {
            depositStatus = 'Deposit Returned';
        } else if (depositForfeited >= depositPaid && depositPaid > 0 && effectiveDepositHeld === 0) {
            depositStatus = 'Deposit Forfeited';
        } else if (depositAdjusted >= depositPaid && depositPaid > 0 && effectiveDepositHeld === 0) {
            depositStatus = 'Deposit Adjusted';
        } else if (effectiveDepositHeld >= securityDeposit && effectiveDepositHeld > 0) {
            depositStatus = 'Deposit Held';
        } else if (effectiveDepositHeld > 0 && effectiveDepositHeld < securityDeposit) {
            depositStatus = 'Partial Deposit Held';
        } else {
            depositStatus = 'Deposit Pending';
        }

        let hallAvailabilityStatus = 'Reserved';
        if (booking.status === 'Confirmed') {
            hallAvailabilityStatus = 'Occupied';
        } else if (booking.status === 'Draft') {
            hallAvailabilityStatus = 'Tentative';
        } else if (booking.status === 'Completed') {
            hallAvailabilityStatus = 'Completed';
        } else if (booking.status === 'Cancelled' || booking.status === 'Archived') {
            hallAvailabilityStatus = 'Available';
        }

        const isFullySettled = (remainingRent === 0) && (effectiveDepositHeld === 0 || depositStatus === 'Deposit Returned' || depositStatus === 'Deposit Adjusted' || depositStatus === 'Deposit Forfeited' || depositStatus === 'Not Required');
        const isCompletedPaymentPending = (booking.status === 'Completed' && remainingRent > 0);
        const canProcessFinancials = booking.status !== 'Cancelled' && booking.status !== 'Archived';

        return {
            bookingId: booking.id,
            bookingStatus: booking.status,
            customerName: booking.customerName,
            hall: booking.hall,
            bookingDate: booking.bookingDate,

            // Contract Breakdown
            hallRent,
            securityDeposit,
            baseDiscount,
            totalDiscounts,
            discountsList,
            extraChargesList,
            totalExtraCharges,
            netRent,
            showDepositInContract,
            totalContractAmount,

            // Ledger Aggregates
            rentPaid,
            rentRefunded,
            netRentPaid,
            effectiveRentCovered,
            depositPaid,
            depositReturned,
            depositCollected: depositPaid,
            depositRefunded: depositReturned,
            depositForfeited,
            depositAdjusted,
            totalAmountPaid,
            totalRefunded,
            netIncome: Math.max(0, (netRentPaid + depositPaid) - depositReturned),

            // Dues & Overpayments
            remainingRent,
            remainingDepositDue,
            remainingTotal,
            overpaidAmount,
            effectiveDepositHeld,
            paymentPercentage,

            // Status Badges
            paymentStatus,
            depositStatus,
            hallAvailabilityStatus,
            isFullySettled,
            isCompletedPaymentPending,
            canProcessFinancials,

            // History & Audit
            transactions,
            timeline: booking.timeline || []
        };
    }

    /**
     * Process Deposit Management Actions
     */
    static async manageDeposit(bookingId, action, amount, remarks = '', collectedBy = 'Admin') {
        const summary = this.getBookingFinancialSummary(bookingId);
        if (!summary) throw new Error('Booking not found.');

        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) throw new Error('Invalid deposit transaction amount.');

        let type = 'Deposit Return';
        let refPrefix = 'DEP-REF';

        if (action === 'receive' || action === 'collect') {
            type = 'Security Deposit';
            refPrefix = 'DEP-RCV';
        } else if (action === 'return') {
            type = 'Deposit Return';
            refPrefix = 'DEP-REF';
            if (amt > summary.effectiveDepositHeld) {
                throw new Error(`Refund amount (₹${amt.toLocaleString()}) cannot exceed current deposit held (₹${summary.effectiveDepositHeld.toLocaleString()}).`);
            }
        } else if (action === 'forfeit') {
            type = 'Deposit Forfeiture';
            refPrefix = 'DEP-FORFEIT';
            if (amt > summary.effectiveDepositHeld) {
                throw new Error(`Forfeiture amount (₹${amt.toLocaleString()}) cannot exceed current deposit held (₹${summary.effectiveDepositHeld.toLocaleString()}).`);
            }
        } else if (action === 'adjust') {
            type = 'Adjustment';
            refPrefix = 'DEP-ADJUST';
            if (amt > summary.effectiveDepositHeld) {
                throw new Error(`Adjustment amount (₹${amt.toLocaleString()}) cannot exceed current deposit held (₹${summary.effectiveDepositHeld.toLocaleString()}).`);
            }
        } else {
            throw new Error('Invalid deposit action.');
        }

        return await this.createTransaction({
            bookingId,
            amount: amt,
            type,
            paymentMethod: action === 'adjust' ? 'Deposit' : 'Cash',
            collectedBy,
            referenceNumber: `${refPrefix}-${Math.floor(100 + Math.random() * 900)}`,
            remarks: remarks || `Deposit ${action} operation processed.`,
            status: 'Success'
        });
    }

    /**
     * Overall Financial Statistics & Aggregations for Reports
     */
    static async getFinancialStats() {
        const BookingModel = require('./bookingModel');
        const todayStr = getFormattedDate(0);

        // Sync from MongoDB Atlas to ensure in-memory store is fresh
        if (isConnected()) {
            try {
                const docs = await Payment.find({}).lean();
                transactionsStore = docs || [];
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to sync payments for stats:', err.message);
            }
        }

        const activeTxns = transactionsStore.filter(t => !t.isVoided && t.status === 'Success');
        const todayTxns = activeTxns.filter(t => t.date === todayStr);

        const getMethodCollection = (method) => {
            const sum = todayTxns.reduce((acc, t) => {
                const matchesMethod = (method === 'Card')
                    ? (t.paymentMethod && t.paymentMethod.includes('Card'))
                    : (t.paymentMethod === method);
                if (!matchesMethod) return acc;

                if (t.type.includes('Return') || t.type.includes('Refund')) {
                    return acc - t.amount;
                } else if (!t.type.includes('Forfeiture') && !t.type.includes('Adjustment')) {
                    return acc + t.amount;
                }
                return acc;
            }, 0);
            return Math.max(0, sum);
        };

        const cashCollection = getMethodCollection('Cash');
        const upiCollection = getMethodCollection('UPI');
        const cardCollection = getMethodCollection('Card');

        const otherSum = todayTxns.reduce((acc, t) => {
            const isKnown = t.paymentMethod === 'Cash' || t.paymentMethod === 'UPI' || (t.paymentMethod && t.paymentMethod.includes('Card'));
            if (isKnown) return acc;

            if (t.type.includes('Return') || t.type.includes('Refund')) {
                return acc - t.amount;
            } else if (!t.type.includes('Forfeiture') && !t.type.includes('Adjustment')) {
                return acc + t.amount;
            }
            return acc;
        }, 0);
        const otherCollection = Math.max(0, otherSum);

        const todayCollections = Math.max(0, cashCollection + upiCollection + cardCollection + otherCollection);

        // Aggregate across all ACTIVE bookings only (Cancelled/Archived are excluded from deposits held & dues)
        const allBookings = await BookingModel.findAll();
        const activeBookings = allBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');
        let totalRentRevenue = 0;
        let totalDepositsCollected = 0;
        let totalDepositsRefunded = 0;
        let totalDepositHeld = 0;
        let pendingRentDues = 0;
        let depositReturnedCount = 0;

        activeBookings.forEach(b => {
            const s = this.getBookingFinancialSummary(b.id, b);
            if (!s) return;

            // Total Rent Income = sum of actual net rent paid (rentPaid - rentRefunded) from DB
            totalRentRevenue += s.netRentPaid;
            totalDepositsCollected += s.depositPaid;
            totalDepositsRefunded += s.depositReturned;
            totalDepositHeld += s.effectiveDepositHeld;
            pendingRentDues += s.remainingRent;

            if (s.depositStatus === 'Deposit Returned') depositReturnedCount++;
        });

        // Net Income = (Total Rent Income + Deposits Collected) − Deposits Refunded
        const netIncome = Math.max(0, (totalRentRevenue + totalDepositsCollected) - totalDepositsRefunded);

        return {
            todayCollections,
            cashCollection,
            upiCollection,
            cardCollection,
            otherCollection,
            totalRentRevenue,
            totalRentIncome: totalRentRevenue,
            totalDepositsCollected,
            totalDepositsRefunded,
            totalDepositHeld,
            netIncome,
            pendingRentDues,
            depositReturnedCount,
            recentTransactions: activeTxns.slice(-6).reverse()
        };
    }
}

module.exports = PaymentModel;

/**
 * In-Memory Payment Transaction Model & Financial Ledger (Commercial ERP Architecture)
 * 
 * DESIGN RATIONALE FOR FINANCIAL IMMUTABILITY & AUDIT COMPLIANCE:
 * Financial transactions and receipts are NEVER permanently deleted.
 * Transactions can be VOIDED with mandatory Reason & Approver, preserving historical audit logs.
 */

const BookingModel = require('./bookingModel');
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

// Pre-seeded sample transaction ledger with HBR receipt numbers
let transactionsStore = [
    {
        id: "TXN-2026-1001",
        receiptNumber: "HBR-2026-0001",
        bookingId: "BOOK-1001",
        date: todayStr,
        time: "09:30:00",
        amount: 2000,
        type: "Advance", // Advance, Rent Payment, Installment, Security Deposit, Deposit Return, Refund, Adjustment, Deposit Forfeiture
        paymentMethod: "Cash",
        collectedBy: "Admin",
        referenceNumber: "CASH-ADV-001",
        remarks: "Advance cash payment collected at counter.",
        status: "Success",
        isVoided: false,
        voidReason: null,
        voidedBy: null,
        voidedAt: null
    },
    {
        id: "TXN-2026-1002",
        receiptNumber: "HBR-2026-0002",
        bookingId: "BOOK-1001",
        date: todayStr,
        time: "10:15:00",
        amount: 2000,
        type: "Security Deposit",
        paymentMethod: "UPI",
        collectedBy: "Staff - Rahul",
        referenceNumber: "UPI/9876543210/PAY",
        remarks: "Security deposit paid via GPay.",
        status: "Success",
        isVoided: false,
        voidReason: null,
        voidedBy: null,
        voidedAt: null
    },
    {
        id: "TXN-2026-1003",
        receiptNumber: "HBR-2026-0003",
        bookingId: "BOOK-1002",
        date: todayStr,
        time: "11:00:00",
        amount: 12000,
        type: "Rent Payment",
        paymentMethod: "Credit Card",
        collectedBy: "Admin",
        referenceNumber: "CARD-REF-4432",
        remarks: "Full rental payment via HDFC card.",
        status: "Success",
        isVoided: false,
        voidReason: null,
        voidedBy: null,
        voidedAt: null
    },
    {
        id: "TXN-2026-1004",
        receiptNumber: "HBR-2026-0004",
        bookingId: "BOOK-1002",
        date: todayStr,
        time: "11:05:00",
        amount: 2000,
        type: "Security Deposit",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI/7766554433/DEP",
        remarks: "Security deposit received.",
        status: "Success",
        isVoided: false,
        voidReason: null,
        voidedBy: null,
        voidedAt: null
    }
];

let receiptCounter = 1005;

class PaymentModel {
    /**
     * Generate sequential Receipt Number format: HBR-YYYY-XXXX (Hall Booking Receipt)
     */
    static generateReceiptNumber() {
        const year = new Date().getFullYear();
        const numStr = String(receiptCounter++).padStart(4, '0');
        return `HBR-${year}-${numStr}`;
    }

    /**
     * Generate unique Transaction ID format: TXN-YYYY-XXXX
     */
    static generateTransactionId() {
        const year = new Date().getFullYear();
        const numStr = String(Math.floor(1000 + Math.random() * 9000));
        return `TXN-${year}-${numStr}`;
    }

    /**
     * Add a new transaction record into the ledger
     */
    static createTransaction(data) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];

        const receiptNumber = this.generateReceiptNumber();

        const oldSummary = this.getBookingFinancialSummary(data.bookingId);

        const newTxn = {
            id: this.generateTransactionId(),
            receiptNumber,
            bookingId: data.bookingId,
            date: data.date || dateStr,
            time: data.time || timeStr,
            amount: Number(data.amount) || 0,
            type: data.type || 'Rent Payment', // Advance, Rent Payment, Installment, Security Deposit, Deposit Return, Refund, Adjustment, Deposit Forfeiture
            paymentMethod: data.paymentMethod || 'Cash',
            collectedBy: data.collectedBy ? data.collectedBy.trim() : 'Admin',
            referenceNumber: data.referenceNumber ? data.referenceNumber.trim() : 'N/A',
            remarks: data.remarks ? data.remarks.trim() : '',
            status: 'Success',
            isVoided: false,
            voidReason: null,
            voidedBy: null,
            voidedAt: null
        };

        transactionsStore.push(newTxn);

        const newSummary = this.getBookingFinancialSummary(data.bookingId);

        // Add event to Booking Timeline
        BookingModel.addTimelineEvent(data.bookingId, {
            title: `Payment Recorded (${newTxn.type}): ₹${newTxn.amount.toLocaleString()}`,
            description: `Receipt: ${receiptNumber}, Method: ${newTxn.paymentMethod}, Collected By: ${newTxn.collectedBy}`,
            category: 'Financial',
            user: newTxn.collectedBy
        });

        // Audit Log with Field-Level Diffs
        const changes = [
            { field: `Payment Receipt (${receiptNumber})`, oldVal: 'Ledger Entry Created', newVal: `Type: ${newTxn.type} | Amount: ₹${newTxn.amount.toLocaleString()} | Method: ${newTxn.paymentMethod} (Ref: ${newTxn.referenceNumber})` }
        ];

        if (oldSummary && newSummary) {
            if (oldSummary.remainingRent !== newSummary.remainingRent) {
                changes.push({ field: 'Remaining Rent Due', oldVal: `₹${oldSummary.remainingRent.toLocaleString()}`, newVal: `₹${newSummary.remainingRent.toLocaleString()}` });
            }
            if (oldSummary.effectiveDepositHeld !== newSummary.effectiveDepositHeld) {
                changes.push({ field: 'Effective Deposit Held', oldVal: `₹${oldSummary.effectiveDepositHeld.toLocaleString()}`, newVal: `₹${newSummary.effectiveDepositHeld.toLocaleString()}` });
            }
            if (oldSummary.netRentPaid !== newSummary.netRentPaid) {
                changes.push({ field: 'Net Rent Money Paid', oldVal: `₹${oldSummary.netRentPaid.toLocaleString()}`, newVal: `₹${newSummary.netRentPaid.toLocaleString()}` });
            }
        }

        AuditModel.log({
            module: 'Payment Ledger',
            action: `Payment Recorded (${newTxn.type})`,
            targetId: data.bookingId,
            changes,
            oldValue: oldSummary ? `Rent Due: ₹${oldSummary.remainingRent.toLocaleString()}` : 'N/A',
            newValue: newSummary ? `Rent Due: ₹${newSummary.remainingRent.toLocaleString()} | Deposit Held: ₹${newSummary.effectiveDepositHeld.toLocaleString()}` : `Receipt: ${receiptNumber}`,
            user: newTxn.collectedBy
        });

        return newTxn;
    }

    /**
     * Void a transaction/receipt (Financial Immutability Rule)
     */
    static voidTransaction(receiptNumber, voidReason, voidedBy = 'Admin') {
        const txn = this.findByReceiptNumber(receiptNumber);
        if (!txn) throw new Error('Receipt not found.');

        if (txn.isVoided) throw new Error('Receipt is already voided.');

        if (!voidReason || !voidReason.trim()) {
            throw new Error('Reason is required to void a payment receipt.');
        }

        const oldSummary = this.getBookingFinancialSummary(txn.bookingId);

        txn.isVoided = true;
        txn.voidReason = voidReason.trim();
        txn.voidedBy = voidedBy;
        txn.voidedAt = new Date().toISOString();

        const newSummary = this.getBookingFinancialSummary(txn.bookingId);

        // Add timeline event to booking
        BookingModel.addTimelineEvent(txn.bookingId, {
            title: `Receipt Voided: ${txn.receiptNumber}`,
            description: `Amount ₹${txn.amount.toLocaleString()} (${txn.type}) voided. Reason: ${voidReason} (Approved By: ${voidedBy})`,
            category: 'Financial',
            user: voidedBy
        });

        // Audit log with Field-Level Diffs
        const changes = [
            { field: `Receipt Status (${receiptNumber})`, oldVal: `Active (${txn.type} ₹${txn.amount.toLocaleString()})`, newVal: `VOIDED (Reason: ${voidReason}, Approved By: ${voidedBy})` }
        ];

        if (oldSummary && newSummary) {
            if (oldSummary.remainingRent !== newSummary.remainingRent) {
                changes.push({ field: 'Remaining Rent Due', oldVal: `₹${oldSummary.remainingRent.toLocaleString()}`, newVal: `₹${newSummary.remainingRent.toLocaleString()}` });
            }
            if (oldSummary.effectiveDepositHeld !== newSummary.effectiveDepositHeld) {
                changes.push({ field: 'Effective Deposit Held', oldVal: `₹${oldSummary.effectiveDepositHeld.toLocaleString()}`, newVal: `₹${newSummary.effectiveDepositHeld.toLocaleString()}` });
            }
            if (oldSummary.netRentPaid !== newSummary.netRentPaid) {
                changes.push({ field: 'Net Rent Money Paid', oldVal: `₹${oldSummary.netRentPaid.toLocaleString()}`, newVal: `₹${newSummary.netRentPaid.toLocaleString()}` });
            }
        }

        AuditModel.log({
            module: 'Payment Ledger',
            action: 'Receipt Voided',
            targetId: txn.bookingId,
            changes,
            oldValue: oldSummary ? `Rent Due: ₹${oldSummary.remainingRent.toLocaleString()}` : `Receipt: ${txn.receiptNumber}`,
            newValue: newSummary ? `Rent Due: ₹${newSummary.remainingRent.toLocaleString()} | Deposit Held: ₹${newSummary.effectiveDepositHeld.toLocaleString()}` : `VOIDED - Reason: ${voidReason}`,
            user: voidedBy
        });

        return txn;
    }

    /**
     * Retrieve transactions for a booking (all or non-voided)
     */
    static getTransactionsByBookingId(bookingId, includeVoided = false) {
        return transactionsStore.filter(t => t.bookingId === bookingId && (includeVoided || !t.isVoided));
    }

    /**
     * Find transaction by Receipt Number
     */
    static findByReceiptNumber(receiptNumber) {
        return transactionsStore.find(t => t.receiptNumber === receiptNumber) || null;
    }

    /**
     * Retrieve all transactions with filters
     */
    static findAll(filters = {}) {
        let results = [...transactionsStore];

        if (filters.search) {
            const query = filters.search.toLowerCase();
            results = results.filter(t => 
                t.id.toLowerCase().includes(query) ||
                t.receiptNumber.toLowerCase().includes(query) ||
                t.bookingId.toLowerCase().includes(query) ||
                (t.referenceNumber && t.referenceNumber.toLowerCase().includes(query)) ||
                (t.remarks && t.remarks.toLowerCase().includes(query)) ||
                (t.collectedBy && t.collectedBy.toLowerCase().includes(query))
            );
        }

        if (filters.bookingId) {
            results = results.filter(t => t.bookingId === filters.bookingId);
        }

        if (filters.paymentMethod && filters.paymentMethod !== 'All') {
            results = results.filter(t => t.paymentMethod === filters.paymentMethod);
        }

        if (filters.type && filters.type !== 'All') {
            results = results.filter(t => t.type === filters.type);
        }

        if (filters.status && filters.status !== 'All') {
            if (filters.status === 'Voided') {
                results = results.filter(t => t.isVoided);
            } else if (filters.status === 'Success') {
                results = results.filter(t => !t.isVoided && t.status === 'Success');
            }
        }

        if (filters.duesFilter && filters.duesFilter !== 'All') {
            results = results.filter(t => {
                const summary = this.getBookingFinancialSummary(t.bookingId);
                if (!summary) return false;
                if (filters.duesFilter === 'DuesPending') {
                    return summary.remainingRent > 0;
                }
                if (filters.duesFilter === 'CompletedDuesPending') {
                    return summary.bookingStatus === 'Completed' && summary.remainingRent > 0;
                }
                if (filters.duesFilter === 'FullySettled') {
                    return summary.isFullySettled;
                }
                if (filters.duesFilter === 'DepositHeld') {
                    return summary.effectiveDepositHeld > 0;
                }
                return true;
            });
        }

        // Sort descending by date and time
        results.sort((a, b) => {
            const dateTimeA = `${a.date} ${a.time}`;
            const dateTimeB = `${b.date} ${b.time}`;
            return dateTimeB.localeCompare(dateTimeA);
        });

        return results;
    }

    /**
     * Comprehensive Financial Calculation Engine & Contract Summary
     */
    static getBookingFinancialSummary(bookingId) {
        const booking = BookingModel.findById(bookingId);
        if (!booking) return null;

        const transactions = this.getTransactionsByBookingId(bookingId, true); // Include voided for list view

        // 1. Contract Breakdown
        const contract = booking.contract || {};
        const hallRent = Number(contract.hallRent) || 10000;
        // Security deposit: only include when explicitly configured (> 0)
        const securityDeposit = Number(contract.securityDeposit) || 0;
        const baseDiscount = Number(contract.baseDiscount) || 0;

        const discountsList = contract.discountsList || [];
        const extraDiscounts = discountsList.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
        const totalDiscounts = baseDiscount + extraDiscounts;

        const extraChargesList = contract.extraChargesList || [];
        const totalExtraCharges = extraChargesList.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

        const netRent = Math.max(0, hallRent - totalDiscounts + totalExtraCharges);

        // 2. Ledger Aggregates (ONLY non-voided transactions affect totals!)
        let rentPaid = 0;
        let depositPaid = 0;
        let depositReturned = 0;
        let depositForfeited = 0;
        let depositAdjusted = 0;
        let rentRefunded = 0;

        transactions.forEach(t => {
            if (t.isVoided) return; // EXCLUDE VOIDED TRANSACTIONS
            const amt = Number(t.amount) || 0;
            switch (t.type) {
                case 'Advance':
                case 'Rent Payment':
                case 'Installment':
                case 'Rental Payment':
                    rentPaid += amt;
                    break;
                case 'Security Deposit':
                    depositPaid += amt;
                    break;
                case 'Deposit Return':
                case 'Deposit Refund':
                    depositReturned += amt;
                    break;
                case 'Refund':
                case 'Rental Refund':
                    rentRefunded += amt;
                    break;
                case 'Adjustment':
                case 'Deposit Adjustment':
                    depositAdjusted += amt;
                    break;
                case 'Deposit Forfeiture':
                    depositForfeited += amt;
                    break;
            }
        });

        // 3. Financial Balances & Overpayment Calculations
        const netRentPaid = rentPaid - rentRefunded; // Pure rent money received
        const effectiveRentCovered = netRentPaid + depositAdjusted;

        const remainingRent = Math.max(0, netRent - effectiveRentCovered);
        const overpaidAmount = Math.max(0, effectiveRentCovered - netRent);

        const effectiveDepositHeld = Math.max(0, depositPaid - depositReturned - depositForfeited - depositAdjusted);
        const remainingDepositDue = Math.max(0, securityDeposit - depositPaid);

        // Security Deposit visibility in Contract Summary:
        // Contract Summary must ONLY show deposit line if deposit is explicitly collected and currently held (effectiveDepositHeld > 0).
        const showDepositInContract = effectiveDepositHeld > 0;
        const totalContractAmount = netRent + (showDepositInContract ? effectiveDepositHeld : 0);

        const totalAmountPaid = rentPaid + depositPaid;
        const remainingTotal = remainingRent + remainingDepositDue;
        const totalRefunded = depositReturned + rentRefunded;

        const paymentPercentage = netRent > 0 
            ? Math.min(100, Math.round((effectiveRentCovered / netRent) * 100))
            : 100;

        const isFullySettled = (remainingRent <= 0 && effectiveDepositHeld === 0);
        const isCompletedPaymentPending = (booking.status === 'Completed' && !isFullySettled);

        // canProcessFinancials: ALL statuses allow financial actions EXCEPT Archived
        // Completed events should never block payment collection or deposit management
        const canProcessFinancials = (booking.status !== 'Archived');

        // 4. Dynamic Payment Status (Independent of Booking Status)
        let paymentStatus = 'Unpaid';
        if (booking.status === 'Cancelled') {
            paymentStatus = 'Cancelled';
        } else if (booking.status === 'Archived') {
            paymentStatus = 'Archived';
        } else if (overpaidAmount > 0) {
            paymentStatus = 'Overpaid';
        } else if (rentRefunded > 0 && rentPaid <= rentRefunded) {
            paymentStatus = 'Refund Pending';
        } else if (remainingRent <= 0 && netRent > 0) {
            paymentStatus = 'Fully Paid';
        } else if (rentPaid >= netRent * 0.5) {
            paymentStatus = 'Partially Paid';
        } else if (rentPaid > 0) {
            paymentStatus = 'Advance Paid';
        } else {
            paymentStatus = 'Unpaid';
        }

        // 5. Dynamic Deposit Status (Simplified & Clean)
        let depositStatus = 'Deposit Pending';
        if (securityDeposit === 0 && depositPaid === 0) {
            depositStatus = 'N/A'; // No deposit configured or received
        } else if (effectiveDepositHeld === 0 && (depositAdjusted > 0 || depositReturned > 0 || depositForfeited > 0)) {
            depositStatus = 'Deposit Settled';
        } else if (depositForfeited >= securityDeposit && securityDeposit > 0) {
            depositStatus = 'Deposit Forfeited';
        } else if (effectiveDepositHeld > 0) {
            depositStatus = 'Deposit Received (Held)';
        } else if (depositReturned >= depositPaid && depositPaid > 0) {
            depositStatus = 'Deposit Returned';
        } else {
            depositStatus = 'Deposit Pending';
        }

        // 6. Dynamic Hall Availability Status
        let hallAvailabilityStatus = 'Slot Confirmed & Occupied';
        const todayStr = new Date().toISOString().split('T')[0];

        if (booking.status === 'Cancelled' || booking.status === 'Archived') {
            hallAvailabilityStatus = 'Slot Available (Cancelled/Archived)';
        } else if (booking.bookingDate < todayStr) {
            hallAvailabilityStatus = 'Historical Event Record';
        } else if (booking.status === 'Draft') {
            hallAvailabilityStatus = 'Draft Reservation (Tentative)';
        } else {
            hallAvailabilityStatus = 'Slot Confirmed & Occupied';
        }

        return {
            bookingId: booking.id,
            customerName: booking.customerName,
            mobileNumber: booking.mobileNumber,
            eventName: booking.eventName,
            hall: booking.hall,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            bookingStatus: booking.status,
            notes: booking.notes,

            // Financial Contract
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
            depositForfeited,
            depositAdjusted,
            totalAmountPaid,
            totalRefunded,

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
    static manageDeposit(bookingId, action, amount, remarks = '', collectedBy = 'Admin') {
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

        return this.createTransaction({
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
    static getFinancialStats() {
        const todayStr = new Date().toISOString().split('T')[0];
        
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

        // Aggregate across all active bookings
        const allBookings = BookingModel.findAll();
        let totalRentRevenue = 0;
        let totalDepositHeld = 0;
        let pendingRentDues = 0;
        let depositReturnedCount = 0;

        allBookings.forEach(b => {
            const s = this.getBookingFinancialSummary(b.id);
            if (!s) return;

            totalRentRevenue += s.effectiveRentCovered;
            totalDepositHeld += s.effectiveDepositHeld;
            pendingRentDues += s.remainingRent;

            if (s.depositStatus === 'Deposit Returned') depositReturnedCount++;
        });

        return {
            todayCollections,
            cashCollection,
            upiCollection,
            cardCollection,
            otherCollection,
            totalRentRevenue,
            totalDepositHeld,
            pendingRentDues,
            depositReturnedCount,
            recentTransactions: activeTxns.slice(-6).reverse()
        };
    }
}

module.exports = PaymentModel;

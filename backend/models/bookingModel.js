/**
 * Booking Model & Data Repository (MongoDB Atlas & Mongoose)
 * 
 * Encapsulates booking records, Financial Contract definitions, lifecycle states,
 * activity timelines, and slot collision prevention.
 */

const { Booking } = require('./schemas/BookingSchema');
const { isConnected } = require('../config/db');
const BookingValidator = require('../utils/bookingValidator');
const AuditModel = require('./auditModel');
const fs = require('fs');
const path = require('path');

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
const tomorrowStr = getFormattedDate(1);
const nextWeekStr = getFormattedDate(5);

function getFormattedTime() {
    return new Date().toTimeString().split(' ')[0];
}

function getShiftForTime(timeStr) {
    if (!timeStr) return 'Morning';
    const parts = timeStr.split(':').map(Number);
    const hours = isNaN(parts[0]) ? 0 : parts[0];
    const minutes = isNaN(parts[1]) ? 0 : parts[1];
    const totalMins = hours * 60 + minutes;

    if (totalMins >= 360 && totalMins < 720) return 'Morning';
    if (totalMins >= 720 && totalMins < 960) return 'Afternoon';
    if (totalMins >= 960 && totalMins < 1200) return 'Evening';
    return 'Night';
}

function buildDefaultRequirements(bookingData = {}) {
    const isHall1 = (bookingData.hall || '').includes('1');
    const notes = (bookingData.notes || '').toLowerCase();

    return {
        chairs: {
            needed: true,
            quantity: isHall1 ? 250 : 120,
            prepared: false,
            notes: isHall1 ? '250 theatre chairs aligned with center aisle' : '120 conference chairs arranged'
        },
        sound: {
            needed: true,
            type: notes.includes('mic') || notes.includes('sound') ? 'Podium Mic & Stage Audio Array' : 'Standard Podium PA System',
            prepared: false,
            notes: 'Check amplifier, podium mic, and wireless handheld mic'
        },
        lighting: {
            needed: true,
            type: notes.includes('projector') ? 'Dimmed Presentation Stage Lighting' : 'Full Hall & Stage Illumination',
            prepared: false,
            notes: 'Stage focus spotlights and ambient ceiling lights'
        },
        catering: {
            needed: notes.includes('tea') || notes.includes('catering') || notes.includes('lunch') || notes.includes('refreshment'),
            type: notes.includes('lunch') ? 'Lunch Buffet Station' : (notes.includes('tea') || notes.includes('catering') ? 'High Tea & Snacks' : 'None'),
            prepared: false,
            notes: notes.includes('catering') ? 'Dining corridor setup ready' : ''
        },
        status: 'Pending',
        acknowledgedBy: '',
        acknowledgedAt: '',
        preparedBy: '',
        preparedAt: '',
        facultyNotes: ''
    };
}

// In-memory bookings store synchronized with MongoDB Atlas
let bookingsStore = [];
let lastSyncTime = 0;
const SYNC_CACHE_TTL_MS = 3000; // 3 seconds micro-cache window for fast parallel refreshes

class BookingModel {
    static invalidateCache() {
        lastSyncTime = 0;
    }

    /**
     * Synchronize in-memory cache with MongoDB Atlas
     */
    static async syncFromDB(force = false) {
        const now = Date.now();
        if (!force && bookingsStore.length > 0 && (now - lastSyncTime < SYNC_CACHE_TTL_MS)) {
            return bookingsStore;
        }
        if (isConnected()) {
            try {
                const docs = await Booking.find({}).lean();
                bookingsStore = docs || [];
                lastSyncTime = now;
                return bookingsStore;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to sync bookings from Atlas:', err.message);
            }
        }
        return bookingsStore;
    }

    /**
     * Clear all bookings (used for clean slate resets)
     */
    static clearStore() {
        bookingsStore = [];
    }
    static async checkConflict(hall, bookingDate, startTime, endTime, excludeId = null, status = 'Confirmed') {
        const existingBookings = await this.findAll();
        const validation = BookingValidator.validateSlot({
            hall,
            bookingDate,
            startTime,
            endTime,
            status,
            excludeId,
            existingBookings
        });
        return !validation.isValid;
    }

    static async validateSlotDetails({ hall, bookingDate, startTime, endTime, status, excludeId }) {
        const existingBookings = await this.findAll();
        return BookingValidator.validateSlot({
            hall,
            bookingDate,
            startTime,
            endTime,
            status,
            excludeId,
            existingBookings
        });
    }

    static async findAll(filters = {}, skipRemoteSync = false) {
        if (!skipRemoteSync && isConnected()) {
            await this.syncFromDB();
        }

        let results = [...bookingsStore];
        if (!isConnected() && results.length === 0) {
            try {
                const fallbackPath = path.join(__dirname, '..', 'data', 'sampleBookings.json');
                const raw = fs.readFileSync(fallbackPath, 'utf8');
                bookingsStore = JSON.parse(raw);
                results = [...bookingsStore];
                console.log('⚡ Loaded fallback sample bookings.');
            } catch (e) {
                console.warn('⚠️ Failed to load fallback bookings:', e.message);
            }
        }

        if (filters.search && filters.search.trim() !== '') {
            const query = filters.search.trim().toLowerCase();
            results = results.filter(b =>
                (b.customerName || '').toLowerCase().includes(query) ||
                (b.eventName || '').toLowerCase().includes(query) ||
                (b.id || '').toLowerCase().includes(query) ||
                (b.mobileNumber || '').includes(query) ||
                (b.hall || '').toLowerCase().includes(query) ||
                (b.status || '').toLowerCase().includes(query) ||
                (b.bookingDate || '').includes(query)
            );
        }

        if (filters.date && filters.date.trim() !== '') {
            results = results.filter(b => b.bookingDate === filters.date.trim());
        }

        if (filters.hall && filters.hall !== 'All' && filters.hall.trim() !== '') {
            const hallQueries = filters.hall.split(',').map(h => h.trim().toLowerCase());
            results = results.filter(b => hallQueries.includes((b.hall || '').toLowerCase()));
        }

        if (filters.status && filters.status !== 'All' && filters.status.trim() !== '') {
            let statusQuery = filters.status;
            results = results.filter(b => {
                if (statusQuery === 'Booked' || statusQuery === 'Confirmed') {
                    return b.status === 'Booked' || b.status === 'Confirmed';
                }
                return b.status === statusQuery;
            });
        }

        results.sort((a, b) => {
            const dateCmp = (a.bookingDate || '').localeCompare(b.bookingDate || '');
            if (dateCmp !== 0) return dateCmp;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        return results;
    }

    static async findById(id) {
        if (isConnected()) {
            try {
                const doc = await Booking.findOne({ id }).lean();
                if (doc) return doc;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to query booking by id from Atlas:', err.message);
            }
        }
        return bookingsStore.find(b => b.id === id) || null;
    }

    /**
     * SYNCHRONOUS in-memory lookup by booking ID.
     * Used by PaymentModel.getBookingFinancialSummary which is a sync method.
     * Always reads from in-memory bookingsStore (already synced from MongoDB on startup and on every findAll call).
     */
    static findByIdSync(id) {
        return bookingsStore.find(b => b.id === id) || null;
    }

    static async addTimelineEvent(id, { title, description, category = 'General', user = 'Admin' }) {
        const now = new Date();
        const event = {
            id: `TL-${Math.floor(1000 + Math.random() * 9000)}`,
            title,
            description: description || '',
            category,
            timestamp: now.toISOString(),
            date: now.toISOString().split('T')[0],
            time: getFormattedTime(),
            user
        };

        const booking = this.findByIdSync(id);
        if (booking) {
            if (!booking.timeline) booking.timeline = [];
            booking.timeline.push(event);
        }

        if (isConnected()) {
            try {
                await Booking.updateOne({ id }, { $push: { timeline: event } });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to add timeline event:', err.message);
            }
        }

        return event;
    }

    static async create(data) {
        const newId = `BOOK-${Math.floor(1000 + Math.random() * 9000)}`;
        const status = data.status || 'Confirmed';

        const initialRentPaid = Number(data.rentPaid !== undefined ? data.rentPaid : (data.advancePaid !== undefined ? data.advancePaid : 0)) || 0;
        const secDep = data.securityDeposit !== undefined && data.securityDeposit !== '' ? Number(data.securityDeposit) : 0;
        const depCollRaw = (data.depositCollected !== undefined && data.depositCollected !== '' && !isNaN(Number(data.depositCollected))) ? Number(data.depositCollected) : null;
        const initialDepositCollected = (depCollRaw !== null && depCollRaw > 0) ? depCollRaw : (secDep > 0 ? secDep : 0);
        const contractSecurityDeposit = secDep > 0 ? secDep : initialDepositCollected;

        const newBooking = {
            id: newId,
            customerName: (data.customerName || '').trim(),
            mobileNumber: (data.mobileNumber || '').trim(),
            eventName: (data.eventName || '').trim(),
            hall: data.hall,
            bookingDate: data.bookingDate,
            startTime: data.startTime,
            endTime: data.endTime,
            status,
            rentPaid: initialRentPaid,
            depositCollected: initialDepositCollected,
            depositRefunded: 0,
            notes: data.notes ? data.notes.trim() : '',
            requirements: data.requirements ? { ...buildDefaultRequirements(data), ...data.requirements } : buildDefaultRequirements(data),
            contract: {
                hallRent: Number(data.hallRent) || 10000,
                securityDeposit: contractSecurityDeposit,
                baseDiscount: Number(data.discount) || 0,
                discountsList: [],
                extraChargesList: Number(data.extraCharges) > 0 ? [
                    {
                        id: `CHG-${Math.floor(100 + Math.random() * 900)}`,
                        category: 'Initial Extra Charge',
                        amount: Number(data.extraCharges),
                        remarks: 'Added during booking creation',
                        addedBy: data.createdBy || 'Admin',
                        date: data.bookingDate
                    }
                ] : []
            },
            timeline: []
        };

        const timelineTitle = status === 'Draft' ? 'Draft Enquiry Saved' : `Booking Created (${status})`;
        newBooking.timeline.push({
            id: `TL-101`,
            title: timelineTitle,
            description: `Booking registered for ${newBooking.hall} on ${newBooking.bookingDate} (${newBooking.startTime} - ${newBooking.endTime}).`,
            category: 'Booking',
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            time: getFormattedTime(),
            user: data.createdBy || 'Admin'
        });

        bookingsStore.push(newBooking);

        if (isConnected()) {
            try {
                await Booking.create(newBooking);
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to persist booking:', err.message);
            }
        }

        await AuditModel.log({
            module: 'Booking',
            action: 'Booking Created',
            targetId: newId,
            changes: [
                { field: 'Customer & Organizer', oldVal: 'N/A', newVal: `${newBooking.customerName} (${newBooking.mobileNumber})` },
                { field: 'Event Purpose', oldVal: 'N/A', newVal: newBooking.eventName },
                { field: 'Hall & Time Slot', oldVal: 'N/A', newVal: `${newBooking.hall} on ${newBooking.bookingDate} (${newBooking.startTime} - ${newBooking.endTime})` },
                { field: 'Base Hall Rent', oldVal: 'N/A', newVal: `₹${newBooking.contract.hallRent.toLocaleString()}` },
                { field: 'Rent Paid at Creation', oldVal: 'N/A', newVal: `₹${initialRentPaid.toLocaleString()}` },
                { field: 'Deposit Collected at Creation', oldVal: 'N/A', newVal: `₹${initialDepositCollected.toLocaleString()}` },
                { field: 'Initial Status', oldVal: 'N/A', newVal: status }
            ],
            oldValue: 'N/A',
            newValue: `Hall: ${newBooking.hall}, Rent: ₹${newBooking.contract.hallRent}, Paid: ₹${initialRentPaid}, Status: ${status}`,
            user: data.createdBy || 'Admin'
        });

        const PaymentModel = require('./paymentModel');

        // Automatically record initial rent payment transaction if collected at creation
        if (initialRentPaid > 0) {
            await PaymentModel.createTransaction({
                bookingId: newId,
                amount: initialRentPaid,
                type: 'Rent Payment',
                paymentMethod: data.paymentMethod || 'Cash',
                collectedBy: data.createdBy || 'Admin',
                referenceNumber: `RENT-RCV-${Math.floor(100 + Math.random() * 900)}`,
                remarks: 'Rent collected during booking creation',
                date: new Date().toISOString().split('T')[0]
            });
        }

        // Automatically record initial security deposit transaction if collected at creation
        if (initialDepositCollected > 0) {
            await PaymentModel.createTransaction({
                bookingId: newId,
                amount: initialDepositCollected,
                type: 'Security Deposit',
                paymentMethod: data.paymentMethod || 'Cash',
                collectedBy: data.createdBy || 'Admin',
                referenceNumber: `DEP-RCV-${Math.floor(100 + Math.random() * 900)}`,
                remarks: 'Security deposit collected during booking creation',
                date: new Date().toISOString().split('T')[0]
            });
        }

        return newBooking;
    }

    static async update(id, data) {
        let oldBooking = await this.findById(id);
        if (!oldBooking) return null;

        const oldContract = oldBooking.contract || {};

        const updatedContract = {
            ...oldContract,
            hallRent: data.hallRent !== undefined ? Number(data.hallRent) : oldContract.hallRent,
            securityDeposit: data.securityDeposit !== undefined && data.securityDeposit !== '' ? Number(data.securityDeposit) : (oldContract.securityDeposit !== undefined ? oldContract.securityDeposit : 0),
            baseDiscount: data.discount !== undefined ? Number(data.discount) : oldContract.baseDiscount,
            extraChargesList: oldContract.extraChargesList ? [...oldContract.extraChargesList] : []
        };

        let oldInitialExtraAmt = 0;
        const initialChargeIndex = updatedContract.extraChargesList.findIndex(c => c.category === 'Initial Extra Charge');
        if (initialChargeIndex !== -1) {
            oldInitialExtraAmt = Number(updatedContract.extraChargesList[initialChargeIndex].amount) || 0;
        }

        let newInitialExtraAmt = oldInitialExtraAmt;
        if (data.extraCharges !== undefined) {
            newInitialExtraAmt = Number(data.extraCharges) || 0;
            if (initialChargeIndex !== -1) {
                if (newInitialExtraAmt > 0) {
                    updatedContract.extraChargesList[initialChargeIndex] = {
                        ...updatedContract.extraChargesList[initialChargeIndex],
                        amount: newInitialExtraAmt
                    };
                } else {
                    updatedContract.extraChargesList.splice(initialChargeIndex, 1);
                }
            } else if (newInitialExtraAmt > 0) {
                updatedContract.extraChargesList.push({
                    id: `CHG-${Math.floor(100 + Math.random() * 900)}`,
                    category: 'Initial Extra Charge',
                    amount: newInitialExtraAmt,
                    remarks: 'Added/Updated during booking edit',
                    addedBy: data.updatedBy || 'Admin',
                    date: data.bookingDate || oldBooking.bookingDate
                });
            }
        }

        const updatedBooking = {
            ...oldBooking,
            customerName: data.customerName !== undefined ? data.customerName.trim() : oldBooking.customerName,
            mobileNumber: data.mobileNumber !== undefined ? data.mobileNumber.trim() : oldBooking.mobileNumber,
            eventName: data.eventName !== undefined ? data.eventName.trim() : oldBooking.eventName,
            hall: data.hall !== undefined ? data.hall : oldBooking.hall,
            bookingDate: data.bookingDate !== undefined ? data.bookingDate : oldBooking.bookingDate,
            startTime: data.startTime !== undefined ? data.startTime : oldBooking.startTime,
            endTime: data.endTime !== undefined ? data.endTime : oldBooking.endTime,
            status: data.status !== undefined ? data.status : oldBooking.status,
            notes: data.notes !== undefined ? data.notes.trim() : oldBooking.notes,
            requirements: data.requirements !== undefined ? { ...(oldBooking.requirements || buildDefaultRequirements(oldBooking)), ...data.requirements } : (oldBooking.requirements || buildDefaultRequirements(oldBooking)),
            contract: updatedContract
        };

        const changes = [];
        if (data.customerName !== undefined && data.customerName.trim() !== (oldBooking.customerName || '').trim()) {
            changes.push({ field: 'Customer Name', oldVal: oldBooking.customerName || '(Empty)', newVal: data.customerName.trim() });
        }
        if (data.mobileNumber !== undefined && data.mobileNumber.trim() !== (oldBooking.mobileNumber || '').trim()) {
            changes.push({ field: 'Mobile Number', oldVal: oldBooking.mobileNumber || '(Empty)', newVal: data.mobileNumber.trim() });
        }
        if (data.eventName !== undefined && data.eventName.trim() !== (oldBooking.eventName || '').trim()) {
            changes.push({ field: 'Event Purpose', oldVal: oldBooking.eventName || '(Empty)', newVal: data.eventName.trim() });
        }
        if (data.hall !== undefined && data.hall !== oldBooking.hall) {
            changes.push({ field: 'Hall Allocated', oldVal: oldBooking.hall, newVal: data.hall });
        }
        if (data.bookingDate !== undefined && data.bookingDate !== oldBooking.bookingDate) {
            changes.push({ field: 'Booking Date', oldVal: oldBooking.bookingDate, newVal: data.bookingDate });
        }

        const oldTime = `${oldBooking.startTime} - ${oldBooking.endTime}`;
        const newStart = data.startTime !== undefined ? data.startTime : oldBooking.startTime;
        const newEnd = data.endTime !== undefined ? data.endTime : oldBooking.endTime;
        const newTime = `${newStart} - ${newEnd}`;
        if (oldTime !== newTime) {
            changes.push({ field: 'Time Slot', oldVal: oldTime, newVal: newTime });
        }

        if (data.status !== undefined && data.status !== oldBooking.status) {
            changes.push({ field: 'Booking Status', oldVal: oldBooking.status, newVal: data.status });
        }
        const oldNotes = (oldBooking.notes || '').trim();
        const newNotes = (data.notes || '').trim();
        if (data.notes !== undefined && oldNotes !== newNotes) {
            changes.push({ field: 'Notes & Remarks', oldVal: oldNotes || '(None)', newVal: newNotes || '(None)' });
        }
        if (data.hallRent !== undefined && Number(data.hallRent) !== Number(oldContract.hallRent)) {
            changes.push({ field: 'Base Hall Rent', oldVal: `₹${Number(oldContract.hallRent).toLocaleString('en-IN')}`, newVal: `₹${Number(data.hallRent).toLocaleString('en-IN')}` });
        }
        if (data.securityDeposit !== undefined && Number(data.securityDeposit) !== Number(oldContract.securityDeposit)) {
            changes.push({ field: 'Security Deposit', oldVal: `₹${Number(oldContract.securityDeposit).toLocaleString('en-IN')}`, newVal: `₹${Number(data.securityDeposit).toLocaleString('en-IN')}` });
        }
        if (data.discount !== undefined && Number(data.discount) !== Number(oldContract.baseDiscount)) {
            changes.push({ field: 'Initial Base Discount', oldVal: `₹${Number(oldContract.baseDiscount).toLocaleString('en-IN')}`, newVal: `₹${Number(data.discount).toLocaleString('en-IN')}` });
        }
        if (data.extraCharges !== undefined && newInitialExtraAmt !== oldInitialExtraAmt) {
            changes.push({ field: 'Initial Extra Charges', oldVal: `₹${oldInitialExtraAmt.toLocaleString('en-IN')}`, newVal: `₹${newInitialExtraAmt.toLocaleString('en-IN')}` });
        }

        const memIdx = bookingsStore.findIndex(b => b.id === id);
        if (memIdx !== -1) {
            bookingsStore[memIdx] = updatedBooking;
        }

        if (isConnected()) {
            try {
                await Booking.updateOne({ id }, { $set: updatedBooking });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to update booking:', err.message);
            }
        }

        const user = data.updatedBy || 'Admin';

        if (changes.length > 0) {
            const actionTitle = changes.length === 1 ? `Updated ${changes[0].field}` : `Updated ${changes.length} Field(s)`;

            AuditModel.log({
                module: 'Booking',
                action: actionTitle,
                targetId: id,
                changes,
                oldValue: changes.map(c => `${c.field}: ${c.oldVal}`).join(' | '),
                newValue: changes.map(c => `${c.field}: ${c.newVal}`).join(' | '),
                user
            });

            this.addTimelineEvent(id, {
                title: `Booking Details Updated (${changes.length} field${changes.length > 1 ? 's' : ''})`,
                description: changes.map(c => `${c.field}: ${c.oldVal} ➔ ${c.newVal}`).join('; '),
                category: 'Booking',
                user
            });
        }

        const PaymentModel = require('./paymentModel');
        const { Payment } = require('./schemas/PaymentSchema');

        const newSecDep = data.securityDeposit !== undefined && data.securityDeposit !== '' 
            ? Number(data.securityDeposit) 
            : (data.depositCollected !== undefined && data.depositCollected !== '' ? Number(data.depositCollected) : null);

        if (newSecDep !== null) {
            const allDepositTxns = PaymentModel.getTransactionsByBookingId(id, false).filter(t => t.type === 'Security Deposit');
            
            if (allDepositTxns.length === 0 && newSecDep > 0) {
                await PaymentModel.createTransaction({
                    bookingId: id,
                    amount: newSecDep,
                    type: 'Security Deposit',
                    paymentMethod: data.paymentMethod || 'Cash',
                    collectedBy: data.updatedBy || 'Admin',
                    referenceNumber: `DEP-RCV-${Math.floor(100 + Math.random() * 900)}`,
                    remarks: 'Security deposit recorded during booking edit',
                    date: updatedBooking.bookingDate || new Date().toISOString().split('T')[0]
                });
            } else if (allDepositTxns.length === 1) {
                const depTxn = allDepositTxns[0];
                depTxn.amount = newSecDep;
                if (isConnected()) {
                    try {
                        await Payment.updateOne(
                            { receiptNumber: depTxn.receiptNumber },
                            { $set: { amount: newSecDep } }
                        );
                    } catch (err) {
                        console.warn('⚠️ [MongoDB] Failed to update deposit transaction amount:', err.message);
                    }
                }
            } else if (allDepositTxns.length > 1) {
                const otherTotal = allDepositTxns.slice(1).reduce((sum, t) => sum + (t.amount || 0), 0);
                const firstTxnAmt = Math.max(0, newSecDep - otherTotal);
                allDepositTxns[0].amount = firstTxnAmt;
                if (isConnected()) {
                    try {
                        await Payment.updateOne(
                            { receiptNumber: allDepositTxns[0].receiptNumber },
                            { $set: { amount: firstTxnAmt } }
                        );
                    } catch (err) {
                        console.warn('⚠️ [MongoDB] Failed to update initial deposit transaction:', err.message);
                    }
                }
            }
        }

        // Also check if rentPaid was edited during booking edit
        if (data.rentPaid !== undefined && data.rentPaid !== '') {
            const newRentPaid = Number(data.rentPaid) || 0;
            const allRentTxns = PaymentModel.getTransactionsByBookingId(id, false).filter(t => t.type === 'Rent Payment' || t.type === 'Advance');
            if (allRentTxns.length === 0 && newRentPaid > 0) {
                await PaymentModel.createTransaction({
                    bookingId: id,
                    amount: newRentPaid,
                    type: 'Rent Payment',
                    paymentMethod: data.paymentMethod || 'Cash',
                    collectedBy: data.updatedBy || 'Admin',
                    referenceNumber: `RENT-RCV-${Math.floor(100 + Math.random() * 900)}`,
                    remarks: 'Rent payment recorded during booking edit',
                    date: updatedBooking.bookingDate || new Date().toISOString().split('T')[0]
                });
            } else if (allRentTxns.length === 1) {
                const rentTxn = allRentTxns[0];
                rentTxn.amount = newRentPaid;
                if (isConnected()) {
                    try {
                        await Payment.updateOne(
                            { receiptNumber: rentTxn.receiptNumber },
                            { $set: { amount: newRentPaid } }
                        );
                    } catch (err) {
                        console.warn('⚠️ [MongoDB] Failed to update rent transaction amount:', err.message);
                    }
                }
            }
        }

        // Synchronize updated financial fields on the Booking document in Atlas & memory
        try {
            await PaymentModel.syncBookingFinancialFields(id);
        } catch (err) {
            console.warn('⚠️ [MongoDB] Failed to sync financial totals after booking update:', err.message);
        }

        return updatedBooking;
    }

    static addExtraCharge(id, { category, amount, remarks, addedBy = 'Admin' }) {
        const booking = this.findByIdSync(id);
        if (!booking) throw new Error('Booking not found.');

        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) throw new Error('Charge amount must be greater than 0.');

        const chargeItem = {
            id: `CHG-${Math.floor(1000 + Math.random() * 9000)}`,
            category: category || 'Other Charge',
            amount: amt,
            remarks: remarks ? remarks.trim() : '',
            addedBy,
            date: new Date().toISOString().split('T')[0]
        };

        if (!booking.contract) booking.contract = {};
        if (!booking.contract.extraChargesList) booking.contract.extraChargesList = [];
        booking.contract.extraChargesList.push(chargeItem);

        if (isConnected()) {
            Booking.updateOne({ id }, { $push: { 'contract.extraChargesList': chargeItem } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to add extra charge:', err.message);
            });
        }

        this.addTimelineEvent(id, {
            title: `Extra Charge Added: ${chargeItem.category}`,
            description: `Added charge of ₹${amt.toLocaleString()} (${remarks || 'No remarks'})`,
            category: 'Financial',
            user: addedBy
        });

        AuditModel.log({
            module: 'Financial Contract',
            action: 'Extra Charge Added',
            targetId: id,
            changes: [
                { field: `Extra Charge (${chargeItem.category})`, oldVal: '₹0', newVal: `+₹${amt.toLocaleString()} (${remarks || 'No remarks'})` }
            ],
            oldValue: 'Extra Charge: ₹0',
            newValue: `${chargeItem.category}: +₹${amt}`,
            user: addedBy
        });

        return chargeItem;
    }

    static addDiscount(id, { amount, reason, approvedBy = 'Admin' }) {
        const booking = this.findByIdSync(id);
        if (!booking) throw new Error('Booking not found.');

        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) throw new Error('Discount amount must be greater than 0.');
        if (!reason || !reason.trim()) throw new Error('Reason is required for discount approval.');

        const discountItem = {
            id: `DSC-${Math.floor(1000 + Math.random() * 9000)}`,
            amount: amt,
            reason: reason.trim(),
            approvedBy: approvedBy || 'Admin',
            date: new Date().toISOString().split('T')[0]
        };

        if (!booking.contract) booking.contract = {};
        if (!booking.contract.discountsList) booking.contract.discountsList = [];
        booking.contract.discountsList.push(discountItem);

        if (isConnected()) {
            Booking.updateOne({ id }, { $push: { 'contract.discountsList': discountItem } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to add discount:', err.message);
            });
        }

        this.addTimelineEvent(id, {
            title: `Discount Approved: ₹${amt.toLocaleString()}`,
            description: `Discount of ₹${amt.toLocaleString()} approved by ${approvedBy}. Reason: ${reason}`,
            category: 'Financial',
            user: approvedBy
        });

        AuditModel.log({
            module: 'Financial Contract',
            action: 'Discount Approved',
            targetId: id,
            changes: [
                { field: 'Approved Discount', oldVal: '₹0', newVal: `-₹${amt.toLocaleString()} (Reason: ${reason})` }
            ],
            oldValue: 'Discount: ₹0',
            newValue: `Discount: -₹${amt} (Reason: ${reason}, Approved By: ${approvedBy})`,
            user: approvedBy
        });

        return discountItem;
    }

    static revertExtraCharge(id, chargeId, user = 'Admin') {
        const booking = this.findByIdSync(id);
        if (!booking) throw new Error('Booking not found.');

        if (!booking.contract || !booking.contract.extraChargesList) {
            throw new Error('Extra charge record not found.');
        }

        const idx = booking.contract.extraChargesList.findIndex(c => c.id === chargeId);
        if (idx === -1) throw new Error('Extra charge record not found.');

        const chargeItem = booking.contract.extraChargesList[idx];
        booking.contract.extraChargesList.splice(idx, 1);

        if (isConnected()) {
            Booking.updateOne({ id }, { $pull: { 'contract.extraChargesList': { id: chargeId } } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to revert extra charge:', err.message);
            });
        }

        this.addTimelineEvent(id, {
            title: `Extra Charge Reverted: ${chargeItem.category}`,
            description: `Reverted charge of ₹${chargeItem.amount.toLocaleString()} by ${user}`,
            category: 'Financial',
            user
        });

        AuditModel.log({
            module: 'Financial Contract',
            action: 'Extra Charge Reverted',
            targetId: id,
            changes: [
                { field: `Extra Charge (${chargeItem.category})`, oldVal: `+₹${chargeItem.amount.toLocaleString()}`, newVal: '₹0 (Reverted)' }
            ],
            oldValue: `${chargeItem.category}: +₹${chargeItem.amount}`,
            newValue: `${chargeItem.category}: Reverted to ₹0`,
            user
        });

        return chargeItem;
    }

    static revertDiscount(id, discountId, user = 'Admin') {
        const booking = this.findByIdSync(id);
        if (!booking) throw new Error('Booking not found.');

        if (!booking.contract || !booking.contract.discountsList) {
            throw new Error('Discount record not found.');
        }

        const idx = booking.contract.discountsList.findIndex(d => d.id === discountId);
        if (idx === -1) throw new Error('Discount record not found.');

        const discountItem = booking.contract.discountsList[idx];
        booking.contract.discountsList.splice(idx, 1);

        if (isConnected()) {
            Booking.updateOne({ id }, { $pull: { 'contract.discountsList': { id: discountId } } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to revert discount:', err.message);
            });
        }

        this.addTimelineEvent(id, {
            title: `Discount Reverted: ₹${discountItem.amount.toLocaleString()}`,
            description: `Discount of ₹${discountItem.amount.toLocaleString()} reverted by ${user}`,
            category: 'Financial',
            user
        });

        AuditModel.log({
            module: 'Financial Contract',
            action: 'Discount Reverted',
            targetId: id,
            changes: [
                { field: 'Discount', oldVal: `-₹${discountItem.amount.toLocaleString()}`, newVal: '₹0 (Reverted)' }
            ],
            oldValue: `Discount: -₹${discountItem.amount}`,
            newValue: 'Discount: Reverted to ₹0',
            user
        });

        return discountItem;
    }

    static async archive(id, user = 'Admin') {
        const booking = await this.findById(id);
        if (!booking) return null;

        const oldStatus = booking.status;
        booking.status = 'Archived';

        if (isConnected()) {
            try {
                await Booking.updateOne({ id }, { $set: { status: 'Archived' } });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to archive booking:', err.message);
            }
        }

        this.addTimelineEvent(id, {
            title: 'Booking Archived',
            description: `Booking moved to Archive by ${user}. Hall time slot released for other reservations.`,
            category: 'Lifecycle',
            user
        });

        await AuditModel.log({
            module: 'Booking Lifecycle',
            action: 'Booking Archived',
            targetId: id,
            changes: [
                { field: 'Booking Status', oldVal: oldStatus, newVal: 'Archived' }
            ],
            oldValue: `Status: ${oldStatus}`,
            newValue: 'Status: Archived',
            user
        });

        return booking;
    }

    static async unarchive(id, user = 'Admin') {
        const booking = await this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const conflict = await this.checkConflict(booking.hall, booking.bookingDate, booking.startTime, booking.endTime, id, 'Confirmed');
        if (conflict) {
            throw new Error(`Cannot restore booking: Time slot (${booking.startTime} - ${booking.endTime}) on ${booking.bookingDate} for ${booking.hall} is currently occupied.`);
        }

        const oldStatus = booking.status;
        booking.status = 'Confirmed';

        if (isConnected()) {
            try {
                await Booking.updateOne({ id }, { $set: { status: 'Confirmed' } });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to restore booking:', err.message);
            }
        }

        this.addTimelineEvent(id, {
            title: 'Booking Restored from Archive',
            description: `Booking unarchived by ${user}. Status restored to Confirmed.`,
            category: 'Lifecycle',
            user
        });

        await AuditModel.log({
            module: 'Booking Lifecycle',
            action: 'Booking Unarchived',
            targetId: id,
            changes: [
                { field: 'Booking Status', oldVal: oldStatus, newVal: 'Confirmed' }
            ],
            oldValue: `Status: ${oldStatus}`,
            newValue: 'Status: Confirmed',
            user
        });

        return booking;
    }

    static async cancel(id, user = 'Admin') {
        const booking = await this.findById(id);
        if (!booking) return null;

        const oldStatus = booking.status;
        booking.status = 'Cancelled';

        if (isConnected()) {
            try {
                await Booking.updateOne({ id }, { $set: { status: 'Cancelled' } });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to cancel booking:', err.message);
            }
        }

        this.addTimelineEvent(id, {
            title: 'Booking Cancelled',
            description: `Booking cancelled by ${user}. Time slot released.`,
            category: 'Lifecycle',
            user
        });

        await AuditModel.log({
            module: 'Booking Lifecycle',
            action: 'Booking Cancelled',
            targetId: id,
            changes: [
                { field: 'Booking Status', oldVal: oldStatus, newVal: 'Cancelled' }
            ],
            oldValue: `Status: ${oldStatus}`,
            newValue: 'Status: Cancelled',
            user
        });

        return booking;
    }

    static async uncancel(id, user = 'Admin') {
        const booking = await this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const conflict = await this.checkConflict(booking.hall, booking.bookingDate, booking.startTime, booking.endTime, id, 'Confirmed');
        if (conflict) {
            throw new Error(`Cannot uncancel booking: Time slot (${booking.startTime} - ${booking.endTime}) on ${booking.bookingDate} for ${booking.hall} is currently occupied.`);
        }

        const oldStatus = booking.status;
        booking.status = 'Confirmed';

        if (isConnected()) {
            try {
                await Booking.updateOne({ id }, { $set: { status: 'Confirmed' } });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to revert booking cancellation:', err.message);
            }
        }

        this.addTimelineEvent(id, {
            title: 'Cancellation Reverted',
            description: `Booking restored from cancelled state by ${user}.`,
            category: 'Lifecycle',
            user
        });

        await AuditModel.log({
            module: 'Booking Lifecycle',
            action: 'Cancellation Reverted',
            targetId: id,
            changes: [
                { field: 'Booking Status', oldVal: oldStatus, newVal: 'Confirmed' }
            ],
            oldValue: `Status: ${oldStatus}`,
            newValue: 'Status: Confirmed',
            user
        });

        return booking;
    }

    static async delete(id, hasFinancialRecords = false) {
        if (hasFinancialRecords) {
            throw new Error('This booking contains financial records and cannot be permanently deleted. You can Archive this booking instead.');
        }

        const memIdx = bookingsStore.findIndex(b => b.id === id);
        if (memIdx !== -1) {
            bookingsStore.splice(memIdx, 1);
        }

        const PaymentModel = require('./paymentModel');
        await PaymentModel.deleteTransactionsByBookingId(id);

        if (isConnected()) {
            try {
                await Booking.deleteOne({ id });
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to delete booking:', err.message);
            }
        }

        await AuditModel.log({
            module: 'Booking',
            action: 'Booking Permanently Deleted',
            targetId: id,
            changes: [],
            oldValue: `Booking ${id}`,
            newValue: 'DELETED',
            user: 'Admin'
        });

        return true;
    }

    /**
     * Staff Operations: Update specific requirement checklist items
     */
    static async updateRequirements(id, reqData = {}, user = 'Staff') {
        const booking = await this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const currentReqs = booking.requirements || buildDefaultRequirements(booking);

        const updatedReqs = {
            ...currentReqs,
            chairs: {
                ...currentReqs.chairs,
                ...(reqData.chairs || {})
            },
            sound: {
                ...currentReqs.sound,
                ...(reqData.sound || {})
            },
            lighting: {
                ...currentReqs.lighting,
                ...(reqData.lighting || {})
            },
            catering: {
                ...currentReqs.catering,
                ...(reqData.catering || {})
            },
            facultyNotes: reqData.facultyNotes !== undefined ? reqData.facultyNotes : currentReqs.facultyNotes
        };

        // Determine preparation status
        const allItemsPrepared = (!updatedReqs.chairs.needed || updatedReqs.chairs.prepared) &&
                                (!updatedReqs.sound.needed || updatedReqs.sound.prepared) &&
                                (!updatedReqs.lighting.needed || updatedReqs.lighting.prepared) &&
                                (!updatedReqs.catering.needed || updatedReqs.catering.prepared);

        const anyItemPrepared = updatedReqs.chairs.prepared || updatedReqs.sound.prepared || 
                                updatedReqs.lighting.prepared || updatedReqs.catering.prepared;

        if (allItemsPrepared) {
            updatedReqs.status = 'Ready';
            if (!updatedReqs.preparedBy) {
                updatedReqs.preparedBy = user;
                updatedReqs.preparedAt = new Date().toISOString();
            }
        } else if (anyItemPrepared) {
            updatedReqs.status = 'In Progress';
        } else {
            updatedReqs.status = reqData.status || currentReqs.status || 'Pending';
        }

        booking.requirements = updatedReqs;

        if (isConnected()) {
            await Booking.updateOne({ id }, { $set: { requirements: updatedReqs } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to update requirements:', err.message);
            });
        }

        await this.addTimelineEvent(id, {
            title: `Requirements Updated (${updatedReqs.status})`,
            description: `Checklist updated by ${user}. Chairs: ${updatedReqs.chairs.prepared ? '✓ Ready' : 'Pending'}, Sound: ${updatedReqs.sound.prepared ? '✓ Ready' : 'Pending'}, Lighting: ${updatedReqs.lighting.prepared ? '✓ Ready' : 'Pending'}, Catering: ${updatedReqs.catering.prepared ? '✓ Ready' : 'Pending'}`,
            category: 'General',
            user
        });

        AuditModel.log({
            module: 'Staff Operations',
            action: 'Event Requirements Updated',
            targetId: id,
            changes: [
                { field: 'Preparation Status', oldVal: currentReqs.status, newVal: updatedReqs.status }
            ],
            oldValue: `Status: ${currentReqs.status}`,
            newValue: `Status: ${updatedReqs.status}, Staff: ${user}`,
            user
        });

        return updatedReqs;
    }

    /**
     * Staff Operations: One-click mark all setup requirements prepared
     */
    static async markPrepared(id, { user = 'Staff', notes = '' } = {}) {
        const booking = await this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const currentReqs = booking.requirements || buildDefaultRequirements(booking);

        const updatedReqs = {
            ...currentReqs,
            chairs: { ...currentReqs.chairs, prepared: true },
            sound: { ...currentReqs.sound, prepared: true },
            lighting: { ...currentReqs.lighting, prepared: true },
            catering: { ...currentReqs.catering, prepared: true },
            status: 'Ready',
            preparedBy: user,
            preparedAt: new Date().toISOString(),
            facultyNotes: notes || currentReqs.facultyNotes
        };

        booking.requirements = updatedReqs;

        if (isConnected()) {
            await Booking.updateOne({ id }, { $set: { requirements: updatedReqs } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to mark prepared:', err.message);
            });
        }

        await this.addTimelineEvent(id, {
            title: 'Event Setup Marked Ready',
            description: `All setup requirements (chairs, sound, lighting, catering) verified & prepared by ${user}.`,
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
            module: 'Staff Operations',
            action: 'Hall Setup Marked Prepared',
            targetId: id,
            changes: [{ field: 'Requirements Status', oldVal: currentReqs.status, newVal: 'Ready' }],
            oldValue: currentReqs.status,
            newValue: 'Ready',
            user
        });

        return updatedReqs;
    }

    /**
     * Staff Operations: Acknowledge duty/task assignment
     */
    static async acknowledgeTask(id, { user = 'Staff', notes = '' } = {}) {
        const booking = await this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const currentReqs = booking.requirements || buildDefaultRequirements(booking);
        const now = new Date().toISOString();

        const updatedReqs = {
            ...currentReqs,
            acknowledgedBy: user,
            acknowledgedAt: now,
            facultyNotes: notes || currentReqs.facultyNotes
        };

        booking.requirements = updatedReqs;

        if (isConnected()) {
            await Booking.updateOne({ id }, { $set: { requirements: updatedReqs } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to record task acknowledgment:', err.message);
            });
        }

        await this.addTimelineEvent(id, {
            title: 'Event Task Acknowledged',
            description: `Duty assignment acknowledged by ${user} on ${now.split('T')[0]} at ${getFormattedTime()}.`,
            category: 'General',
            user
        });

        AuditModel.log({
            module: 'Staff Operations',
            action: 'Task Duty Acknowledged',
            targetId: id,
            changes: [{ field: 'Acknowledged By', oldVal: currentReqs.acknowledgedBy || 'None', newVal: user }],
            oldValue: currentReqs.acknowledgedBy || 'None',
            newValue: user,
            user
        });

        return updatedReqs;
    }

    /**
     * Staff Operations: Retrieve Safe Events (NO Financial / Commercial figures)
     */
    static async getFacultyEvents(filters = {}) {
        const allBookings = await this.findAll();
        const today = getFormattedDate(0);

        let filtered = allBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'Archived');

        if (filters.type === 'today') {
            const targetDate = filters.date || today;
            filtered = filtered.filter(b => b.bookingDate === targetDate);
        } else if (filters.type === 'upcoming') {
            filtered = filtered.filter(b => b.bookingDate >= today);
        } else if (filters.date) {
            filtered = filtered.filter(b => b.bookingDate === filters.date);
        }

        if (filters.hall && filters.hall !== 'All') {
            const hallQueries = filters.hall.split(',').map(h => h.trim().toLowerCase());
            filtered = filtered.filter(b => hallQueries.includes((b.hall || '').toLowerCase()));
        }

        if (filters.shift && filters.shift !== 'all' && filters.shift !== 'All') {
            filtered = filtered.filter(b => {
                const shiftName = getShiftForTime(b.startTime);
                return shiftName.toLowerCase() === filters.shift.toLowerCase();
            });
        }

        if (filters.status && filters.status !== 'All') {
            filtered = filtered.filter(b => {
                const reqs = b.requirements || buildDefaultRequirements(b);
                return (reqs.status || 'Pending').toLowerCase() === filters.status.toLowerCase();
            });
        }

        if (filters.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            filtered = filtered.filter(b =>
                (b.eventName || '').toLowerCase().includes(q) ||
                (b.customerName || '').toLowerCase().includes(q) ||
                (b.id || '').toLowerCase().includes(q) ||
                (b.mobileNumber || '').includes(q) ||
                (b.hall || '').toLowerCase().includes(q)
            );
        }

        // Sort chronologically
        filtered.sort((a, b) => {
            const dateCmp = (a.bookingDate || '').localeCompare(b.bookingDate || '');
            if (dateCmp !== 0) return dateCmp;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        // Strip ALL financial / pricing fields completely
        return filtered.map(b => {
            const reqs = b.requirements || buildDefaultRequirements(b);
            return {
                id: b.id,
                customerName: b.customerName,
                mobileNumber: b.mobileNumber,
                eventName: b.eventName,
                hall: b.hall,
                bookingDate: b.bookingDate,
                startTime: b.startTime,
                endTime: b.endTime,
                shift: getShiftForTime(b.startTime),
                status: b.status,
                notes: b.notes || '',
                requirements: reqs,
                timeline: (b.timeline || []).map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    category: t.category,
                    date: t.date,
                    time: t.time,
                    user: t.user
                }))
            };
        });
    }

    static async getStats() {
        const HallModel = require('./hallModel');
        const allBookings = await this.findAll({}, true);
        const halls = await HallModel.findAll();
        const today = getFormattedDate(0);

        const todayBookings = allBookings.filter(b => b.bookingDate === today && b.status !== 'Cancelled' && b.status !== 'Archived');
        const upcomingBookings = allBookings.filter(b => b.bookingDate > today && b.status !== 'Cancelled' && b.status !== 'Archived');
        const activeBookings = allBookings.filter(b => b.status === 'Confirmed' || b.status === 'Booked');

        const hall1Doc = halls.find(h => h.hallId === 'HALL-01' || h.name === 'Hall 1' || h.name === 'Small Hall');
        const hall2Doc = halls.find(h => h.hallId === 'HALL-02' || h.name === 'Hall 2' || h.name === 'Big Hall');

        const isSmallHallOccupiedToday = todayBookings.some(b => b.hall === 'Small Hall' || b.hall === 'Hall 1');
        const isBigHallOccupiedToday = todayBookings.some(b => b.hall === 'Big Hall' || b.hall === 'Hall 2');

        const getHallStatusLabel = (hallDoc, isOccupiedToday) => {
            if (hallDoc && hallDoc.status === 'maintenance') return 'Under Maintenance';
            if (isOccupiedToday) return 'Occupied';
            return 'Ready for Booking';
        };

        const hall1Status = getHallStatusLabel(hall1Doc, isSmallHallOccupiedToday);
        const hall2Status = getHallStatusLabel(hall2Doc, isBigHallOccupiedToday);

        return {
            totalBookings: allBookings.length,
            activeBookings: activeBookings.length,
            todayEvents: todayBookings.length,
            upcomingEvents: upcomingBookings.length,
            smallHallStatus: hall1Status,
            bigHallStatus: hall2Status,
            hall1Status,
            hall2Status
        };
    }

    static async getYearlyStats(filterYear = null) {
        const PaymentModel = require('./paymentModel');
        const allBookings = await this.findAll();

        const baseYears = ['2023', '2024', '2025', '2026', '2027'];
        const bookingYears = allBookings.map(b => (b.bookingDate || '').split('-')[0]).filter(Boolean);
        const availableYears = Array.from(new Set([...baseYears, ...bookingYears])).sort();

        const yearlyMap = {};
        availableYears.forEach(year => {
            yearlyMap[year] = {
                year,
                totalEvents: 0,
                activeEvents: 0,
                completedEvents: 0,
                draftEvents: 0,
                cancelledEvents: 0,
                archivedEvents: 0,
                totalRevenue: 0,
                totalContractAmount: 0,
                pendingDues: 0,
                hallBreakdown: {},
                monthlyDistribution: [
                    { monthIndex: 1, monthName: 'Jan', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 2, monthName: 'Feb', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 3, monthName: 'Mar', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 4, monthName: 'Apr', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 5, monthName: 'May', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 6, monthName: 'Jun', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 7, monthName: 'Jul', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 8, monthName: 'Aug', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 9, monthName: 'Sep', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 10, monthName: 'Oct', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 11, monthName: 'Nov', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 12, monthName: 'Dec', totalEvents: 0, smallHallEvents: 0, bigHallEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 }
                ],
                events: []
            };
        });

        allBookings.forEach(booking => {
            const dateParts = (booking.bookingDate || '').split('-');
            const year = dateParts[0];
            const monthIdx = parseInt(dateParts[1], 10);

            if (!year || !yearlyMap[year]) return;

            const yData = yearlyMap[year];
            const fin = PaymentModel.getBookingFinancialSummary(booking.id) || {};

            yData.totalEvents += 1;
            if (booking.status === 'Confirmed' || booking.status === 'Booked') yData.activeEvents += 1;
            else if (booking.status === 'Completed') yData.completedEvents += 1;
            else if (booking.status === 'Draft') yData.draftEvents += 1;
            else if (booking.status === 'Cancelled') yData.cancelledEvents += 1;
            else if (booking.status === 'Archived') yData.archivedEvents += 1;

            const isEffectiveEvent = (booking.status !== 'Cancelled' && booking.status !== 'Archived');
            const netRentPaid = Number(fin.netRentPaid) || 0;
            const netRent = Number(fin.netRent) || 0;
            const remainingRent = Number(fin.remainingRent) || 0;

            if (isEffectiveEvent) {
                yData.totalRevenue += netRentPaid;
                yData.totalContractAmount += netRent;
                yData.pendingDues += remainingRent;
            }

            let rawHall = booking.hall || 'Small Hall';
            if (rawHall === 'Hall 1') rawHall = 'Small Hall';
            if (rawHall === 'Hall 2') rawHall = 'Big Hall';
            const hallName = rawHall;

            if (!yData.hallBreakdown[hallName]) {
                yData.hallBreakdown[hallName] = {
                    hallName,
                    totalEvents: 0,
                    activeEvents: 0,
                    completedEvents: 0,
                    cancelledEvents: 0,
                    draftEvents: 0,
                    revenue: 0,
                    contractAmount: 0,
                    pendingDues: 0
                };
            }
            const hStats = yData.hallBreakdown[hallName];
            hStats.totalEvents += 1;
            if (booking.status === 'Confirmed' || booking.status === 'Booked') hStats.activeEvents += 1;
            else if (booking.status === 'Completed') hStats.completedEvents += 1;
            else if (booking.status === 'Cancelled') hStats.cancelledEvents += 1;
            else if (booking.status === 'Draft') hStats.draftEvents += 1;

            if (isEffectiveEvent) {
                hStats.revenue += netRentPaid;
                hStats.contractAmount += netRent;
                hStats.pendingDues += remainingRent;
            }

            if (monthIdx >= 1 && monthIdx <= 12) {
                const mData = yData.monthlyDistribution[monthIdx - 1];
                mData.totalEvents += 1;
                if (hallName === 'Small Hall' || hallName === 'Hall 1') {
                    mData.smallHallEvents += 1;
                    mData.hall1Events += 1;
                } else if (hallName === 'Big Hall' || hallName === 'Hall 2') {
                    mData.bigHallEvents += 1;
                    mData.hall2Events += 1;
                }

                if (isEffectiveEvent) {
                    mData.revenue += netRentPaid;
                }
            }

            yData.events.push({
                ...booking,
                financial: fin
            });
        });

        Object.keys(yearlyMap).forEach(year => {
            const yData = yearlyMap[year];
            const total = yData.totalEvents || 1;
            Object.keys(yData.hallBreakdown).forEach(hName => {
                const hStats = yData.hallBreakdown[hName];
                hStats.percentage = Math.round((hStats.totalEvents / total) * 100);
            });
        });

        const yearlySummaries = availableYears.map(yr => yearlyMap[yr]);

        let grandTotalEvents = 0;
        let grandTotalRevenue = 0;
        let grandTotalPendingDues = 0;
        const grandHallBreakdown = {};

        yearlySummaries.forEach(y => {
            grandTotalEvents += y.totalEvents;
            grandTotalRevenue += y.totalRevenue;
            grandTotalPendingDues += y.pendingDues;

            Object.keys(y.hallBreakdown).forEach(hName => {
                if (!grandHallBreakdown[hName]) {
                    grandHallBreakdown[hName] = {
                        hallName: hName,
                        totalEvents: 0,
                        revenue: 0,
                        pendingDues: 0
                    };
                }
                grandHallBreakdown[hName].totalEvents += y.hallBreakdown[hName].totalEvents;
                grandHallBreakdown[hName].revenue += y.hallBreakdown[hName].revenue;
                grandHallBreakdown[hName].pendingDues += y.hallBreakdown[hName].pendingDues;
            });
        });

        const selectedYearData = (filterYear && filterYear !== 'All' && yearlyMap[filterYear])
            ? yearlyMap[filterYear]
            : null;

        return {
            availableYears,
            selectedYear: filterYear || 'All',
            selectedYearData,
            yearlySummaries,
            grandTotals: {
                totalEvents: grandTotalEvents,
                totalRevenue: grandTotalRevenue,
                totalPendingDues: grandTotalPendingDues,
                hallBreakdown: grandHallBreakdown,
                yearsCount: availableYears.length
            }
        };
    }

    static async getDaySlotStats(targetDate = null) {
        const PaymentModel = require('./paymentModel');
        const defaultDate = getFormattedDate(0);
        const selectedDate = (targetDate && typeof targetDate === 'string' && targetDate.trim()) ? targetDate.trim() : defaultDate;

        const allBookings = await this.findAll();
        const dateBookings = allBookings.filter(b => b.bookingDate === selectedDate);

        const getSlotKey = (timeStr) => {
            if (!timeStr) return 'morning';
            const parts = timeStr.split(':').map(Number);
            const hours = isNaN(parts[0]) ? 0 : parts[0];
            const minutes = isNaN(parts[1]) ? 0 : parts[1];
            const totalMins = hours * 60 + minutes;

            if (totalMins >= 360 && totalMins < 720) return 'morning';
            if (totalMins >= 720 && totalMins < 960) return 'afternoon';
            if (totalMins >= 960 && totalMins < 1200) return 'evening';
            return 'night';
        };

        const slots = {
            morning: {
                key: 'morning',
                name: 'Morning',
                timeRange: '06:00–12:00',
                icon: 'bi-sunrise',
                color: '#f59e0b',
                bgLight: '#fffbeb',
                count: 0,
                activeCount: 0,
                completedCount: 0,
                cancelledCount: 0,
                draftCount: 0,
                archivedCount: 0,
                revenue: 0,
                contractAmount: 0,
                pendingDues: 0,
                hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 },
                events: []
            },
            afternoon: {
                key: 'afternoon',
                name: 'Afternoon',
                timeRange: '12:00–16:00',
                icon: 'bi-sun',
                color: '#3b82f6',
                bgLight: '#eff6ff',
                count: 0,
                activeCount: 0,
                completedCount: 0,
                cancelledCount: 0,
                draftCount: 0,
                archivedCount: 0,
                revenue: 0,
                contractAmount: 0,
                pendingDues: 0,
                hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 },
                events: []
            },
            evening: {
                key: 'evening',
                name: 'Evening',
                timeRange: '16:00–20:00',
                icon: 'bi-sunset',
                color: '#8b5cf6',
                bgLight: '#f5f3ff',
                count: 0,
                activeCount: 0,
                completedCount: 0,
                cancelledCount: 0,
                draftCount: 0,
                archivedCount: 0,
                revenue: 0,
                contractAmount: 0,
                pendingDues: 0,
                hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 },
                events: []
            },
            night: {
                key: 'night',
                name: 'Night',
                timeRange: '20:00–00:00',
                icon: 'bi-moon-stars',
                color: '#475569',
                bgLight: '#f8fafc',
                count: 0,
                activeCount: 0,
                completedCount: 0,
                cancelledCount: 0,
                draftCount: 0,
                archivedCount: 0,
                revenue: 0,
                contractAmount: 0,
                pendingDues: 0,
                hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 },
                events: []
            }
        };

        const hallBreakdown = {
            'Small Hall': { hallName: 'Small Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
            'Big Hall': { hallName: 'Big Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
            'Hall 1': { hallName: 'Small Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
            'Hall 2': { hallName: 'Big Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 }
        };

        let totalEvents = 0;
        let activeEvents = 0;
        let totalRevenue = 0;
        let totalContractAmount = 0;
        let totalPendingDues = 0;

        dateBookings.forEach(booking => {
            const slotKey = getSlotKey(booking.startTime);
            const slot = slots[slotKey];
            const fin = PaymentModel.getBookingFinancialSummary(booking.id) || {};
            let rawHall = booking.hall || 'Small Hall';
            if (rawHall === 'Hall 1') rawHall = 'Small Hall';
            if (rawHall === 'Hall 2') rawHall = 'Big Hall';
            const hall = rawHall;

            totalEvents += 1;
            slot.count += 1;

            if (booking.status === 'Confirmed' || booking.status === 'Booked') {
                slot.activeCount += 1;
                activeEvents += 1;
            } else if (booking.status === 'Completed') {
                slot.completedCount += 1;
                activeEvents += 1;
            } else if (booking.status === 'Cancelled') {
                slot.cancelledCount += 1;
            } else if (booking.status === 'Draft') {
                slot.draftCount += 1;
            } else if (booking.status === 'Archived') {
                slot.archivedCount += 1;
            }

            if (slot.hallCounts[hall] !== undefined) {
                slot.hallCounts[hall] += 1;
            }
            if (hall === 'Small Hall') slot.hallCounts['Hall 1'] += 1;
            if (hall === 'Big Hall') slot.hallCounts['Hall 2'] += 1;

            if (hall === 'Small Hall' || hall === 'Hall 1') {
                hallBreakdown['Small Hall'].totalEvents += 1;
                hallBreakdown['Hall 1'].totalEvents += 1;
                if (hallBreakdown['Small Hall'][slotKey] !== undefined) hallBreakdown['Small Hall'][slotKey] += 1;
                if (hallBreakdown['Hall 1'][slotKey] !== undefined) hallBreakdown['Hall 1'][slotKey] += 1;
            } else if (hall === 'Big Hall' || hall === 'Hall 2') {
                hallBreakdown['Big Hall'].totalEvents += 1;
                hallBreakdown['Hall 2'].totalEvents += 1;
                if (hallBreakdown['Big Hall'][slotKey] !== undefined) hallBreakdown['Big Hall'][slotKey] += 1;
                if (hallBreakdown['Hall 2'][slotKey] !== undefined) hallBreakdown['Hall 2'][slotKey] += 1;
            }

            const isEffective = (booking.status !== 'Cancelled' && booking.status !== 'Archived');
            const netRentPaid = Number(fin.netRentPaid) || 0;
            const netRent = Number(fin.netRent) || 0;
            const remainingRent = Number(fin.remainingRent) || 0;

            if (isEffective) {
                slot.revenue += netRentPaid;
                slot.contractAmount += netRent;
                slot.pendingDues += remainingRent;

                totalRevenue += netRentPaid;
                totalContractAmount += netRent;
                totalPendingDues += remainingRent;

                hallBreakdown[hall].revenue += netRentPaid;
            }

            const enriched = {
                ...booking,
                slotKey,
                slotName: slot.name,
                slotTimeRange: slot.timeRange,
                financial: fin
            };
            slot.events.push(enriched);
        });

        Object.values(slots).forEach(slot => {
            slot.events.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        });

        const slotList = [slots.morning, slots.afternoon, slots.evening, slots.night];

        return {
            date: selectedDate,
            totalEvents,
            activeEvents,
            totalRevenue,
            totalContractAmount,
            totalPendingDues,
            slots,
            slotList,
            hallBreakdown
        };
    }
}

module.exports = BookingModel;

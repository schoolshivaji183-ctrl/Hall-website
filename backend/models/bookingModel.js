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

// In-memory bookings store synchronized with MongoDB Atlas
let bookingsStore = [];

class BookingModel {
    /**
     * Synchronize in-memory cache with MongoDB Atlas
     */
    static async syncFromDB() {
        if (isConnected()) {
            try {
                const docs = await Booking.find({}).lean();
                bookingsStore = docs || [];
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
    static checkConflict(hall, bookingDate, startTime, endTime, excludeId = null, status = 'Confirmed') {
        const existingBookings = this.findAll();
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

    static validateSlotDetails({ hall, bookingDate, startTime, endTime, status, excludeId }) {
        const existingBookings = this.findAll();
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

    static findAll(filters = {}) {
        let results = [...bookingsStore];

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

    static findById(id) {
        return bookingsStore.find(b => b.id === id) || null;
    }

    static addTimelineEvent(id, { title, description, category = 'General', user = 'Admin' }) {
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

        const booking = this.findById(id);
        if (booking) {
            if (!booking.timeline) booking.timeline = [];
            booking.timeline.push(event);
        }

        if (isConnected()) {
            Booking.updateOne({ id }, { $push: { timeline: event } }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to add timeline event:', err.message);
            });
        }

        return event;
    }

    static create(data) {
        const newId = `BOOK-${Math.floor(1000 + Math.random() * 9000)}`;
        const status = data.status || 'Confirmed';

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
            notes: data.notes ? data.notes.trim() : '',
            contract: {
                hallRent: Number(data.hallRent) || 10000,
                securityDeposit: data.securityDeposit !== undefined && data.securityDeposit !== '' ? Number(data.securityDeposit) : 0,
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
            Booking.create(newBooking).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to persist booking:', err.message);
            });
        }

        AuditModel.log({
            module: 'Booking',
            action: 'Booking Created',
            targetId: newId,
            changes: [
                { field: 'Customer & Organizer', oldVal: 'N/A', newVal: `${newBooking.customerName} (${newBooking.mobileNumber})` },
                { field: 'Event Purpose', oldVal: 'N/A', newVal: newBooking.eventName },
                { field: 'Hall & Time Slot', oldVal: 'N/A', newVal: `${newBooking.hall} on ${newBooking.bookingDate} (${newBooking.startTime} - ${newBooking.endTime})` },
                { field: 'Base Hall Rent', oldVal: 'N/A', newVal: `₹${newBooking.contract.hallRent.toLocaleString()}` },
                { field: 'Security Deposit', oldVal: 'N/A', newVal: `₹${newBooking.contract.securityDeposit.toLocaleString()}` },
                { field: 'Initial Status', oldVal: 'N/A', newVal: status }
            ],
            oldValue: 'N/A',
            newValue: `Hall: ${newBooking.hall}, Rent: ₹${newBooking.contract.hallRent}, Status: ${status}`,
            user: data.createdBy || 'Admin'
        });

        return newBooking;
    }

    static update(id, data) {
        let oldBooking = this.findById(id);
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
            Booking.updateOne({ id }, { $set: updatedBooking }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to update booking:', err.message);
            });
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

        return updatedBooking;
    }

    static addExtraCharge(id, { category, amount, remarks, addedBy = 'Admin' }) {
        const booking = this.findById(id);
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
        const booking = this.findById(id);
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
        const booking = this.findById(id);
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
        const booking = this.findById(id);
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

    static archive(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) return null;

        const oldStatus = booking.status;
        booking.status = 'Archived';

        if (isConnected()) {
            Booking.updateOne({ id }, { $set: { status: 'Archived' } }).catch(() => {});
        }

        this.addTimelineEvent(id, {
            title: 'Booking Archived',
            description: `Booking moved to Archive by ${user}. Hall time slot released for other reservations.`,
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
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

    static unarchive(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const conflict = this.checkConflict(booking.hall, booking.bookingDate, booking.startTime, booking.endTime, id, 'Confirmed');
        if (conflict) {
            throw new Error(`Cannot restore booking: Time slot (${booking.startTime} - ${booking.endTime}) on ${booking.bookingDate} for ${booking.hall} is currently occupied.`);
        }

        const oldStatus = booking.status;
        booking.status = 'Confirmed';

        if (isConnected()) {
            Booking.updateOne({ id }, { $set: { status: 'Confirmed' } }).catch(() => {});
        }

        this.addTimelineEvent(id, {
            title: 'Booking Restored from Archive',
            description: `Booking unarchived by ${user}. Status restored to Confirmed.`,
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
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

    static cancel(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) return null;

        const oldStatus = booking.status;
        booking.status = 'Cancelled';

        if (isConnected()) {
            Booking.updateOne({ id }, { $set: { status: 'Cancelled' } }).catch(() => {});
        }

        this.addTimelineEvent(id, {
            title: 'Booking Cancelled',
            description: `Booking cancelled by ${user}. Time slot released.`,
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
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

    static uncancel(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        const conflict = this.checkConflict(booking.hall, booking.bookingDate, booking.startTime, booking.endTime, id, 'Confirmed');
        if (conflict) {
            throw new Error(`Cannot uncancel booking: Time slot (${booking.startTime} - ${booking.endTime}) on ${booking.bookingDate} for ${booking.hall} is currently occupied.`);
        }

        const oldStatus = booking.status;
        booking.status = 'Confirmed';

        if (isConnected()) {
            Booking.updateOne({ id }, { $set: { status: 'Confirmed' } }).catch(() => {});
        }

        this.addTimelineEvent(id, {
            title: 'Cancellation Reverted',
            description: `Booking restored from cancelled state by ${user}.`,
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
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

    static delete(id, hasFinancialRecords = false) {
        if (hasFinancialRecords) {
            throw new Error('This booking contains financial records and cannot be permanently deleted. You can Archive this booking instead.');
        }

        const memIdx = bookingsStore.findIndex(b => b.id === id);
        if (memIdx !== -1) {
            bookingsStore.splice(memIdx, 1);
        }

        if (isConnected()) {
            Booking.deleteOne({ id }).catch(err => {
                console.warn('⚠️  [MongoDB] Failed to delete booking:', err.message);
            });
        }

        AuditModel.log({
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

    static getStats() {
        const allBookings = this.findAll();
        const today = new Date().toISOString().split('T')[0];

        const todayBookings = allBookings.filter(b => b.bookingDate === today && b.status !== 'Cancelled' && b.status !== 'Archived');
        const upcomingBookings = allBookings.filter(b => b.bookingDate > today && b.status !== 'Cancelled' && b.status !== 'Archived');
        const activeBookings = allBookings.filter(b => b.status === 'Confirmed' || b.status === 'Booked');

        const isHall1OccupiedToday = todayBookings.some(b => b.hall === 'Hall 1');
        const isHall2OccupiedToday = todayBookings.some(b => b.hall === 'Hall 2');

        return {
            totalBookings: allBookings.length,
            activeBookings: activeBookings.length,
            todayEvents: todayBookings.length,
            upcomingEvents: upcomingBookings.length,
            hall1Status: isHall1OccupiedToday ? 'Occupied' : 'Available',
            hall2Status: isHall2OccupiedToday ? 'Occupied' : 'Available'
        };
    }

    static getYearlyStats(filterYear = null) {
        const PaymentModel = require('./paymentModel');
        const allBookings = this.findAll();

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
                    { monthIndex: 1, monthName: 'Jan', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 2, monthName: 'Feb', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 3, monthName: 'Mar', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 4, monthName: 'Apr', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 5, monthName: 'May', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 6, monthName: 'Jun', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 7, monthName: 'Jul', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 8, monthName: 'Aug', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 9, monthName: 'Sep', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 10, monthName: 'Oct', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 11, monthName: 'Nov', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 },
                    { monthIndex: 12, monthName: 'Dec', totalEvents: 0, hall1Events: 0, hall2Events: 0, revenue: 0 }
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

            const hallName = booking.hall || 'Other';
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
                if (hallName === 'Hall 1') mData.hall1Events += 1;
                else if (hallName === 'Hall 2') mData.hall2Events += 1;

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

    static getDaySlotStats(targetDate = null) {
        const PaymentModel = require('./paymentModel');
        const defaultDate = getFormattedDate(0);
        const selectedDate = (targetDate && typeof targetDate === 'string' && targetDate.trim()) ? targetDate.trim() : defaultDate;

        const allBookings = this.findAll();
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
                hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
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
                hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
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
                hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
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
                hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
                events: []
            }
        };

        const hallBreakdown = {
            'Hall 1': { hallName: 'Hall 1', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
            'Hall 2': { hallName: 'Hall 2', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 }
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
            const hall = booking.hall || 'Hall 1';

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

            if (!hallBreakdown[hall]) {
                hallBreakdown[hall] = { hallName: hall, totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 };
            }
            hallBreakdown[hall].totalEvents += 1;
            if (hallBreakdown[hall][slotKey] !== undefined) {
                hallBreakdown[hall][slotKey] += 1;
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

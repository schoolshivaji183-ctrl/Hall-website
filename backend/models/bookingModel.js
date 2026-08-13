/**
 * In-Memory Booking Model & Data Repository (Commercial ERP Architecture)
 * 
 * DESIGN RATIONALE FOR MONGODB COMPATIBILITY:
 * Encapsulates all booking records, Financial Contract definitions, lifecycle states,
 * activity timelines, and deletion safeguards.
 */

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

// Helper for formatted time HH:MM:SS
function getFormattedTime() {
    return new Date().toTimeString().split(' ')[0];
}

// Pre-seeded sample bookings with Financial Contracts & Timelines
let bookingsStore = [
    {
        id: "BOOK-1001",
        customerName: "Dr. A. Sharma",
        mobileNumber: "9876543210",
        eventName: "AI & Data Science Workshop",
        hall: "Hall 1",
        bookingDate: todayStr,
        startTime: "09:00",
        endTime: "12:00",
        status: "Confirmed",
        notes: "Projector and sound system required.",
        contract: {
            hallRent: 10000,
            securityDeposit: 2000,
            baseDiscount: 1000,
            discountsList: [],
            extraChargesList: [
                { id: "CHG-101", category: "Electricity Charge", amount: 500, remarks: "Generator backup", addedBy: "Admin", date: todayStr }
            ]
        },
        timeline: [
            { id: "TL-101", title: "Booking Created", description: "Initial confirmed booking registered.", category: "Booking", timestamp: new Date().toISOString(), date: todayStr, time: "09:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-1002",
        customerName: "Prof. R. Mehta",
        mobileNumber: "9812345678",
        eventName: "Annual Faculty Meeting",
        hall: "Hall 2",
        bookingDate: todayStr,
        startTime: "14:00",
        endTime: "16:30",
        status: "Confirmed",
        notes: "Arrangement for 50 attendees.",
        contract: {
            hallRent: 12000,
            securityDeposit: 2000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-102", title: "Booking Created", description: "Confirmed booking created for Hall 2.", category: "Booking", timestamp: new Date().toISOString(), date: todayStr, time: "10:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-1003",
        customerName: "Er. V. Patel",
        mobileNumber: "9711223344",
        eventName: "Cybersecurity Guest Lecture",
        hall: "Hall 1",
        bookingDate: tomorrowStr,
        startTime: "10:00",
        endTime: "13:00",
        status: "Confirmed",
        notes: "High-speed Wi-Fi access needed.",
        contract: {
            hallRent: 15000,
            securityDeposit: 3000,
            baseDiscount: 2000,
            discountsList: [],
            extraChargesList: [
                { id: "CHG-103", category: "Cleaning Charge", amount: 1000, remarks: "Deep clean post-event", addedBy: "Admin", date: tomorrowStr }
            ]
        },
        timeline: [
            { id: "TL-103", title: "Booking Created", description: "Booking created for tomorrow.", category: "Booking", timestamp: new Date().toISOString(), date: todayStr, time: "11:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-1004",
        customerName: "Dr. K. Verma",
        mobileNumber: "9988776655",
        eventName: "Robotics Exhibition Prep",
        hall: "Hall 2",
        bookingDate: nextWeekStr,
        startTime: "11:00",
        endTime: "15:00",
        status: "Draft",
        notes: "Enquiry in discussion. Draft status.",
        contract: {
            hallRent: 20000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: [
                { id: "CHG-104", category: "Decoration Charge", amount: 2000, remarks: "Stage decoration setup", addedBy: "Admin", date: nextWeekStr }
            ]
        },
        timeline: [
            { id: "TL-104", title: "Draft Booking Created", description: "Initial enquiry saved as Draft.", category: "Booking", timestamp: new Date().toISOString(), date: todayStr, time: "12:00:00", user: "Admin" }
        ]
    }
];

class BookingModel {
    static checkConflict(hall, bookingDate, startTime, endTime, excludeId = null, status = 'Confirmed') {
        const validation = BookingValidator.validateSlot({
            hall,
            bookingDate,
            startTime,
            endTime,
            status,
            excludeId,
            existingBookings: bookingsStore
        });
        return !validation.isValid;
    }

    static validateSlotDetails({ hall, bookingDate, startTime, endTime, status, excludeId }) {
        return BookingValidator.validateSlot({
            hall,
            bookingDate,
            startTime,
            endTime,
            status,
            excludeId,
            existingBookings: bookingsStore
        });
    }

    static findAll(filters = {}) {
        let results = [...bookingsStore];

        if (filters.search && filters.search.trim() !== '') {
            const query = filters.search.trim().toLowerCase();
            results = results.filter(b => 
                b.customerName.toLowerCase().includes(query) ||
                b.eventName.toLowerCase().includes(query) ||
                b.id.toLowerCase().includes(query) ||
                b.mobileNumber.includes(query) ||
                b.hall.toLowerCase().includes(query) ||
                b.status.toLowerCase().includes(query) ||
                b.bookingDate.includes(query)
            );
        }

        if (filters.date && filters.date.trim() !== '') {
            results = results.filter(b => b.bookingDate === filters.date.trim());
        }

        if (filters.hall && filters.hall !== 'All' && filters.hall.trim() !== '') {
            // Support comma separated like "Hall 1, Hall 2" if needed
            const hallQueries = filters.hall.split(',').map(h => h.trim().toLowerCase());
            results = results.filter(b => hallQueries.includes(b.hall.toLowerCase()));
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
            const dateCmp = a.bookingDate.localeCompare(b.bookingDate);
            if (dateCmp !== 0) return dateCmp;
            return a.startTime.localeCompare(b.startTime);
        });

        return results;
    }

    static findById(id) {
        return bookingsStore.find(b => b.id === id) || null;
    }

    static addTimelineEvent(id, { title, description, category = 'General', user = 'Admin' }) {
        const booking = this.findById(id);
        if (!booking) return null;

        if (!booking.timeline) booking.timeline = [];

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

        booking.timeline.push(event);
        return event;
    }

    static create(data) {
        const newId = `BOOK-${Math.floor(1000 + Math.random() * 9000)}`;
        const status = data.status || 'Confirmed';
        
        const newBooking = {
            id: newId,
            customerName: data.customerName.trim(),
            mobileNumber: data.mobileNumber.trim(),
            eventName: data.eventName.trim(),
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
                extraChargesList: data.extraCharges > 0 ? [
                    { id: `CHG-${Math.floor(100 + Math.random() * 900)}`, category: 'Initial Extra Charge', amount: Number(data.extraCharges), remarks: 'Added during booking creation', addedBy: data.createdBy || 'Admin', date: data.bookingDate }
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
        const index = bookingsStore.findIndex(b => b.id === id);
        if (index === -1) return null;

        const oldBooking = bookingsStore[index];
        const oldContract = oldBooking.contract || {};

        const updatedContract = {
            ...oldContract,
            hallRent: data.hallRent !== undefined ? Number(data.hallRent) : oldContract.hallRent,
            securityDeposit: data.securityDeposit !== undefined && data.securityDeposit !== '' ? Number(data.securityDeposit) : (oldContract.securityDeposit !== undefined ? oldContract.securityDeposit : 0),
            baseDiscount: data.discount !== undefined ? Number(data.discount) : oldContract.baseDiscount,
            extraChargesList: oldContract.extraChargesList ? [...oldContract.extraChargesList] : []
        };

        // Update Initial Extra Charges in extraChargesList if provided
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

        // Calculate Git-Style Field-by-Field Diff (ONLY FOR ACTUAL CHANGES)
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

        bookingsStore[index] = updatedBooking;

        const user = data.updatedBy || 'Admin';

        // ONLY log audit record and timeline event if fields were actually modified
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

        if (!booking.contract.extraChargesList) {
            booking.contract.extraChargesList = [];
        }

        booking.contract.extraChargesList.push(chargeItem);

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

        if (!booking.contract.discountsList) {
            booking.contract.discountsList = [];
        }

        booking.contract.discountsList.push(discountItem);

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

        this.addTimelineEvent(id, {
            title: `Extra Charge Reverted: ${chargeItem.category}`,
            description: `Reverted charge of ₹${chargeItem.amount.toLocaleString()} (${chargeItem.remarks || 'No remarks'})`,
            category: 'Financial',
            user
        });

        AuditModel.log({
            module: 'Financial Contract',
            action: 'Extra Charge Reverted',
            targetId: id,
            changes: [
                { field: `Extra Charge (${chargeItem.category})`, oldVal: `+₹${chargeItem.amount.toLocaleString()}`, newVal: 'Reverted (₹0)' }
            ],
            oldValue: `${chargeItem.category}: +₹${chargeItem.amount}`,
            newValue: 'Reverted (₹0)',
            user
        });

        return chargeItem;
    }

    static revertDiscount(id, discountId, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        if (!booking.contract) throw new Error('Contract record not found.');

        let discountItem = null;
        if (discountId === 'BASE_DISCOUNT') {
            if (booking.contract.baseDiscount > 0) {
                discountItem = {
                    id: 'BASE_DISCOUNT',
                    amount: Number(booking.contract.baseDiscount),
                    reason: 'Initial Base Discount',
                    date: new Date().toISOString().split('T')[0]
                };
                booking.contract.baseDiscount = 0;
            }
        } else if (booking.contract.discountsList) {
            const idx = booking.contract.discountsList.findIndex(d => d.id === discountId);
            if (idx !== -1) {
                discountItem = booking.contract.discountsList[idx];
                booking.contract.discountsList.splice(idx, 1);
            }
        }

        if (!discountItem) throw new Error('Discount record not found.');

        this.addTimelineEvent(id, {
            title: `Discount Reverted: ₹${discountItem.amount.toLocaleString()}`,
            description: `Reverted discount of ₹${discountItem.amount.toLocaleString()} (Reason: ${discountItem.reason})`,
            category: 'Financial',
            user
        });

        AuditModel.log({
            module: 'Financial Contract',
            action: 'Discount Reverted',
            targetId: id,
            changes: [
                { field: 'Approved Discount', oldVal: `-₹${discountItem.amount.toLocaleString()}`, newVal: 'Reverted (₹0)' }
            ],
            oldValue: `Discount: -₹${discountItem.amount}`,
            newValue: 'Reverted (₹0)',
            user
        });

        return discountItem;
    }

    static unarchive(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) throw new Error('Booking not found.');

        if (booking.status !== 'Archived') {
            throw new Error('Booking is not currently archived.');
        }

        // Validate time slot conflict before restoring to Confirmed
        const validation = this.validateSlotDetails({
            hall: booking.hall,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: 'Confirmed',
            excludeId: booking.id
        });

        if (!validation.isValid) {
            throw new Error(`Cannot unarchive booking: ${validation.message}`);
        }

        const oldStatus = booking.status;
        booking.status = 'Confirmed';

        this.addTimelineEvent(id, {
            title: 'Booking Unarchived',
            description: 'Booking restored from archive to Confirmed state. Customer info and contract details remain editable.',
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
            module: 'Booking',
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

    static archive(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) return null;

        const oldStatus = booking.status;
        booking.status = 'Archived';

        this.addTimelineEvent(id, {
            title: 'Booking Archived',
            description: 'Booking moved to archive. Slot freed for future bookings.',
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
            module: 'Booking',
            action: 'Booking Archived',
            targetId: id,
            changes: [
                { field: 'Booking Status', oldVal: oldStatus, newVal: 'Archived (Slot Freed)' }
            ],
            oldValue: `Status: ${oldStatus}`,
            newValue: 'Status: Archived',
            user
        });

        return booking;
    }

    static cancel(id, user = 'Admin') {
        const booking = this.findById(id);
        if (!booking) return null;

        const oldStatus = booking.status;
        booking.status = 'Cancelled';

        this.addTimelineEvent(id, {
            title: 'Booking Cancelled',
            description: 'Booking cancelled. Slot freed for future bookings.',
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
            module: 'Booking',
            action: 'Booking Cancelled',
            targetId: id,
            changes: [
                { field: 'Booking Status', oldVal: oldStatus, newVal: 'Cancelled (Slot Freed)' }
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

        if (booking.status !== 'Cancelled') {
            throw new Error('Booking is not currently cancelled.');
        }

        // Validate time slot conflict before restoring to Confirmed
        const validation = this.validateSlotDetails({
            hall: booking.hall,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: 'Confirmed',
            excludeId: booking.id
        });

        if (!validation.isValid) {
            throw new Error(`Cannot restore cancelled booking: ${validation.message}`);
        }

        const oldStatus = booking.status;
        booking.status = 'Confirmed';

        this.addTimelineEvent(id, {
            title: 'Booking Cancellation Reverted',
            description: 'Booking restored from Cancelled to Confirmed state. Time slot re-reserved.',
            category: 'Lifecycle',
            user
        });

        AuditModel.log({
            module: 'Booking',
            action: 'Booking Cancellation Reverted',
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
        const index = bookingsStore.findIndex(b => b.id === id);
        if (index === -1) throw new Error('Booking not found.');

        if (hasFinancialRecords) {
            throw new Error('This booking contains financial records and cannot be permanently deleted. You can Archive this booking instead.');
        }

        bookingsStore.splice(index, 1);

        AuditModel.log({
            module: 'Booking',
            action: 'Booking Permanently Deleted',
            targetId: id,
            oldValue: `Booking ID: ${id}`,
            newValue: null,
            user: 'Admin'
        });

        return true;
    }

    static getStats() {
        const today = getFormattedDate(0);
        
        const totalBookings = bookingsStore.length;
        const activeBookings = bookingsStore.filter(b => b.status === 'Confirmed' || b.status === 'Booked');
        const todayBookings = bookingsStore.filter(b => b.bookingDate === today && (b.status === 'Confirmed' || b.status === 'Booked'));
        const upcomingBookings = bookingsStore.filter(b => b.bookingDate > today && (b.status === 'Confirmed' || b.status === 'Booked'));

        const isHall1OccupiedToday = todayBookings.some(b => b.hall === 'Hall 1');
        const isHall2OccupiedToday = todayBookings.some(b => b.hall === 'Hall 2');

        return {
            totalBookings,
            activeCount: activeBookings.length,
            draftCount: bookingsStore.filter(b => b.status === 'Draft').length,
            cancelledCount: bookingsStore.filter(b => b.status === 'Cancelled').length,
            completedCount: bookingsStore.filter(b => b.status === 'Completed').length,
            archivedCount: bookingsStore.filter(b => b.status === 'Archived').length,
            todayCount: todayBookings.length,
            upcomingCount: upcomingBookings.length,
            hall1Status: isHall1OccupiedToday ? 'Booked Today' : 'Ready for Booking',
            hall2Status: isHall2OccupiedToday ? 'Booked Today' : 'Ready for Booking',
            recentActivities: bookingsStore.slice(-5).reverse()
        };
    }
}

module.exports = BookingModel;

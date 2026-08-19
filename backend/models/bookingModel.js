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
        startTime: "17:00",
        endTime: "20:00",
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
    },
    // Multi-Year Historical & Future Sample Bookings (2023, 2024, 2025, 2026, 2027)
    {
        id: "BOOK-2023-01",
        customerName: "Prof. Arvind Joshi",
        mobileNumber: "9821098765",
        eventName: "State Educational Symposium 2023",
        hall: "Hall 1",
        bookingDate: "2023-04-12",
        startTime: "09:00",
        endTime: "17:00",
        status: "Completed",
        notes: "State-level educational seminar and presentation sessions.",
        contract: {
            hallRent: 20000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2023-01", title: "Event Completed", description: "Educational symposium concluded successfully.", category: "Booking", timestamp: "2023-04-12T18:00:00.000Z", date: "2023-04-12", time: "18:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2023-02",
        customerName: "Dr. Meenakshi Rao",
        mobileNumber: "9833221100",
        eventName: "Alumni Reunion Meet 2023",
        hall: "Hall 2",
        bookingDate: "2023-08-19",
        startTime: "11:00",
        endTime: "16:00",
        status: "Completed",
        notes: "Golden jubilee batch alumni gathering.",
        contract: {
            hallRent: 15000,
            securityDeposit: 3000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2023-02", title: "Event Completed", description: "Alumni reunion completed.", category: "Booking", timestamp: "2023-08-19T17:00:00.000Z", date: "2023-08-19", time: "17:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2023-03",
        customerName: "Sanjay Shinde",
        mobileNumber: "9867543210",
        eventName: "Inter-University Cultural Fest 2023",
        hall: "Hall 1",
        bookingDate: "2023-11-25",
        startTime: "14:00",
        endTime: "21:00",
        status: "Completed",
        notes: "Cultural drama and musical evening.",
        contract: {
            hallRent: 22000,
            securityDeposit: 4000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2023-03", title: "Event Completed", description: "Cultural fest concluded.", category: "Booking", timestamp: "2023-11-25T22:00:00.000Z", date: "2023-11-25", time: "22:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2024-01",
        customerName: "Dr. Sandeep Kulkarni",
        mobileNumber: "9822011223",
        eventName: "National Tech Summit 2024",
        hall: "Hall 1",
        bookingDate: "2024-03-15",
        startTime: "09:00",
        endTime: "17:00",
        status: "Completed",
        notes: "Full day conference with audio-visual recording.",
        contract: {
            hallRent: 25000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2024-01", title: "Event Completed", description: "Event completed successfully.", category: "Booking", timestamp: "2024-03-15T18:00:00.000Z", date: "2024-03-15", time: "18:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2024-02",
        customerName: "Prof. Sunita Deshmukh",
        mobileNumber: "9833445566",
        eventName: "Annual Convocation Ceremony 2024",
        hall: "Hall 1",
        bookingDate: "2024-07-20",
        startTime: "10:00",
        endTime: "14:00",
        status: "Completed",
        notes: "Stage arrangement for 200 guests.",
        contract: {
            hallRent: 30000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2024-02", title: "Event Completed", description: "Convocation ceremony completed.", category: "Booking", timestamp: "2024-07-20T15:00:00.000Z", date: "2024-07-20", time: "15:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2024-03",
        customerName: "Dr. Nitin Gadre",
        mobileNumber: "9844556677",
        eventName: "Biotechnology Research Symposium",
        hall: "Hall 2",
        bookingDate: "2024-09-10",
        startTime: "11:00",
        endTime: "16:00",
        status: "Completed",
        notes: "Lab projector setup.",
        contract: {
            hallRent: 15000,
            securityDeposit: 3000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2024-03", title: "Event Completed", description: "Symposium concluded.", category: "Booking", timestamp: "2024-09-10T17:00:00.000Z", date: "2024-09-10", time: "17:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2024-04",
        customerName: "Prof. Ananya Sen",
        mobileNumber: "9855667788",
        eventName: "Faculty Cultural & Music Night",
        hall: "Hall 2",
        bookingDate: "2024-11-05",
        startTime: "18:00",
        endTime: "21:30",
        status: "Completed",
        notes: "Stage lighting and sound checks.",
        contract: {
            hallRent: 12000,
            securityDeposit: 2000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2024-04", title: "Event Completed", description: "Event completed.", category: "Booking", timestamp: "2024-11-05T22:00:00.000Z", date: "2024-11-05", time: "22:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2025-01",
        customerName: "Dr. Vikram Joshi",
        mobileNumber: "9866778899",
        eventName: "Global AI & Robotics Conclave 2025",
        hall: "Hall 1",
        bookingDate: "2025-02-14",
        startTime: "09:00",
        endTime: "18:00",
        status: "Completed",
        notes: "International keynote speakers.",
        contract: {
            hallRent: 35000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2025-01", title: "Event Completed", description: "Conclave concluded.", category: "Booking", timestamp: "2025-02-14T19:00:00.000Z", date: "2025-02-14", time: "19:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2025-02",
        customerName: "Dr. Meenakshi Rao",
        mobileNumber: "9877889900",
        eventName: "International Medical & Healthcare Seminar",
        hall: "Hall 1",
        bookingDate: "2025-05-18",
        startTime: "10:00",
        endTime: "15:00",
        status: "Completed",
        notes: "Medical equipment display area requested.",
        contract: {
            hallRent: 28000,
            securityDeposit: 4000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2025-02", title: "Event Completed", description: "Seminar completed.", category: "Booking", timestamp: "2025-05-18T16:00:00.000Z", date: "2025-05-18", time: "16:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2025-03",
        customerName: "Prof. Chetan Bhagat",
        mobileNumber: "9888990011",
        eventName: "Inter-College Debate Championship",
        hall: "Hall 2",
        bookingDate: "2025-08-22",
        startTime: "11:00",
        endTime: "16:00",
        status: "Completed",
        notes: "Podium and mic arrangement for 16 teams.",
        contract: {
            hallRent: 18000,
            securityDeposit: 3000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2025-03", title: "Event Completed", description: "Debate event finished.", category: "Booking", timestamp: "2025-08-22T17:00:00.000Z", date: "2025-08-22", time: "17:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2025-04",
        customerName: "Dr. Suresh Nair",
        mobileNumber: "9899001122",
        eventName: "IEEE Regional Engineering Summit",
        hall: "Hall 1",
        bookingDate: "2025-10-12",
        startTime: "09:30",
        endTime: "17:30",
        status: "Completed",
        notes: "Exhibition stalls and keynote area.",
        contract: {
            hallRent: 40000,
            securityDeposit: 6000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2025-04", title: "Event Completed", description: "Summit concluded.", category: "Booking", timestamp: "2025-10-12T18:00:00.000Z", date: "2025-10-12", time: "18:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2025-05",
        customerName: "Prof. Smita Patil",
        mobileNumber: "9811224455",
        eventName: "Startup & Entrepreneurship Expo",
        hall: "Hall 2",
        bookingDate: "2025-12-04",
        startTime: "10:00",
        endTime: "16:00",
        status: "Completed",
        notes: "Display tables and banner stands.",
        contract: {
            hallRent: 22000,
            securityDeposit: 4000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2025-05", title: "Event Completed", description: "Expo closed.", category: "Booking", timestamp: "2025-12-04T17:00:00.000Z", date: "2025-12-04", time: "17:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2026-05",
        customerName: "Dean Office",
        mobileNumber: "9822334455",
        eventName: "Quarterly Academic Senate Assembly",
        hall: "Hall 1",
        bookingDate: "2026-04-10",
        startTime: "10:00",
        endTime: "13:00",
        status: "Completed",
        notes: "Senate members meeting.",
        contract: {
            hallRent: 20000,
            securityDeposit: 3000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2026-05", title: "Booking Created", description: "Senate meeting booked.", category: "Booking", timestamp: "2026-04-10T09:00:00.000Z", date: "2026-04-10", time: "09:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2026-06",
        customerName: "Prof. T. Agarwal",
        mobileNumber: "9833556677",
        eventName: "Spring Inter-College Hackathon 2026",
        hall: "Hall 2",
        bookingDate: "2026-05-25",
        startTime: "09:00",
        endTime: "21:00",
        status: "Completed",
        notes: "Extended overnight networking.",
        contract: {
            hallRent: 16000,
            securityDeposit: 2000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2026-06", title: "Booking Created", description: "Hackathon scheduled.", category: "Booking", timestamp: "2026-05-25T08:30:00.000Z", date: "2026-05-25", time: "08:30:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2026-07",
        customerName: "Alumni Association",
        mobileNumber: "9844667788",
        eventName: "Silver Jubilee Alumni Reunion Gala",
        hall: "Hall 1",
        bookingDate: "2026-11-15",
        startTime: "17:00",
        endTime: "22:00",
        status: "Confirmed",
        notes: "Banquet dinner setup.",
        contract: {
            hallRent: 30000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2026-07", title: "Booking Created", description: "Alumni gala booked.", category: "Booking", timestamp: "2026-08-01T10:00:00.000Z", date: "2026-08-01", time: "10:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2027-01",
        customerName: "Global Education Council",
        mobileNumber: "9855778899",
        eventName: "World Education Forum 2027",
        hall: "Hall 1",
        bookingDate: "2027-02-20",
        startTime: "09:00",
        endTime: "18:00",
        status: "Confirmed",
        notes: "Early booking for international delegates.",
        contract: {
            hallRent: 45000,
            securityDeposit: 10000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2027-01", title: "Booking Created", description: "World Forum 2027 reserved.", category: "Booking", timestamp: "2026-08-10T11:00:00.000Z", date: "2026-08-10", time: "11:00:00", user: "Admin" }
        ]
    },
    {
        id: "BOOK-2027-02",
        customerName: "National Physics Society",
        mobileNumber: "9866889900",
        eventName: "National Physics Olympiad 2027",
        hall: "Hall 2",
        bookingDate: "2027-04-15",
        startTime: "10:00",
        endTime: "16:00",
        status: "Confirmed",
        notes: "Exam halls setup with spaced seating.",
        contract: {
            hallRent: 25000,
            securityDeposit: 5000,
            baseDiscount: 0,
            discountsList: [],
            extraChargesList: []
        },
        timeline: [
            { id: "TL-2027-02", title: "Booking Created", description: "Olympiad booked.", category: "Booking", timestamp: "2026-08-12T14:00:00.000Z", date: "2026-08-12", time: "14:00:00", user: "Admin" }
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

    /**
     * Yearly Statistics & Multi-Year Aggregation Engine
     */
    static getYearlyStats(filterYear = null) {
        const PaymentModel = require('./paymentModel');
        const allBookings = bookingsStore;
        
        // Find distinct years from all bookings
        const yearsSet = new Set();
        allBookings.forEach(b => {
            if (b.bookingDate) {
                const yr = b.bookingDate.split('-')[0];
                if (yr && yr.length === 4) yearsSet.add(yr);
            }
        });

        // Ensure current year is always represented
        const currentYearStr = String(new Date().getFullYear());
        yearsSet.add(currentYearStr);

        const availableYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a)); // e.g. 2027, 2026, 2025, 2024

        // Initialize yearly buckets
        const yearlyMap = {};
        availableYears.forEach(year => {
            yearlyMap[year] = {
                year,
                totalEvents: 0,
                activeEvents: 0, // Confirmed + Booked
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

        // Populate yearly data from bookings
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

            // Hall Breakdown
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

            // Monthly breakdown (1-12)
            if (monthIdx >= 1 && monthIdx <= 12) {
                const mData = yData.monthlyDistribution[monthIdx - 1];
                mData.totalEvents += 1;
                if (hallName === 'Hall 1') mData.hall1Events += 1;
                else if (hallName === 'Hall 2') mData.hall2Events += 1;

                if (isEffectiveEvent) {
                    mData.revenue += netRentPaid;
                }
            }

            // Push enriched booking item
            yData.events.push({
                ...booking,
                financial: fin
            });
        });

        // Compute percentages for hall breakdowns
        Object.keys(yearlyMap).forEach(year => {
            const yData = yearlyMap[year];
            const total = yData.totalEvents || 1;
            Object.keys(yData.hallBreakdown).forEach(hName => {
                const hStats = yData.hallBreakdown[hName];
                hStats.percentage = Math.round((hStats.totalEvents / total) * 100);
            });
        });

        const yearlySummaries = availableYears.map(yr => yearlyMap[yr]);

        // Grand all-time totals
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

    /**
     * Day Slot Statistics & Analytics Engine
     * Groups events on targetDate into:
     * - Morning:   06:00 to 11:59 (360 to < 720 mins)
     * - Afternoon: 12:00 to 15:59 (720 to < 960 mins)
     * - Evening:   16:00 to 19:59 (960 to < 1200 mins)
     * - Night:     20:00 to 05:59 (>= 1200 mins or < 360 mins, wraps midnight)
     */
    static getDaySlotStats(targetDate = null) {
        const PaymentModel = require('./paymentModel');
        const defaultDate = getFormattedDate(0);
        const selectedDate = (targetDate && typeof targetDate === 'string' && targetDate.trim()) ? targetDate.trim() : defaultDate;

        const allBookings = bookingsStore;
        const dateBookings = allBookings.filter(b => b.bookingDate === selectedDate);

        // Helper to determine slot key from time string "HH:MM"
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

            // Push enriched booking item
            const enriched = {
                ...booking,
                slotKey,
                slotName: slot.name,
                slotTimeRange: slot.timeRange,
                financial: fin
            };
            slot.events.push(enriched);
        });

        // Sort events in each slot by startTime
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

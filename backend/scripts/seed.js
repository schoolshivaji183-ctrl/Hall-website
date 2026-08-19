/**
 * MongoDB Atlas Master Seeding Script
 * 
 * Inserts Master Halls, Users, Multi-Year Bookings (2023–2027),
 * Financial Ledger Transactions, and Audit Trail into MongoDB Atlas.
 * 
 * Usage:
 *   npm run seed
 *   node backend/scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Hall } = require('../models/schemas/HallSchema');
const { User } = require('../models/schemas/UserSchema');
const { Booking } = require('../models/schemas/BookingSchema');
const { Payment } = require('../models/schemas/PaymentSchema');
const { AuditLog } = require('../models/schemas/AuditLogSchema');

// Master Halls Seed Data
const hallsData = [
    {
        hallId: "HALL-01",
        name: "Hall 1",
        capacity: 350,
        basePricePerHour: 2500,
        basePricePerDay: 15000,
        amenities: ["HD Laser Projector", "Central Air Conditioning", "Surround Sound Array", "Podium with Mic", "Stage Lighting"],
        location: "Main Academic Block - Ground Floor",
        isActive: true
    },
    {
        hallId: "HALL-02",
        name: "Hall 2",
        capacity: 180,
        basePricePerHour: 1800,
        basePricePerDay: 10000,
        amenities: ["Interactive Smart Display", "Air Conditioning", "PA Sound System", "High-speed Wi-Fi", "Green Room"],
        location: "Convention Wing - 2nd Floor",
        isActive: true
    }
];

// Master Users Seed Data
const usersData = [
    {
        username: "admin",
        name: "System Administrator",
        email: "admin@hallmanager.edu",
        role: "Admin",
        department: "Estate & Operations",
        isActive: true
    },
    {
        username: "faculty_coord",
        name: "Dr. Faculty Coordinator",
        email: "faculty@hallmanager.edu",
        role: "Faculty",
        department: "Academic Affairs",
        isActive: true
    },
    {
        username: "staff_desk",
        name: "Staff Desk Officer",
        email: "desk@hallmanager.edu",
        role: "Staff",
        department: "Facility Booking Desk",
        isActive: true
    }
];

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

// Multi-Year Bookings Seed Data (2023–2027)
const bookingsData = [
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
    // 2023
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
        notes: "State-level educational seminar.",
        contract: { hallRent: 20000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2023-01", title: "Event Completed", description: "Concluded successfully.", category: "Booking", timestamp: "2023-04-12T18:00:00.000Z", date: "2023-04-12", time: "18:00:00", user: "Admin" }]
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
        notes: "Alumni gathering.",
        contract: { hallRent: 15000, securityDeposit: 3000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2023-02", title: "Event Completed", description: "Completed.", category: "Booking", timestamp: "2023-08-19T17:00:00.000Z", date: "2023-08-19", time: "17:00:00", user: "Admin" }]
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
        notes: "Cultural drama and music.",
        contract: { hallRent: 22000, securityDeposit: 4000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2023-03", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2023-11-25T22:00:00.000Z", date: "2023-11-25", time: "22:00:00", user: "Admin" }]
    },
    // 2024
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
        notes: "Full day tech conference.",
        contract: { hallRent: 25000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2024-01", title: "Event Completed", description: "Completed.", category: "Booking", timestamp: "2024-03-15T18:00:00.000Z", date: "2024-03-15", time: "18:00:00", user: "Admin" }]
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
        notes: "Convocation ceremony for graduates.",
        contract: { hallRent: 30000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2024-02", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2024-07-20T15:00:00.000Z", date: "2024-07-20", time: "15:00:00", user: "Admin" }]
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
        notes: "Symposium.",
        contract: { hallRent: 15000, securityDeposit: 3000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2024-03", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2024-09-10T17:00:00.000Z", date: "2024-09-10", time: "17:00:00", user: "Admin" }]
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
        notes: "Music night.",
        contract: { hallRent: 12000, securityDeposit: 2000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2024-04", title: "Event Completed", description: "Completed.", category: "Booking", timestamp: "2024-11-05T22:00:00.000Z", date: "2024-11-05", time: "22:00:00", user: "Admin" }]
    },
    // 2025
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
        notes: "International keynote.",
        contract: { hallRent: 35000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2025-01", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2025-02-14T19:00:00.000Z", date: "2025-02-14", time: "19:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2025-02",
        customerName: "Dr. Kavita Sharma",
        mobileNumber: "9877889900",
        eventName: "National Medical Ethics Seminar",
        hall: "Hall 2",
        bookingDate: "2025-05-18",
        startTime: "10:00",
        endTime: "15:00",
        status: "Completed",
        notes: "Seminar.",
        contract: { hallRent: 18000, securityDeposit: 3000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2025-02", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2025-05-18T16:00:00.000Z", date: "2025-05-18", time: "16:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2025-03",
        customerName: "Rakesh Verma",
        mobileNumber: "9888990011",
        eventName: "Inter-Collegiate Youth Festival 2025",
        hall: "Hall 1",
        bookingDate: "2025-08-22",
        startTime: "13:00",
        endTime: "20:00",
        status: "Completed",
        notes: "Youth festival.",
        contract: { hallRent: 28000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2025-03", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2025-08-22T21:00:00.000Z", date: "2025-08-22", time: "21:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2025-04",
        customerName: "Prof. Manisha Patil",
        mobileNumber: "9899001122",
        eventName: "Annual Drama Club Production",
        hall: "Hall 2",
        bookingDate: "2025-11-12",
        startTime: "17:00",
        endTime: "21:00",
        status: "Completed",
        notes: "Drama production.",
        contract: { hallRent: 16000, securityDeposit: 3000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2025-04", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2025-11-12T22:00:00.000Z", date: "2025-11-12", time: "22:00:00", user: "Admin" }]
    },
    // 2026
    {
        id: "BOOK-2026-01",
        customerName: "Dr. Rajeshwar Singh",
        mobileNumber: "9811224455",
        eventName: "International Green Energy Summit 2026",
        hall: "Hall 1",
        bookingDate: "2026-01-20",
        startTime: "09:00",
        endTime: "17:00",
        status: "Completed",
        notes: "Green energy summit.",
        contract: { hallRent: 24000, securityDeposit: 4000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2026-01", title: "Event Completed", description: "Completed.", category: "Booking", timestamp: "2026-01-20T18:00:00.000Z", date: "2026-01-20", time: "18:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2026-02",
        customerName: "Prof. Priya Nair",
        mobileNumber: "9822335566",
        eventName: "Space Technology & Satellite Colloquium",
        hall: "Hall 2",
        bookingDate: "2026-03-10",
        startTime: "10:00",
        endTime: "14:00",
        status: "Completed",
        notes: "Space colloquium.",
        contract: { hallRent: 14000, securityDeposit: 2000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2026-02", title: "Event Completed", description: "Completed.", category: "Booking", timestamp: "2026-03-10T15:00:00.000Z", date: "2026-03-10", time: "15:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2026-03",
        customerName: "Dr. Alok Sen",
        mobileNumber: "9833446677",
        eventName: "National Conference on Nanomaterials 2026",
        hall: "Hall 1",
        bookingDate: "2026-05-14",
        startTime: "09:00",
        endTime: "18:00",
        status: "Completed",
        notes: "Nanomaterials conference.",
        contract: { hallRent: 32000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2026-03", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2026-05-14T19:00:00.000Z", date: "2026-05-14", time: "19:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2026-04",
        customerName: "Prof. Shilpa Roy",
        mobileNumber: "9844557788",
        eventName: "Fine Arts Exhibition & Auction",
        hall: "Hall 2",
        bookingDate: "2026-07-08",
        startTime: "16:00",
        endTime: "21:00",
        status: "Completed",
        notes: "Fine arts exhibition.",
        contract: { hallRent: 15000, securityDeposit: 3000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2026-04", title: "Event Completed", description: "Concluded.", category: "Booking", timestamp: "2026-07-08T22:00:00.000Z", date: "2026-07-08", time: "22:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2026-05",
        customerName: "Dr. Hemant Kulkarni",
        mobileNumber: "9855668899",
        eventName: "All-India Hackathon Grand Finale 2026",
        hall: "Hall 1",
        bookingDate: "2026-09-18",
        startTime: "09:00",
        endTime: "21:00",
        status: "Confirmed",
        notes: "Hackathon.",
        contract: { hallRent: 40000, securityDeposit: 8000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2026-05", title: "Booking Created", description: "Confirmed.", category: "Booking", timestamp: "2026-07-15T10:00:00.000Z", date: "2026-07-15", time: "10:00:00", user: "Admin" }]
    },
    {
        id: "BOOK-2026-06",
        customerName: "Prof. Devendra Joshi",
        mobileNumber: "9866779900",
        eventName: "Annual Alumni Association Gala 2026",
        hall: "Hall 1",
        bookingDate: "2026-11-20",
        startTime: "18:00",
        endTime: "22:30",
        status: "Confirmed",
        notes: "Alumni gala.",
        contract: { hallRent: 30000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2026-06", title: "Booking Created", description: "Confirmed.", category: "Booking", timestamp: "2026-08-01T10:00:00.000Z", date: "2026-08-01", time: "10:00:00", user: "Admin" }]
    },
    // 2027
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
        notes: "World forum.",
        contract: { hallRent: 45000, securityDeposit: 10000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2027-01", title: "Booking Created", description: "Confirmed.", category: "Booking", timestamp: "2026-08-10T11:00:00.000Z", date: "2026-08-10", time: "11:00:00", user: "Admin" }]
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
        notes: "Physics olympiad.",
        contract: { hallRent: 25000, securityDeposit: 5000, baseDiscount: 0, discountsList: [], extraChargesList: [] },
        timeline: [{ id: "TL-2027-02", title: "Booking Created", description: "Confirmed.", category: "Booking", timestamp: "2026-08-12T14:00:00.000Z", date: "2026-08-12", time: "14:00:00", user: "Admin" }]
    }
];

// Financial Transactions Seed Data
const paymentsData = [
    {
        id: "TXN-2026-1001",
        receiptNumber: "HBR-2026-0001",
        bookingId: "BOOK-1001",
        date: todayStr,
        time: "09:30:00",
        amount: 2000,
        type: "Advance",
        paymentMethod: "Cash",
        collectedBy: "Admin",
        referenceNumber: "CASH-ADV-001",
        remarks: "Advance cash payment collected at counter.",
        status: "Success",
        isVoided: false
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
        isVoided: false
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
        isVoided: false
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
        isVoided: false
    },
    {
        id: "TXN-2023-1001",
        receiptNumber: "HBR-2023-0001",
        bookingId: "BOOK-2023-01",
        date: "2023-04-12",
        time: "10:00:00",
        amount: 20000,
        type: "Rent Payment",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "NEFT-2023-1122",
        remarks: "Full rent payment for State Symposium.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2023-1002",
        receiptNumber: "HBR-2023-0002",
        bookingId: "BOOK-2023-02",
        date: "2023-08-19",
        time: "11:30:00",
        amount: 15000,
        type: "Rent Payment",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2023-5566",
        remarks: "Alumni meet rent payment via UPI.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2023-1003",
        receiptNumber: "HBR-2023-0003",
        bookingId: "BOOK-2023-03",
        date: "2023-11-25",
        time: "14:30:00",
        amount: 22000,
        type: "Rent Payment",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "RTGS-2023-8899",
        remarks: "Inter-University Fest rental settlement.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2024-1001",
        receiptNumber: "HBR-2024-0001",
        bookingId: "BOOK-2024-01",
        date: "2024-03-15",
        time: "09:30:00",
        amount: 25000,
        type: "Rent Payment",
        paymentMethod: "Credit Card",
        collectedBy: "Admin",
        referenceNumber: "CC-2024-4411",
        remarks: "National Tech Summit fee payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2024-1002",
        receiptNumber: "HBR-2024-0002",
        bookingId: "BOOK-2024-02",
        date: "2024-07-20",
        time: "10:30:00",
        amount: 30000,
        type: "Rent Payment",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "NEFT-2024-9922",
        remarks: "Convocation rental settlement.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2024-1003",
        receiptNumber: "HBR-2024-0003",
        bookingId: "BOOK-2024-03",
        date: "2024-09-10",
        time: "11:15:00",
        amount: 15000,
        type: "Rent Payment",
        paymentMethod: "Cash",
        collectedBy: "Admin",
        referenceNumber: "CASH-2024-3311",
        remarks: "Biotech symposium payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2024-1004",
        receiptNumber: "HBR-2024-0004",
        bookingId: "BOOK-2024-04",
        date: "2024-11-05",
        time: "17:30:00",
        amount: 12000,
        type: "Rent Payment",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2024-7788",
        remarks: "Music night full rental payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2025-1001",
        receiptNumber: "HBR-2025-0001",
        bookingId: "BOOK-2025-01",
        date: "2025-02-14",
        time: "09:00:00",
        amount: 35000,
        type: "Rent Payment",
        paymentMethod: "Credit Card",
        collectedBy: "Admin",
        referenceNumber: "CC-2025-9988",
        remarks: "Global AI conclave hall rent.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2025-1002",
        receiptNumber: "HBR-2025-0002",
        bookingId: "BOOK-2025-02",
        date: "2025-05-18",
        time: "10:00:00",
        amount: 18000,
        type: "Rent Payment",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2025-1144",
        remarks: "Medical seminar rent receipt.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2025-1003",
        receiptNumber: "HBR-2025-0003",
        bookingId: "BOOK-2025-03",
        date: "2025-08-22",
        time: "14:00:00",
        amount: 28000,
        type: "Rent Payment",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "RTGS-2025-3322",
        remarks: "Youth festival full payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2025-1004",
        receiptNumber: "HBR-2025-0004",
        bookingId: "BOOK-2025-04",
        date: "2025-11-12",
        time: "18:00:00",
        amount: 16000,
        type: "Rent Payment",
        paymentMethod: "Cash",
        collectedBy: "Admin",
        referenceNumber: "CASH-2025-5544",
        remarks: "Drama club performance payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2026-0001",
        receiptNumber: "HBR-2026-0011",
        bookingId: "BOOK-2026-01",
        date: "2026-01-20",
        time: "10:00:00",
        amount: 24000,
        type: "Rent Payment",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "NEFT-2026-1188",
        remarks: "Green energy seminar hall rent.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2026-0002",
        receiptNumber: "HBR-2026-0012",
        bookingId: "BOOK-2026-02",
        date: "2026-03-10",
        time: "11:00:00",
        amount: 14000,
        type: "Rent Payment",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2026-4477",
        remarks: "Space tech lecture payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2026-0003",
        receiptNumber: "HBR-2026-0013",
        bookingId: "BOOK-2026-03",
        date: "2026-05-14",
        time: "09:30:00",
        amount: 32000,
        type: "Rent Payment",
        paymentMethod: "Credit Card",
        collectedBy: "Admin",
        referenceNumber: "CC-2026-8833",
        remarks: "Biomedical conference rent.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2026-0004",
        receiptNumber: "HBR-2026-0014",
        bookingId: "BOOK-2026-04",
        date: "2026-07-08",
        time: "17:00:00",
        amount: 15000,
        type: "Rent Payment",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2026-9922",
        remarks: "Fine arts exhibition payment.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2026-0005",
        receiptNumber: "HBR-2026-0015",
        bookingId: "BOOK-2026-05",
        date: "2026-09-18",
        time: "10:00:00",
        amount: 20000,
        type: "Advance",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "NEFT-2026-5599",
        remarks: "Advance booking payment for Hackathon.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2026-0006",
        receiptNumber: "HBR-2026-0016",
        bookingId: "BOOK-2026-06",
        date: "2026-11-20",
        time: "11:00:00",
        amount: 10000,
        type: "Advance",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2026-6633",
        remarks: "Advance for Annual Gala.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2027-1001",
        receiptNumber: "HBR-2027-0001",
        bookingId: "BOOK-2027-01",
        date: "2026-08-10",
        time: "11:00:00",
        amount: 20000,
        type: "Advance",
        paymentMethod: "Bank Transfer",
        collectedBy: "Admin",
        referenceNumber: "WIRE-2026-8800",
        remarks: "Advance deposit for World Education Forum 2027.",
        status: "Success",
        isVoided: false
    },
    {
        id: "TXN-2027-1002",
        receiptNumber: "HBR-2027-0002",
        bookingId: "BOOK-2027-02",
        date: "2026-08-12",
        time: "14:00:00",
        amount: 10000,
        type: "Advance",
        paymentMethod: "UPI",
        collectedBy: "Admin",
        referenceNumber: "UPI-2026-3399",
        remarks: "Advance booking payment for Physics Olympiad 2027.",
        status: "Success",
        isVoided: false
    }
];

// Audit Trail Seed Data
const auditLogsData = [
    {
        id: "AUDIT-1001",
        module: "Booking",
        action: "Booking Created",
        targetId: "BOOK-1001",
        changes: [
            { field: "Customer & Purpose", oldVal: "N/A", newVal: "Dr. A. Sharma (AI & Data Science Workshop)" },
            { field: "Hall & Slot", oldVal: "N/A", newVal: "Hall 1 (09:00 - 12:00)" },
            { field: "Hall Rent", oldVal: "N/A", newVal: "₹10,000" },
            { field: "Security Deposit", oldVal: "N/A", newVal: "₹2,000" },
            { field: "Booking Status", oldVal: "N/A", newVal: "Confirmed" }
        ],
        oldValue: "N/A",
        newValue: "Hall: Hall 1, Rent: ₹10,000, Status: Confirmed",
        user: "Admin",
        timestamp: new Date()
    },
    {
        id: "AUDIT-1002",
        module: "Payment Ledger",
        action: "Payment Recorded (Advance)",
        targetId: "BOOK-1001",
        changes: [
            { field: "Receipt HBR-2026-0001", oldVal: "Rent Due: ₹10,000", newVal: "Paid: ₹2,000 (Cash) | Remaining Rent: ₹8,000" }
        ],
        oldValue: "Rent Due: ₹10,000",
        newValue: "Paid: ₹2,000 via Cash (Receipt: HBR-2026-0001)",
        user: "Admin",
        timestamp: new Date()
    }
];

async function seedDatabase() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri || mongoUri.includes('your_password') || mongoUri.includes('<password>')) {
        console.error('❌  Cannot seed MongoDB: Please set your valid MONGO_URI in .env first!');
        process.exit(1);
    }

    try {
        console.log('⏳  Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || 'hall_booking_erp'
        });
        console.log('🍃  Connected to MongoDB Atlas!');

        // 1. Seed Master Halls
        console.log('🏛️  Seeding Master Halls...');
        for (const hall of hallsData) {
            await Hall.findOneAndUpdate({ hallId: hall.hallId }, hall, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Halls seeded: ${hallsData.length}`);

        // 2. Seed Master Users
        console.log('👤  Seeding Master Users...');
        for (const user of usersData) {
            await User.findOneAndUpdate({ username: user.username }, user, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Users seeded: ${usersData.length}`);

        // 3. Seed Multi-Year Bookings (2023–2027)
        console.log('📅  Seeding Multi-Year Bookings (2023–2027)...');
        for (const b of bookingsData) {
            await Booking.findOneAndUpdate({ id: b.id }, b, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Bookings seeded: ${bookingsData.length}`);

        // 4. Seed Payments Ledger
        console.log('💳  Seeding Payment Ledger Transactions...');
        for (const p of paymentsData) {
            await Payment.findOneAndUpdate({ receiptNumber: p.receiptNumber }, p, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Payments seeded: ${paymentsData.length}`);

        // 5. Seed Audit Logs
        console.log('📜  Seeding Audit Logs...');
        for (const a of auditLogsData) {
            await AuditLog.findOneAndUpdate({ id: a.id }, a, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Audit logs seeded: ${auditLogsData.length}`);

        console.log('\n==================================================');
        console.log('🎉  MONGODB ATLAS SEEDING COMPLETED SUCCESSFULLY!');
        console.log('==================================================');

        await mongoose.disconnect();
        console.log('👋  Disconnected cleanly from MongoDB.');
        process.exit(0);
    } catch (err) {
        console.error('❌  Seeding failed:', err.message);
        process.exit(1);
    }
}

seedDatabase();

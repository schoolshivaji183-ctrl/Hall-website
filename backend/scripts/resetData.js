/**
 * Reset / Clean Slate Utility
 * 
 * Clears all sample/past bookings, payments, and audit logs from MongoDB Atlas
 * while preserving master Halls and Admin/Staff accounts so the client starts completely fresh.
 * 
 * Usage:
 *   npm run reset
 *   node backend/scripts/resetData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Booking } = require('../models/schemas/BookingSchema');
const { Payment } = require('../models/schemas/PaymentSchema');
const { AuditLog } = require('../models/schemas/AuditLogSchema');
const { Hall } = require('../models/schemas/HallSchema');
const { User } = require('../models/schemas/UserSchema');

// Master Halls (Preserved for fresh client use)
const hallsData = [
    {
        hallId: "HALL-01",
        name: "Hall 1",
        capacity: 350,
        basePricePerHour: 2500,
        basePricePerDay: 15000,
        amenities: ["HD Laser Projector", "Central Air Conditioning", "Surround Sound Array", "Podium with Mic", "Stage Lighting"],
        location: "Main Academic Block - Ground Floor",
        status: "available",
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
        status: "available",
        isActive: true
    }
];

// Master Users with Hashed Passwords
const usersData = [
    {
        username: "admin",
        password: bcrypt.hashSync("admin123", 10),
        name: "System Administrator",
        email: "admin@hallmanager.edu",
        role: "Admin",
        department: "Estate & Operations",
        isActive: true
    },
    {
        username: "staff",
        password: bcrypt.hashSync("staff123", 10),
        name: "Staff Desk Officer",
        email: "staff@hallmanager.edu",
        role: "Staff",
        department: "Facility Operations",
        isActive: true
    }
];

async function resetAllData() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        console.error('❌  Cannot connect: MONGO_URI in .env is missing.');
        process.exit(1);
    }

    try {
        console.log('⏳  Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || 'hall_booking_erp'
        });
        console.log('🍃  Connected to MongoDB Atlas!');

        // 1. Delete all bookings
        console.log('🧹  Clearing all bookings from Atlas...');
        const delBookings = await Booking.deleteMany({});
        console.log(`✅  Removed ${delBookings.deletedCount} past bookings.`);

        // 2. Delete all payments
        console.log('🧹  Clearing all payment transactions from Atlas...');
        const delPayments = await Payment.deleteMany({});
        console.log(`✅  Removed ${delPayments.deletedCount} past payment transactions.`);

        // 3. Delete all audit logs
        console.log('🧹  Clearing all audit log entries from Atlas...');
        const delAudit = await AuditLog.deleteMany({});
        console.log(`✅  Removed ${delAudit.deletedCount} past audit logs.`);

        // 4. Ensure Master Halls are ready
        console.log('🏛️  Ensuring Master Halls are ready...');
        for (const hall of hallsData) {
            await Hall.findOneAndUpdate({ hallId: hall.hallId }, hall, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Halls verified (Hall 1, Hall 2 ready for client bookings).`);

        // 5. Ensure Master Users are ready with Hashed Passwords
        console.log('👤  Ensuring Master Users are ready...');
        await User.deleteMany({ username: { $nin: ['admin', 'staff'] } });
        for (const user of usersData) {
            await User.findOneAndUpdate({ username: user.username }, user, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Users verified (Admin, Staff accounts ready).`);

        // 6. Log system initialization audit entry
        await AuditLog.create({
            id: `AUDIT-INIT-${Date.now()}`,
            module: 'System',
            action: 'Clean Slate Initialized',
            targetId: 'SYSTEM',
            changes: [
                { field: 'Database State', oldVal: 'Sample Data', newVal: 'Fresh Client Instance' }
            ],
            oldValue: 'Sample Data',
            newValue: 'Fresh Clean Slate',
            user: 'Admin',
            timestamp: new Date()
        });

        console.log('\n==================================================');
        console.log('✨  FRESH CLEAN SLATE COMPLETED SUCCESSFULLY!');
        console.log('📦  All past bookings & payments cleared from Atlas.');
        console.log('🏛️  Master Halls & Users ready for fresh entries.');
        console.log('==================================================');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌  Reset failed:', err.message);
        process.exit(1);
    }
}

resetAllData();

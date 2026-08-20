/**
 * MongoDB Atlas Infrastructure Master Seeding Script
 * 
 * Inserts ONLY master architectural resources (Halls & Master Admin/Staff accounts).
 * Hashes passwords with bcryptjs.
 * Zero dummy bookings, zero fake payments, zero artificial ledgers.
 * 
 * Usage:
 *   npm run seed
 *   node backend/scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Hall } = require('../models/schemas/HallSchema');
const { User } = require('../models/schemas/UserSchema');

// Master Halls (Structural Facilities)
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

// Master System Accounts with Hashed Passwords
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

async function seedMasterData() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri || mongoUri.includes('your_password') || mongoUri.includes('<password>')) {
        console.error('❌  Cannot connect: MONGO_URI in .env is not configured.');
        process.exit(1);
    }

    try {
        console.log('⏳  Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || 'hall_booking_erp'
        });
        console.log('🍃  Connected to MongoDB Atlas!');

        // 1. Seed Master Halls
        console.log('🏛️  Seeding Master Structural Halls...');
        for (const h of hallsData) {
            await Hall.findOneAndUpdate({ hallId: h.hallId }, h, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Halls verified: ${hallsData.length} (Hall 1, Hall 2)`);

        // 2. Seed Master Users (Hashed Passwords)
        console.log('👤  Seeding Master System Users (Hashed Passwords)...');
        for (const u of usersData) {
            await User.findOneAndUpdate({ username: u.username }, u, { upsert: true, returnDocument: 'after' });
        }
        console.log(`✅  Users verified: ${usersData.length} (Admin, Staff)`);

        console.log('\n==================================================');
        console.log('🎉  MASTER INFRASTRUCTURE SEEDED SUCCESSFULLY!');
        console.log('📦  No dummy bookings or fake transactions were created.');
        console.log('✨  System is ready for 100% actual client records.');
        console.log('==================================================');

        await mongoose.disconnect();
        console.log('👋  Disconnected cleanly from MongoDB.');
        process.exit(0);
    } catch (err) {
        console.error('❌  Seeding failed:', err.message);
        process.exit(1);
    }
}

seedMasterData();

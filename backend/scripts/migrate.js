/**
 * MongoDB Atlas Data Migration Utility
 * 
 * Migrates local/mock JSON backup files directly into MongoDB Atlas collections.
 * 
 * Usage:
 *   npm run migrate [optional-json-filepath]
 *   node backend/scripts/migrate.js my_data_backup.json
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Booking } = require('../models/schemas/BookingSchema');
const { Payment } = require('../models/schemas/PaymentSchema');
const { AuditLog } = require('../models/schemas/AuditLogSchema');

async function runMigration() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri || mongoUri.includes('your_password') || mongoUri.includes('<password>')) {
        console.error('❌  Cannot run migration: MONGO_URI in .env is not configured.');
        process.exit(1);
    }

    const targetFile = process.argv[2] || path.join(__dirname, '../../scratch/backup_data.json');

    if (!fs.existsSync(targetFile)) {
        console.log(`ℹ️  No external JSON file found at: ${targetFile}`);
        console.log(`ℹ️  Running in-memory repository sync migration to MongoDB Atlas...`);
    }

    try {
        console.log('⏳  Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || 'hall_booking_erp'
        });
        console.log('🍃  Connected to MongoDB Atlas!');

        let bookingsToMigrate = [];
        let paymentsToMigrate = [];
        let auditLogsToMigrate = [];

        if (fs.existsSync(targetFile)) {
            const rawContent = fs.readFileSync(targetFile, 'utf8');
            const parsedData = JSON.parse(rawContent);
            bookingsToMigrate = parsedData.bookings || [];
            paymentsToMigrate = parsedData.payments || [];
            auditLogsToMigrate = parsedData.auditLogs || [];
            console.log(`📦  Loaded from file: ${bookingsToMigrate.length} bookings, ${paymentsToMigrate.length} payments, ${auditLogsToMigrate.length} audit logs.`);
        } else {
            // Load from existing models
            const BookingModel = require('../models/bookingModel');
            const PaymentModel = require('../models/paymentModel');
            const AuditModel = require('../models/auditModel');

            bookingsToMigrate = await BookingModel.findAll();
            paymentsToMigrate = await PaymentModel.findAll();
            auditLogsToMigrate = await AuditModel.findAll();
            console.log(`📦  Loaded from repository: ${bookingsToMigrate.length} bookings, ${paymentsToMigrate.length} payments, ${auditLogsToMigrate.length} audit logs.`);
        }

        // Migrate Bookings
        console.log('📅  Migrating Bookings...');
        let bCount = 0;
        for (const b of bookingsToMigrate) {
            if (!b.id) continue;
            await Booking.findOneAndUpdate({ id: b.id }, b, { upsert: true, returnDocument: 'after' });
            bCount++;
        }
        console.log(`✅  Migrated ${bCount} bookings.`);

        // Migrate Payments
        console.log('💳  Migrating Payments...');
        let pCount = 0;
        for (const p of paymentsToMigrate) {
            if (!p.receiptNumber) continue;
            await Payment.findOneAndUpdate({ receiptNumber: p.receiptNumber }, p, { upsert: true, returnDocument: 'after' });
            pCount++;
        }
        console.log(`✅  Migrated ${pCount} payment transactions.`);

        // Migrate Audit Logs
        console.log('📜  Migrating Audit Logs...');
        let aCount = 0;
        for (const a of auditLogsToMigrate) {
            if (!a.id) continue;
            await AuditLog.findOneAndUpdate({ id: a.id }, a, { upsert: true, new: true });
            aCount++;
        }
        console.log(`✅  Migrated ${aCount} audit log records.`);

        console.log('\n==================================================');
        console.log('🎉  DATA MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('==================================================');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌  Migration error:', err.message);
        process.exit(1);
    }
}

runMigration();

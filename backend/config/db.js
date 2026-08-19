/**
 * MongoDB Atlas Connection Configuration & Manager
 * 
 * Manages Mongoose connection lifecycle, connection pooling, and error handling.
 */

const mongoose = require('mongoose');

let isDbConnected = false;

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri || mongoUri.includes('your_password') || mongoUri.includes('<password>')) {
        console.warn('⚠️  [MongoDB] MONGO_URI is not configured with valid Atlas credentials in .env.');
        console.warn('⚠️  [MongoDB] Running in offline / memory fallback mode until Atlas URI is provided.');
        return false;
    }

    try {
        const conn = await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || 'hall_booking_erp',
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        isDbConnected = true;
        console.log(`==================================================`);
        console.log(`🍃  MongoDB Atlas Connected Successfully!`);
        console.log(`📦  Host: ${conn.connection.host}`);
        console.log(`📂  Database: ${conn.connection.name}`);
        console.log(`==================================================`);

        try {
            const BookingModel = require('../models/bookingModel');
            const PaymentModel = require('../models/paymentModel');
            const AuditModel = require('../models/auditModel');
            if (BookingModel && BookingModel.syncFromDB) await BookingModel.syncFromDB();
            if (PaymentModel && PaymentModel.syncFromDB) await PaymentModel.syncFromDB();
            if (AuditModel && AuditModel.syncFromDB) await AuditModel.syncFromDB();
        } catch (syncErr) {
            console.warn('⚠️  [MongoDB] Initial sync notice:', syncErr.message);
        }

        return true;
    } catch (error) {
        console.error(`❌  [MongoDB] Connection Failed: ${error.message}`);
        console.warn(`⚠️  Please verify your MongoDB Atlas username, password, and IP Whitelist (0.0.0.0/0).`);
        isDbConnected = false;
        return false;
    }
};

mongoose.connection.on('disconnected', () => {
    isDbConnected = false;
    console.warn('⚠️  [MongoDB] Disconnected from MongoDB Atlas.');
});

mongoose.connection.on('reconnected', () => {
    isDbConnected = true;
    console.log('🔄  [MongoDB] Reconnected to MongoDB Atlas.');
});

const isConnected = () => isDbConnected && mongoose.connection.readyState === 1;

module.exports = {
    connectDB,
    isConnected,
    mongoose
};

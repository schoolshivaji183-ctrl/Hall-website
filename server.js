require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./backend/config/db');
const bookingRoutes = require('./backend/routes/bookingRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database Connection
connectDB();
const BookingModel = require('./backend/models/bookingModel');
const PaymentModel = require('./backend/models/paymentModel');
// Ensure in‑memory bookings and payments are loaded at startup
BookingModel.syncFromDB();
PaymentModel.syncFromDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', bookingRoutes);

// Redirect deprecated faculty routes to staff
app.get('/faculty*', (req, res) => {
    res.redirect('/staff');
});

// Single Page Application routing (Admin, Staff, and Fallback)
app.get('/admin*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/staff*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler (catches malformed JSON payloads and server errors)
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON format in request body.' });
    }
    console.error('Unhandled Server Error:', err.message || err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🏛️  Hall Booking Management System Running!`);
    console.log(`🌐  Local URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
});

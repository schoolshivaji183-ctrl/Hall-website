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

// Start Server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🏛️  Hall Booking Management System Running!`);
    console.log(`🌐  Local URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
});

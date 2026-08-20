const mongoose = require('mongoose');

const extraChargeSubSchema = new mongoose.Schema({
    id: { type: String, required: true },
    category: { type: String, default: 'Other Charge' },
    amount: { type: Number, required: true, min: 0 },
    remarks: { type: String, default: '' },
    addedBy: { type: String, default: 'Admin' },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
}, { _id: false });

const discountSubSchema = new mongoose.Schema({
    id: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    approvedBy: { type: String, default: 'Admin' },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
}, { _id: false });

const contractSubSchema = new mongoose.Schema({
    hallRent: { type: Number, default: 10000, min: 0 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    baseDiscount: { type: Number, default: 0, min: 0 },
    discountsList: [discountSubSchema],
    extraChargesList: [extraChargeSubSchema]
}, { _id: false });

const timelineEventSubSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['Booking', 'Financial', 'Lifecycle', 'General'], default: 'General' },
    timestamp: { type: String, default: () => new Date().toISOString() },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    time: { type: String, default: () => new Date().toTimeString().split(' ')[0] },
    user: { type: String, default: 'Admin' }
}, { _id: false });

const requirementItemSubSchema = new mongoose.Schema({
    needed: { type: Boolean, default: true },
    quantity: { type: Number, default: 0 },
    type: { type: String, default: '' },
    prepared: { type: Boolean, default: false },
    notes: { type: String, default: '' }
}, { _id: false });

const requirementsSubSchema = new mongoose.Schema({
    chairs: {
        needed: { type: Boolean, default: true },
        quantity: { type: Number, default: 100 },
        prepared: { type: Boolean, default: false },
        notes: { type: String, default: 'Standard hall seating arranged' }
    },
    sound: {
        needed: { type: Boolean, default: true },
        type: { type: String, default: 'Podium Mic & Audio Setup' },
        prepared: { type: Boolean, default: false },
        notes: { type: String, default: 'Mic & speaker sound check' }
    },
    lighting: {
        needed: { type: Boolean, default: true },
        type: { type: String, default: 'Stage & Ambient Lighting' },
        prepared: { type: Boolean, default: false },
        notes: { type: String, default: 'Hall main & stage lights' }
    },
    catering: {
        needed: { type: Boolean, default: false },
        type: { type: String, default: 'None' },
        prepared: { type: Boolean, default: false },
        notes: { type: String, default: '' }
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Ready', 'Completed'],
        default: 'Pending'
    },
    acknowledgedBy: { type: String, default: '' },
    acknowledgedAt: { type: String, default: '' },
    preparedBy: { type: String, default: '' },
    preparedAt: { type: String, default: '' },
    facultyNotes: { type: String, default: '' }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    customerName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    eventName: { type: String, required: true, trim: true },
    hall: { type: String, required: true, trim: true },
    bookingDate: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
        type: String,
        enum: ['Draft', 'Confirmed', 'Booked', 'Completed', 'Cancelled', 'Archived'],
        default: 'Confirmed'
    },
    notes: { type: String, default: '' },
    requirements: { type: requirementsSubSchema, default: () => ({}) },
    contract: { type: contractSubSchema, default: () => ({}) },
    timeline: [timelineEventSubSchema]
}, {
    timestamps: true,
    strict: false
});

// Performance & Collision Detection Indexes
bookingSchema.index({ bookingDate: 1, startTime: 1, hall: 1 });
bookingSchema.index({ hall: 1, bookingDate: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ customerName: 'text', eventName: 'text', mobileNumber: 'text' });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = {
    bookingSchema,
    Booking
};

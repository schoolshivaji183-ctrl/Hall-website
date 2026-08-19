const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    receiptNumber: { type: String, required: true, unique: true, index: true },
    bookingId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    time: { type: String, default: () => new Date().toTimeString().split(' ')[0] },
    amount: { type: Number, required: true, min: 0 },
    type: {
        type: String,
        enum: [
            'Advance',
            'Rent Payment',
            'Installment',
            'Security Deposit',
            'Deposit Return',
            'Refund',
            'Adjustment',
            'Deposit Forfeiture'
        ],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Cheque', 'Deposit', 'Card', 'Other'],
        default: 'Cash'
    },
    collectedBy: { type: String, default: 'Admin' },
    referenceNumber: { type: String, default: 'N/A' },
    remarks: { type: String, default: '' },
    status: { type: String, enum: ['Success', 'Failed', 'Pending'], default: 'Success' },
    isVoided: { type: Boolean, default: false, index: true },
    voidReason: { type: String, default: null },
    voidedBy: { type: String, default: null },
    voidedAt: { type: Date, default: null }
}, {
    timestamps: true,
    strict: false
});

// Financial Query & Ledger Indexes
paymentSchema.index({ bookingId: 1, isVoided: 1 });
paymentSchema.index({ date: 1, isVoided: 1, status: 1 });
paymentSchema.index({ paymentMethod: 1 });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = {
    paymentSchema,
    Payment
};

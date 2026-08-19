const mongoose = require('mongoose');

const hallSchema = new mongoose.Schema({
    hallId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    capacity: { type: Number, default: 200 },
    basePricePerHour: { type: Number, default: 2000 },
    basePricePerDay: { type: Number, default: 10000 },
    amenities: [{ type: String }],
    location: { type: String, default: 'Main Campus Building' },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    strict: false
});

const Hall = mongoose.models.Hall || mongoose.model('Hall', hallSchema);

module.exports = {
    hallSchema,
    Hall
};

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, default: '', trim: true },
    role: { type: String, enum: ['Admin', 'Staff'], required: true, default: 'Staff' },
    department: { type: String, default: 'General' },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    strict: false
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
    userSchema,
    User
};


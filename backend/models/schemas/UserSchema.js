const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true },
    role: { type: String, enum: ['Admin', 'Faculty', 'Staff'], default: 'Admin' },
    department: { type: String, default: 'Administration' },
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

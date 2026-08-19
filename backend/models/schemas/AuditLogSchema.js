const mongoose = require('mongoose');

const changeItemSubSchema = new mongoose.Schema({
    field: { type: String, required: true },
    oldVal: { type: String, default: 'N/A' },
    newVal: { type: String, default: 'N/A' }
}, { _id: false });

const auditLogSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    module: { type: String, required: true, index: true },
    action: { type: String, required: true },
    targetId: { type: String, required: true, index: true },
    changes: [changeItemSubSchema],
    oldValue: { type: String, default: null },
    newValue: { type: String, default: null },
    user: { type: String, default: 'Admin' },
    timestamp: { type: Date, default: Date.now, index: true },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    time: { type: String, default: () => new Date().toTimeString().split(' ')[0] }
}, {
    timestamps: false,
    strict: false
});

// Audit Trail Retrieval Indexes
auditLogSchema.index({ targetId: 1, timestamp: -1 });
auditLogSchema.index({ module: 1, timestamp: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

module.exports = {
    auditLogSchema,
    AuditLog
};

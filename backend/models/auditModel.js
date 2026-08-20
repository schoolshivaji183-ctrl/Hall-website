/**
 * System Audit Log Model & Audit Trail Repository
 * 
 * Supports MongoDB Atlas storage via Mongoose with in-memory fallback.
 */

const { AuditLog } = require('./schemas/AuditLogSchema');
const { isConnected } = require('../config/db');

let auditCounter = 1012;

// In-memory audit log store synchronized with MongoDB Atlas
let auditLogsStore = [];

class AuditModel {
    /**
     * Synchronize in-memory audit logs with MongoDB Atlas
     */
    static async syncFromDB() {
        if (isConnected()) {
            try {
                const docs = await AuditLog.find({}).sort({ timestamp: -1 }).lean();
                auditLogsStore = docs || [];
                return auditLogsStore;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to sync audit logs from Atlas:', err.message);
            }
        }
        return auditLogsStore;
    }

    /**
     * Clear all audit logs (used for clean slate resets)
     */
    static clearStore() {
        auditLogsStore = [];
    }

    /**
     * Create a new immutable audit log record
     */
    static async log({ module, action, targetId, changes = [], oldValue = null, newValue = null, user = 'Admin' }) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const logId = `AUDIT-${Date.now().toString().slice(-6)}-${randomSuffix}`;

        const logEntry = {
            id: logId,
            module: module || 'General',
            action: action || 'Action Performed',
            targetId: targetId || 'N/A',
            changes: Array.isArray(changes) ? changes : [],
            oldValue: oldValue !== null ? String(oldValue) : null,
            newValue: newValue !== null ? String(newValue) : null,
            user: user || 'Admin',
            timestamp: now,
            date: dateStr,
            time: timeStr
        };

        // Always keep in memory buffer
        auditLogsStore.push({ ...logEntry, timestamp: now.toISOString() });

        // If MongoDB Atlas is connected, persist to collection
        if (isConnected()) {
            try {
                await AuditLog.create(logEntry);
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to persist audit log:', err.message);
            }
        }

        return logEntry;
    }

    /**
     * Retrieve audit history for a specific booking target ID
     */
    static async findByBookingId(targetId) {
        if (!targetId) return [];

        if (isConnected()) {
            try {
                const logs = await AuditLog.find({ targetId }).sort({ timestamp: -1 }).lean();
                if (logs && logs.length > 0) return logs;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Audit query error, falling back to memory:', err.message);
            }
        }

        return auditLogsStore
            .filter(a => a.targetId === targetId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Retrieve all audit logs with optional filtering
     */
    static async findAll(filters = {}) {
        if (isConnected()) {
            try {
                const query = {};
                if (filters.module && filters.module !== 'All') {
                    query.module = filters.module;
                }
                if (filters.targetId) {
                    query.targetId = filters.targetId;
                }
                if (filters.search) {
                    const regex = new RegExp(filters.search.trim(), 'i');
                    query.$or = [
                        { id: regex },
                        { action: regex },
                        { targetId: regex },
                        { user: regex },
                        { module: regex },
                        { oldValue: regex },
                        { newValue: regex }
                    ];
                }

                const logs = await AuditLog.find(query).sort({ timestamp: -1 }).lean();
                if (logs) return logs;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Audit findAll error, falling back to memory:', err.message);
            }
        }

        let results = [...auditLogsStore];

        if (filters.module && filters.module !== 'All') {
            results = results.filter(a => a.module === filters.module);
        }

        if (filters.targetId) {
            results = results.filter(a => a.targetId === filters.targetId);
        }

        if (filters.search) {
            const query = filters.search.toLowerCase().trim();
            results = results.filter(a =>
                (a.id || '').toLowerCase().includes(query) ||
                (a.action || '').toLowerCase().includes(query) ||
                (a.targetId || '').toLowerCase().includes(query) ||
                (a.user || '').toLowerCase().includes(query) ||
                (a.module || '').toLowerCase().includes(query) ||
                (a.changes && JSON.stringify(a.changes).toLowerCase().includes(query)) ||
                (a.oldValue && a.oldValue.toLowerCase().includes(query)) ||
                (a.newValue && a.newValue.toLowerCase().includes(query))
            );
        }

        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return results;
    }
}

module.exports = AuditModel;

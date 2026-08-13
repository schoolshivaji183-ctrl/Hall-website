/**
 * System Audit Log Model & Audit Trail Repository
 * 
 * DESIGN RATIONALE FOR ENTERPRISE AUDIT INTEGRITY:
 * Tracks every system action (Booking Created, Status Updated, Payment Recorded,
 * Extra Charge Added, Discount Applied, Receipt Voided, Deposit Action Processed).
 * When migrating to MongoDB Atlas, map to an AuditLog collection schema.
 */

let auditCounter = 1004;

let auditLogsStore = [
    {
        id: "AUDIT-1001",
        module: "Booking",
        action: "Booking Created",
        targetId: "BOOK-1001",
        changes: [
            { field: "Customer & Purpose", oldVal: "N/A", newVal: "Dr. A. Sharma (AI & Data Science Workshop)" },
            { field: "Hall & Slot", oldVal: "N/A", newVal: "Hall 1 (09:00 - 12:00)" },
            { field: "Hall Rent", oldVal: "N/A", newVal: "₹10,000" },
            { field: "Security Deposit", oldVal: "N/A", newVal: "₹2,000" },
            { field: "Booking Status", oldVal: "N/A", newVal: "Confirmed" }
        ],
        oldValue: "N/A",
        newValue: "Hall: Hall 1, Rent: ₹10,000, Status: Confirmed",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "09:00:00"
    },
    {
        id: "AUDIT-1002",
        module: "Payment Ledger",
        action: "Payment Recorded (Advance)",
        targetId: "BOOK-1001",
        changes: [
            { field: "Receipt HBR-2026-0001", oldVal: "Rent Due: ₹10,000", newVal: "Paid: ₹2,000 (Cash) | Remaining Rent: ₹8,000" }
        ],
        oldValue: "Rent Due: ₹10,000",
        newValue: "Paid: ₹2,000 via Cash (Receipt: HBR-2026-0001)",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "09:30:00"
    },
    {
        id: "AUDIT-1003",
        module: "Financial Contract",
        action: "Extra Charge Added",
        targetId: "BOOK-1001",
        changes: [
            { field: "Extra Charge (Electricity Charge)", oldVal: "₹0", newVal: "+₹500 (Generator backup)" }
        ],
        oldValue: "Total Extra Charges: ₹0",
        newValue: "Electricity Charge: +₹500 (Generator backup)",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "10:00:00"
    }
];

class AuditModel {
    /**
     * Create a new immutable audit log record with field-level diffs
     */
    static log({ module, action, targetId, changes = [], oldValue = null, newValue = null, user = 'Admin' }) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];

        const logEntry = {
            id: `AUDIT-${auditCounter++}`,
            module: module || 'General',
            action: action || 'Action Performed',
            targetId: targetId || 'N/A',
            changes: Array.isArray(changes) ? changes : [],
            oldValue: oldValue !== null ? String(oldValue) : null,
            newValue: newValue !== null ? String(newValue) : null,
            user: user || 'Admin',
            timestamp: now.toISOString(),
            date: dateStr,
            time: timeStr
        };

        auditLogsStore.push(logEntry);
        return logEntry;
    }

    /**
     * Retrieve audit history for a specific booking target ID
     */
    static findByBookingId(targetId) {
        return auditLogsStore.filter(a => a.targetId === targetId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Retrieve all audit logs with optional filtering
     */
    static findAll(filters = {}) {
        let results = [...auditLogsStore];

        if (filters.module && filters.module !== 'All') {
            results = results.filter(a => a.module === filters.module);
        }

        if (filters.targetId) {
            results = results.filter(a => a.targetId === filters.targetId);
        }

        if (filters.search) {
            const query = filters.search.toLowerCase();
            results = results.filter(a =>
                a.action.toLowerCase().includes(query) ||
                a.targetId.toLowerCase().includes(query) ||
                a.user.toLowerCase().includes(query)
            );
        }

        // Sort newest first
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return results;
    }
}

module.exports = AuditModel;

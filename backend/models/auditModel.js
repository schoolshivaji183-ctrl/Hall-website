/**
 * System Audit Log Model & Audit Trail Repository
 * 
 * DESIGN RATIONALE FOR ENTERPRISE AUDIT INTEGRITY:
 * Tracks every system action (Booking Created, Status Updated, Payment Recorded,
 * Extra Charge Added, Discount Applied, Receipt Voided, Deposit Action Processed).
 * When migrating to MongoDB Atlas, map to an AuditLog collection schema.
 */

let auditCounter = 1012;

let auditLogsStore = [
    // BOOK-1001 (Dr. A. Sharma)
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
    },
    {
        id: "AUDIT-1004",
        module: "Payment Ledger",
        action: "Payment Recorded (Security Deposit)",
        targetId: "BOOK-1001",
        changes: [
            { field: "Receipt HBR-2026-0002", oldVal: "Deposit Held: ₹0", newVal: "Paid: ₹2,000 (UPI) | Deposit Held: ₹2,000" }
        ],
        oldValue: "Deposit Held: ₹0",
        newValue: "Paid: ₹2,000 via UPI (Receipt: HBR-2026-0002)",
        user: "Staff - Rahul",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "10:15:00"
    },
    // BOOK-1002 (Prof. R. Mehta)
    {
        id: "AUDIT-1005",
        module: "Booking",
        action: "Booking Created",
        targetId: "BOOK-1002",
        changes: [
            { field: "Customer & Purpose", oldVal: "N/A", newVal: "Prof. R. Mehta (Annual Faculty Meeting)" },
            { field: "Hall & Slot", oldVal: "N/A", newVal: "Hall 2 (14:00 - 16:30)" },
            { field: "Hall Rent", oldVal: "N/A", newVal: "₹12,000" },
            { field: "Security Deposit", oldVal: "N/A", newVal: "₹2,000" },
            { field: "Booking Status", oldVal: "N/A", newVal: "Confirmed" }
        ],
        oldValue: "N/A",
        newValue: "Hall: Hall 2, Rent: ₹12,000, Status: Confirmed",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "10:00:00"
    },
    {
        id: "AUDIT-1006",
        module: "Payment Ledger",
        action: "Payment Recorded (Rent Payment)",
        targetId: "BOOK-1002",
        changes: [
            { field: "Receipt HBR-2026-0003", oldVal: "Rent Due: ₹12,000", newVal: "Paid: ₹12,000 (Credit Card) | Remaining Rent: ₹0" }
        ],
        oldValue: "Rent Due: ₹12,000",
        newValue: "Paid: ₹12,000 via Credit Card (Receipt: HBR-2026-0003)",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "11:00:00"
    },
    {
        id: "AUDIT-1007",
        module: "Payment Ledger",
        action: "Payment Recorded (Security Deposit)",
        targetId: "BOOK-1002",
        changes: [
            { field: "Receipt HBR-2026-0004", oldVal: "Deposit Held: ₹0", newVal: "Paid: ₹2,000 (UPI) | Deposit Held: ₹2,000" }
        ],
        oldValue: "Deposit Held: ₹0",
        newValue: "Paid: ₹2,000 via UPI (Receipt: HBR-2026-0004)",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "11:05:00"
    },
    // BOOK-1003 (Er. V. Patel)
    {
        id: "AUDIT-1008",
        module: "Booking",
        action: "Booking Created",
        targetId: "BOOK-1003",
        changes: [
            { field: "Customer & Purpose", oldVal: "N/A", newVal: "Er. V. Patel (Cybersecurity Guest Lecture)" },
            { field: "Hall & Slot", oldVal: "N/A", newVal: "Hall 1 (10:00 - 13:00)" },
            { field: "Hall Rent", oldVal: "N/A", newVal: "₹15,000" },
            { field: "Initial Discount", oldVal: "N/A", newVal: "-₹2,000" },
            { field: "Security Deposit", oldVal: "N/A", newVal: "₹3,000" },
            { field: "Booking Status", oldVal: "N/A", newVal: "Confirmed" }
        ],
        oldValue: "N/A",
        newValue: "Hall: Hall 1, Rent: ₹15,000, Status: Confirmed",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "11:00:00"
    },
    {
        id: "AUDIT-1009",
        module: "Financial Contract",
        action: "Extra Charge Added",
        targetId: "BOOK-1003",
        changes: [
            { field: "Extra Charge (Cleaning Charge)", oldVal: "₹0", newVal: "+₹1,000 (Deep clean post-event)" }
        ],
        oldValue: "Total Extra Charges: ₹0",
        newValue: "Cleaning Charge: +₹1,000 (Deep clean post-event)",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "11:30:00"
    },
    // BOOK-1004 (Dr. K. Verma)
    {
        id: "AUDIT-1010",
        module: "Booking",
        action: "Draft Booking Created",
        targetId: "BOOK-1004",
        changes: [
            { field: "Customer & Purpose", oldVal: "N/A", newVal: "Dr. K. Verma (Robotics Exhibition Prep)" },
            { field: "Hall & Slot", oldVal: "N/A", newVal: "Hall 2 (11:00 - 15:00)" },
            { field: "Hall Rent", oldVal: "N/A", newVal: "₹20,000" },
            { field: "Security Deposit", oldVal: "N/A", newVal: "₹5,000" },
            { field: "Booking Status", oldVal: "N/A", newVal: "Draft" }
        ],
        oldValue: "N/A",
        newValue: "Hall: Hall 2, Rent: ₹20,000, Status: Draft",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "12:00:00"
    },
    {
        id: "AUDIT-1011",
        module: "Financial Contract",
        action: "Extra Charge Added",
        targetId: "BOOK-1004",
        changes: [
            { field: "Extra Charge (Decoration Charge)", oldVal: "₹0", newVal: "+₹2,000 (Stage decoration setup)" }
        ],
        oldValue: "Total Extra Charges: ₹0",
        newValue: "Decoration Charge: +₹2,000 (Stage decoration setup)",
        user: "Admin",
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: "12:15:00"
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
        if (!targetId) return [];
        return auditLogsStore.filter(a => a.targetId === targetId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Retrieve all audit logs with optional filtering (for System-Wide View)
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

        // Sort newest first
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return results;
    }
}

module.exports = AuditModel;

/**
 * Decoupled Data Adapter with LocalStorage & Mock Persistence
 * 
 * Provides storage-agnostic data access for Day Slot Events & Booking Management.
 * Storage Key: 'hall_mock_data_v1'
 */

(function (global) {
    const STORAGE_KEY = 'hall_mock_data_v1';

    // Helper: format Date to YYYY-MM-DD
    function formatDateOffset(daysOffset = 0) {
        const d = new Date();
        d.setDate(d.getDate() + daysOffset);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
    }

    // Default Seed Data
    function getDefaultSeedBookings() {
        const todayStr = formatDateOffset(0);
        const tomorrowStr = formatDateOffset(1);
        const nextWeekStr = formatDateOffset(7);

        return [
            {
                id: "BOOK-1001",
                customerName: "Dr. A. Sharma",
                mobileNumber: "9876543210",
                eventName: "AI & Data Science Workshop",
                hall: "Hall 1",
                bookingDate: todayStr,
                startTime: "09:00",
                endTime: "12:00",
                status: "Completed",
                notes: "Projector and sound system required.",
                contract: {
                    hallRent: 10000,
                    securityDeposit: 2000,
                    baseDiscount: 1000,
                    discountsList: [],
                    extraChargesList: [
                        { id: "CHG-101", category: "Electricity Charge", amount: 500, remarks: "Generator backup", addedBy: "Admin", date: todayStr }
                    ]
                },
                financial: {
                    netRent: 9500,
                    netRentPaid: 9500,
                    remainingRent: 0,
                    effectiveDepositHeld: 2000
                }
            },
            {
                id: "BOOK-1002",
                customerName: "Prof. R. Mehta",
                mobileNumber: "9812345678",
                eventName: "Annual Cultural Music Concert",
                hall: "Hall 2",
                bookingDate: todayStr,
                startTime: "17:00",
                endTime: "20:00",
                status: "Confirmed",
                notes: "Arrangement for 150 attendees and audio setup.",
                contract: {
                    hallRent: 15000,
                    securityDeposit: 2000,
                    baseDiscount: 0,
                    discountsList: [],
                    extraChargesList: [
                        { id: "CHG-102", category: "Stage Lighting", amount: 1500, remarks: "Spotlights", addedBy: "Admin", date: todayStr }
                    ]
                },
                financial: {
                    netRent: 16500,
                    netRentPaid: 10000,
                    remainingRent: 6500,
                    effectiveDepositHeld: 2000
                }
            },
            {
                id: "BOOK-1003",
                customerName: "Er. V. Patel",
                mobileNumber: "9711223344",
                eventName: "Cybersecurity Guest Lecture",
                hall: "Hall 1",
                bookingDate: tomorrowStr,
                startTime: "13:30",
                endTime: "16:00",
                status: "Confirmed",
                notes: "High-speed Wi-Fi access needed.",
                contract: {
                    hallRent: 15000,
                    securityDeposit: 3000,
                    baseDiscount: 2000,
                    discountsList: [],
                    extraChargesList: []
                },
                financial: {
                    netRent: 13000,
                    netRentPaid: 13000,
                    remainingRent: 0,
                    effectiveDepositHeld: 3000
                }
            },
            {
                id: "BOOK-1004",
                customerName: "Dr. K. Verma",
                mobileNumber: "9988776655",
                eventName: "Robotics Night Hackathon",
                hall: "Hall 2",
                bookingDate: nextWeekStr,
                startTime: "21:00",
                endTime: "02:00",
                status: "Confirmed",
                notes: "24-hour power backup required.",
                contract: {
                    hallRent: 20000,
                    securityDeposit: 5000,
                    baseDiscount: 0,
                    discountsList: [],
                    extraChargesList: []
                },
                financial: {
                    netRent: 20000,
                    netRentPaid: 15000,
                    remainingRent: 5000,
                    effectiveDepositHeld: 5000
                }
            }
        ];
    }

    // In-memory fallback if localStorage is unavailable
    let inMemoryStore = null;

    const dataAdapter = {
        /**
         * Retrieve all bookings from LocalStorage or in-memory fallback
         */
        getBookings() {
            try {
                if (typeof localStorage !== 'undefined') {
                    const data = localStorage.getItem(STORAGE_KEY);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            return parsed;
                        }
                    }
                    // Seed if empty
                    const seed = getDefaultSeedBookings();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
                    return seed;
                }
            } catch (e) {
                console.warn("LocalStorage access failed, using in-memory store:", e);
            }

            if (!inMemoryStore || inMemoryStore.length === 0) {
                inMemoryStore = getDefaultSeedBookings();
            }
            return inMemoryStore;
        },

        /**
         * Save bookings to storage
         */
        saveBookings(bookings) {
            inMemoryStore = bookings;
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
                }
            } catch (e) {
                console.warn("LocalStorage save failed:", e);
            }
            return bookings;
        },

        /**
         * Slot Classifier Logic:
         * Morning:   06:00–11:59 (minutes: 360 to < 720)
         * Afternoon: 12:00–15:59 (minutes: 720 to < 960)
         * Evening:   16:00–19:59 (minutes: 960 to < 1200)
         * Night:     20:00–05:59 (minutes: >= 1200 or < 360, wraps midnight)
         */
        determineSlot(startTime) {
            if (!startTime || typeof startTime !== 'string') return 'morning';
            const parts = startTime.trim().split(':').map(Number);
            const hours = isNaN(parts[0]) ? 0 : parts[0];
            const minutes = isNaN(parts[1]) ? 0 : parts[1];
            const totalMins = hours * 60 + minutes;

            if (totalMins >= 360 && totalMins < 720) return 'morning';    // 06:00 - 11:59
            if (totalMins >= 720 && totalMins < 960) return 'afternoon';  // 12:00 - 15:59
            if (totalMins >= 960 && totalMins < 1200) return 'evening';   // 16:00 - 19:59
            return 'night';                                               // 20:00 - 05:59
        },

        /**
         * Get Day Slot Events & Metrics for a given date
         * @param {string} [dateStr] - YYYY-MM-DD
         * @returns {Object} { success: true, date: string, data: Object }
         */
        getDaySlots(dateStr) {
            let targetDate = '';
            if (dateStr && typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
                targetDate = dateStr.trim();
            } else {
                targetDate = formatDateOffset(0);
            }

            const allBookings = this.getBookings();
            const dateBookings = allBookings.filter(b => b.bookingDate === targetDate);

            const slots = {
                morning: {
                    key: 'morning',
                    name: 'Morning',
                    timeRange: '06:00–12:00',
                    icon: 'bi-sunrise',
                    color: '#f59e0b',
                    count: 0,
                    activeCount: 0,
                    completedCount: 0,
                    cancelledCount: 0,
                    draftCount: 0,
                    archivedCount: 0,
                    revenue: 0,
                    contractAmount: 0,
                    pendingDues: 0,
                    hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
                    events: []
                },
                afternoon: {
                    key: 'afternoon',
                    name: 'Afternoon',
                    timeRange: '12:00–16:00',
                    icon: 'bi-sun',
                    color: '#3b82f6',
                    count: 0,
                    activeCount: 0,
                    completedCount: 0,
                    cancelledCount: 0,
                    draftCount: 0,
                    archivedCount: 0,
                    revenue: 0,
                    contractAmount: 0,
                    pendingDues: 0,
                    hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
                    events: []
                },
                evening: {
                    key: 'evening',
                    name: 'Evening',
                    timeRange: '16:00–20:00',
                    icon: 'bi-sunset',
                    color: '#8b5cf6',
                    count: 0,
                    activeCount: 0,
                    completedCount: 0,
                    cancelledCount: 0,
                    draftCount: 0,
                    archivedCount: 0,
                    revenue: 0,
                    contractAmount: 0,
                    pendingDues: 0,
                    hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
                    events: []
                },
                night: {
                    key: 'night',
                    name: 'Night',
                    timeRange: '20:00–00:00',
                    icon: 'bi-moon-stars',
                    color: '#475569',
                    count: 0,
                    activeCount: 0,
                    completedCount: 0,
                    cancelledCount: 0,
                    draftCount: 0,
                    archivedCount: 0,
                    revenue: 0,
                    contractAmount: 0,
                    pendingDues: 0,
                    hallCounts: { 'Hall 1': 0, 'Hall 2': 0 },
                    events: []
                }
            };

            const hallBreakdown = {
                'Hall 1': { hallName: 'Hall 1', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
                'Hall 2': { hallName: 'Hall 2', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 }
            };

            let totalEvents = 0;
            let activeEvents = 0;
            let totalRevenue = 0;
            let totalContractAmount = 0;
            let totalPendingDues = 0;

            dateBookings.forEach(booking => {
                const slotKey = this.determineSlot(booking.startTime);
                const slot = slots[slotKey];
                const fin = booking.financial || {};
                const hall = booking.hall || 'Hall 1';

                totalEvents += 1;
                slot.count += 1;

                if (booking.status === 'Confirmed' || booking.status === 'Booked') {
                    slot.activeCount += 1;
                    activeEvents += 1;
                } else if (booking.status === 'Completed') {
                    slot.completedCount += 1;
                    activeEvents += 1;
                } else if (booking.status === 'Cancelled') {
                    slot.cancelledCount += 1;
                } else if (booking.status === 'Draft') {
                    slot.draftCount += 1;
                } else if (booking.status === 'Archived') {
                    slot.archivedCount += 1;
                }

                if (slot.hallCounts[hall] !== undefined) {
                    slot.hallCounts[hall] += 1;
                }

                if (!hallBreakdown[hall]) {
                    hallBreakdown[hall] = { hallName: hall, totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 };
                }
                hallBreakdown[hall].totalEvents += 1;
                if (hallBreakdown[hall][slotKey] !== undefined) {
                    hallBreakdown[hall][slotKey] += 1;
                }

                const isEffective = (booking.status !== 'Cancelled' && booking.status !== 'Archived');
                const netRentPaid = Number(fin.netRentPaid) || 0;
                const netRent = Number(fin.netRent) || Number(booking.contract?.hallRent) || 0;
                const remainingRent = Number(fin.remainingRent) || 0;

                if (isEffective) {
                    slot.revenue += netRentPaid;
                    slot.contractAmount += netRent;
                    slot.pendingDues += remainingRent;

                    totalRevenue += netRentPaid;
                    totalContractAmount += netRent;
                    totalPendingDues += remainingRent;

                    hallBreakdown[hall].revenue += netRentPaid;
                }

                const enriched = {
                    ...booking,
                    slotKey,
                    slotName: slot.name,
                    slotTimeRange: slot.timeRange,
                    financial: fin
                };
                slot.events.push(enriched);
            });

            // Sort chronologically by startTime
            Object.values(slots).forEach(s => {
                s.events.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            });

            const slotList = [slots.morning, slots.afternoon, slots.evening, slots.night];

            const responseData = {
                date: targetDate,
                totalEvents,
                activeEvents,
                totalRevenue,
                totalContractAmount,
                totalPendingDues,
                slots,
                slotList,
                hallBreakdown
            };

            return {
                success: true,
                date: targetDate,
                data: responseData
            };
        }
    };

    // Export to global window and module
    global.dataAdapter = dataAdapter;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dataAdapter;
    }
})(typeof window !== 'undefined' ? window : global);

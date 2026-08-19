/**
 * Decoupled Data Adapter
 * 
 * Provides unified data access for Day Slot Events & Booking Management.
 * Synced directly with live backend and MongoDB database.
 */

(function (global) {
    const STORAGE_KEY = 'hall_mock_data_v1';

    // Clear any past mock data from browser localStorage on startup
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {}

    // Default: empty clean slate (all data comes from live database)
    function getDefaultSeedBookings() {
        return [];
    }

    let inMemoryStore = [];

    const dataAdapter = {
        /**
         * Retrieve all bookings from live database or clean memory
         */
        getBookings() {
            try {
                if (typeof localStorage !== 'undefined') {
                    const data = localStorage.getItem(STORAGE_KEY);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) {
                            return parsed;
                        }
                    }
                }
            } catch (e) {}

            return inMemoryStore || [];
        },

        /**
         * Save bookings to storage
         */
        saveBookings(bookings) {
            inMemoryStore = bookings || [];
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryStore));
                }
            } catch (e) {}
            return inMemoryStore;
        },

        /**
         * Clear all stored client bookings
         */
        clearBookings() {
            inMemoryStore = [];
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {}
            return [];
        },

        /**
         * Get Day Slot analytics for a specific date
         */
        getDaySlots(targetDate) {
            const allBookings = this.getBookings();
            const dateBookings = allBookings.filter(b => b.bookingDate === targetDate);

            const getSlotKey = (timeStr) => {
                if (!timeStr) return 'morning';
                const parts = timeStr.split(':').map(Number);
                const hours = isNaN(parts[0]) ? 0 : parts[0];
                const minutes = isNaN(parts[1]) ? 0 : parts[1];
                const totalMins = hours * 60 + minutes;

                if (totalMins >= 360 && totalMins < 720) return 'morning';
                if (totalMins >= 720 && totalMins < 960) return 'afternoon';
                if (totalMins >= 960 && totalMins < 1200) return 'evening';
                return 'night';
            };

            const slots = {
                morning: { key: 'morning', name: 'Morning', timeRange: '06:00–12:00', icon: 'bi-sunrise', color: '#f59e0b', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
                afternoon: { key: 'afternoon', name: 'Afternoon', timeRange: '12:00–16:00', icon: 'bi-sun', color: '#3b82f6', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
                evening: { key: 'evening', name: 'Evening', timeRange: '16:00–20:00', icon: 'bi-sunset', color: '#8b5cf6', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
                night: { key: 'night', name: 'Night', timeRange: '20:00–00:00', icon: 'bi-moon-stars', color: '#475569', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Hall 1': 0, 'Hall 2': 0 }, events: [] }
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
                const slotKey = getSlotKey(booking.startTime);
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
                const netRent = Number(fin.netRent) || 0;
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

            Object.values(slots).forEach(slot => {
                slot.events.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            });

            return {
                data: {
                    date: targetDate,
                    totalEvents,
                    activeEvents,
                    totalRevenue,
                    totalContractAmount,
                    totalPendingDues,
                    slots,
                    slotList: [slots.morning, slots.afternoon, slots.evening, slots.night],
                    hallBreakdown
                }
            };
        }
    };

    global.dataAdapter = dataAdapter;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dataAdapter;
    }
})(typeof window !== 'undefined' ? window : global);

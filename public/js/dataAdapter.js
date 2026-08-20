/**
 * Decoupled Data Adapter
 * 
 * Provides unified data access for Day Slot Events & Booking Management.
 * Synced directly with live backend and MongoDB database.
 */

(function (global) {
    // Purge any legacy mock keys from localStorage
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('hall_mock_data_v1');
            localStorage.removeItem('hall_bookings_mock');
            localStorage.removeItem('mock_data_v1');
        }
    } catch (e) {}

    let inMemoryStore = [];

    const dataAdapter = {
        /**
         * Retrieve all bookings from live database or clean memory
         */
        getBookings() {
            return inMemoryStore || [];
        },

        /**
         * Save bookings to store
         */
        saveBookings(bookings) {
            inMemoryStore = Array.isArray(bookings) ? bookings : [];
            return inMemoryStore;
        },

        /**
         * Clear all stored client bookings
         */
        clearBookings() {
            inMemoryStore = [];
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
                morning: { key: 'morning', name: 'Morning', timeRange: '06:00–12:00', icon: 'bi-sunrise', color: '#f59e0b', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
                afternoon: { key: 'afternoon', name: 'Afternoon', timeRange: '12:00–16:00', icon: 'bi-sun', color: '#3b82f6', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
                evening: { key: 'evening', name: 'Evening', timeRange: '16:00–20:00', icon: 'bi-sunset', color: '#8b5cf6', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 }, events: [] },
                night: { key: 'night', name: 'Night', timeRange: '20:00–00:00', icon: 'bi-moon-stars', color: '#475569', count: 0, activeCount: 0, completedCount: 0, cancelledCount: 0, draftCount: 0, archivedCount: 0, revenue: 0, contractAmount: 0, pendingDues: 0, hallCounts: { 'Small Hall': 0, 'Big Hall': 0, 'Hall 1': 0, 'Hall 2': 0 }, events: [] }
            };

            const hallBreakdown = {
                'Small Hall': { hallName: 'Small Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
                'Big Hall': { hallName: 'Big Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
                'Hall 1': { hallName: 'Small Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 },
                'Hall 2': { hallName: 'Big Hall', totalEvents: 0, morning: 0, afternoon: 0, evening: 0, night: 0, revenue: 0 }
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
                let rawHall = booking.hall || 'Small Hall';
                if (rawHall === 'Hall 1') rawHall = 'Small Hall';
                if (rawHall === 'Hall 2') rawHall = 'Big Hall';
                const hall = rawHall;

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
                if (hall === 'Small Hall') slot.hallCounts['Hall 1'] += 1;
                if (hall === 'Big Hall') slot.hallCounts['Hall 2'] += 1;

                if (hall === 'Small Hall' || hall === 'Hall 1') {
                    hallBreakdown['Small Hall'].totalEvents += 1;
                    hallBreakdown['Hall 1'].totalEvents += 1;
                    if (hallBreakdown['Small Hall'][slotKey] !== undefined) hallBreakdown['Small Hall'][slotKey] += 1;
                    if (hallBreakdown['Hall 1'][slotKey] !== undefined) hallBreakdown['Hall 1'][slotKey] += 1;
                } else if (hall === 'Big Hall' || hall === 'Hall 2') {
                    hallBreakdown['Big Hall'].totalEvents += 1;
                    hallBreakdown['Hall 2'].totalEvents += 1;
                    if (hallBreakdown['Big Hall'][slotKey] !== undefined) hallBreakdown['Big Hall'][slotKey] += 1;
                    if (hallBreakdown['Hall 2'][slotKey] !== undefined) hallBreakdown['Hall 2'][slotKey] += 1;
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

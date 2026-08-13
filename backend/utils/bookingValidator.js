/**
 * Decoupled Booking Validation Engine
 * 
 * DESIGN RATIONALE FOR MONGODB / STORAGE AGNOSTIC ARCHITECTURE:
 * This validation core evaluates time slot overlaps and business availability rules
 * independently from the storage layer. When migrating to MongoDB Atlas, pass
 * queried document collections into this validator — zero changes to validation rules required!
 */

class BookingValidator {
    /**
     * Helper to convert time string "HH:MM" (24-hr) to total minutes from midnight.
     */
    static timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + minutes;
    }

    /**
     * Validate a proposed booking slot against existing bookings.
     * 
     * @param {Object} params
     * @param {string} params.hall - "Hall 1" or "Hall 2"
     * @param {string} params.bookingDate - "YYYY-MM-DD"
     * @param {string} params.startTime - "HH:MM"
     * @param {string} params.endTime - "HH:MM"
     * @param {string} [params.status="Confirmed"] - Status of proposed booking
     * @param {string|null} [params.excludeId=null] - Booking ID to ignore (for edit/reschedule)
     * @param {Array} params.existingBookings - Array of existing booking objects
     * @returns {Object} { isValid: boolean, message: string, conflictingBooking: Object|null }
     */
    static validateSlot({ hall, bookingDate, startTime, endTime, status = 'Confirmed', excludeId = null, existingBookings = [] }) {
        // 1. Time logic validation
        const startMin = this.timeToMinutes(startTime);
        const endMin = this.timeToMinutes(endTime);

        if (startMin >= endMin) {
            return {
                isValid: false,
                message: 'End time must be later than start time.',
                conflictingBooking: null
            };
        }

        // 2. Cancelled and Archived bookings NEVER block new bookings
        if (status === 'Cancelled' || status === 'Archived') {
            return {
                isValid: true,
                message: 'Cancelled/Archived status does not block hall slots.',
                conflictingBooking: null
            };
        }

        // 3. Overlap check condition against existing active bookings
        for (const booking of existingBookings) {
            // Ignore Cancelled and Archived bookings
            if (booking.status === 'Cancelled' || booking.status === 'Archived') {
                continue;
            }

            // Ignore current booking when editing/rescheduling
            if (excludeId && booking.id === excludeId) {
                continue;
            }

            // Check if hall and booking date match
            if (booking.hall === hall && booking.bookingDate === bookingDate) {
                const existingStartMin = this.timeToMinutes(booking.startTime);
                const existingEndMin = this.timeToMinutes(booking.endTime);

                // Overlap condition: (newStart < existingEnd) AND (newEnd > existingStart)
                if (startMin < existingEndMin && endMin > existingStartMin) {
                    return {
                        isValid: false,
                        message: `Time slot conflict! ${hall} is already booked on ${bookingDate} from ${booking.startTime} to ${booking.endTime} for "${booking.eventName}".`,
                        conflictingBooking: booking
                    };
                }
            }
        }

        return {
            isValid: true,
            message: 'Time slot is available.',
            conflictingBooking: null
        };
    }
}

module.exports = BookingValidator;

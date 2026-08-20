/**
 * Staff Operations Controller
 * 
 * Provides safe operational views and requirement checklist actions for Staff.
 * Strictly guarantees that no financial figures, revenue, or contract balances are exposed.
 */

const BookingModel = require('../models/bookingModel');

class FacultyController {
    /**
     * GET /api/staff/events or /api/faculty/events
     * Supports ?type=today|upcoming &hall=Hall 1 &shift=morning|afternoon|evening|night &status &search
     */
    static async getEvents(req, res) {
        try {
            const { type, hall, shift, date, status, search } = req.query;
            const events = await BookingModel.getFacultyEvents({ type, hall, shift, date, status, search });

            return res.status(200).json({
                success: true,
                count: events.length,
                data: events
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching staff event tasks.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/staff/events/:id or /api/faculty/events/:id
     */
    static async getEventById(req, res) {
        try {
            const booking = await BookingModel.findById(req.params.id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found.'
                });
            }

            const events = await BookingModel.getFacultyEvents({ search: booking.id });
            const safeEvent = events.find(e => e.id === booking.id) || events[0];

            if (!safeEvent) {
                return res.status(404).json({
                    success: false,
                    message: 'Event not found or archived.'
                });
            }

            return res.status(200).json({
                success: true,
                data: safeEvent
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving event details.',
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/staff/events/:id/requirements or /api/faculty/events/:id/requirements
     */
    static async updateRequirements(req, res) {
        try {
            const user = req.user ? (req.user.name || req.user.username) : 'Staff Member';
            const updatedReqs = await BookingModel.updateRequirements(req.params.id, req.body, user);

            return res.status(200).json({
                success: true,
                message: 'Requirements checklist updated successfully.',
                data: updatedReqs
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to update requirements checklist.'
            });
        }
    }

    /**
     * POST /api/staff/events/:id/mark-prepared or /api/faculty/events/:id/mark-prepared
     */
    static async markPrepared(req, res) {
        try {
            const user = req.user ? (req.user.name || req.user.username) : 'Staff Member';
            const { notes } = req.body || {};
            const updatedReqs = await BookingModel.markPrepared(req.params.id, { user, notes });

            return res.status(200).json({
                success: true,
                message: 'All setup requirements marked prepared & ready.',
                data: updatedReqs
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to mark requirements prepared.'
            });
        }
    }

    /**
     * POST /api/staff/events/:id/acknowledge or /api/faculty/events/:id/acknowledge
     */
    static async acknowledgeTask(req, res) {
        try {
            const user = req.user ? (req.user.name || req.user.username) : 'Staff Member';
            const { notes } = req.body || {};
            const updatedReqs = await BookingModel.acknowledgeTask(req.params.id, { user, notes });

            return res.status(200).json({
                success: true,
                message: 'Event task assignment acknowledged successfully.',
                data: updatedReqs
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to acknowledge event task.'
            });
        }
    }
}

module.exports = FacultyController;

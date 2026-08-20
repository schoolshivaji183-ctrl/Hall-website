/**
 * Authentication Controller
 * 
 * Handles user login, session checks, and user management.
 * Validates credentials directly against MongoDB Atlas.
 */

const UserModel = require('../models/userModel');

class AuthController {
    /**
     * POST /api/auth/login
     */
    static async login(req, res) {
        try {
            const { username, password } = req.body || {};

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide both username and password.'
                });
            }

            const user = await UserModel.authenticate(username, password);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid username or password.'
                });
            }

            return res.status(200).json({
                success: true,
                message: `Authenticated as ${user.name || user.username} (${user.role})`,
                user: {
                    username: user.username,
                    name: user.name || user.username,
                    email: user.email || '',
                    role: user.role,
                    department: user.department || ''
                },
                token: `sess_${user.username}_${Date.now()}`
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Login server error.',
                error: error.message
            });
        }
    }

    /**
     * GET /api/auth/me
     */
    static async getMe(req, res) {
        try {
            const currentUser = req.user;

            if (!currentUser) {
                return res.status(401).json({
                    success: false,
                    message: 'No active session found.'
                });
            }

            return res.status(200).json({
                success: true,
                user: currentUser
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching session user.',
                error: error.message
            });
        }
    }

    /**
     * POST /api/auth/logout
     */
    static async logout(req, res) {
        return res.status(200).json({
            success: true,
            message: 'Session ended successfully.'
        });
    }

    /**
     * GET /api/users (Admin Only)
     */
    static async getUsers(req, res) {
        try {
            await UserModel.syncFromDB();
            const users = UserModel.findAll();
            return res.status(200).json({
                success: true,
                count: users.length,
                data: users
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving users.',
                error: error.message
            });
        }
    }

    /**
     * POST /api/users (Admin Only)
     */
    static async createUser(req, res) {
        try {
            const { username, password, name, email, role, department } = req.body || {};
            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required.'
                });
            }

            const newUser = await UserModel.createUser({ username, password, name, email, role, department });
            return res.status(201).json({
                success: true,
                message: `User '${newUser.username}' created successfully.`,
                data: newUser
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to create user.'
            });
        }
    }
}

module.exports = AuthController;

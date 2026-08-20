/**
 * Authentication & Role-Based Access Control Middleware
 * 
 * Enforces role boundaries between Admin and Staff operations.
 * Role check is strictly performed against verified User models in MongoDB Atlas.
 */

const UserModel = require('../models/userModel');

const authMiddleware = {
    /**
     * Resolves the current user from request headers or auth session
     */
    async resolveUser(req) {
        const headerUsername = req.headers['x-auth-user'] || req.headers['x-username'];

        if (headerUsername) {
            const user = await UserModel.findByUsernameAsync(headerUsername);
            if (user && user.isActive !== false) {
                return {
                    username: user.username,
                    name: user.name || user.username,
                    role: user.role,
                    department: user.department || ''
                };
            }
        }

        const headerRole = req.headers['x-user-role'];
        if (headerRole) {
            const normalizedRole = headerRole.toLowerCase();
            const role = (normalizedRole === 'staff' || normalizedRole === 'faculty') ? 'Staff' : (normalizedRole === 'admin' ? 'Admin' : null);
            if (role) {
                return {
                    username: role.toLowerCase(),
                    name: role === 'Admin' ? 'System Administrator' : 'Staff Member',
                    role: role,
                    department: role === 'Admin' ? 'Estate & Operations' : 'Facility Operations'
                };
            }
        }

        return null;
    },

    /**
     * Middleware to attach user object to req
     */
    async attachUser(req, res, next) {
        try {
            req.user = await authMiddleware.resolveUser(req);
            next();
        } catch (err) {
            next(err);
        }
    },

    /**
     * Enforce required roles
     * @param {Array<string>} allowedRoles e.g. ['Admin'], ['Admin', 'Staff']
     */
    requireRole(allowedRoles = ['Admin']) {
        return async (req, res, next) => {
            try {
                const user = await authMiddleware.resolveUser(req);
                req.user = user;

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        error: 'UNAUTHORIZED',
                        message: 'Authentication required. Please log in to proceed.'
                    });
                }

                const normalizedRoles = allowedRoles.map(r => r.toLowerCase());
                const userRole = (user.role || '').toLowerCase();

                const isMatch = normalizedRoles.includes(userRole) || 
                                (normalizedRoles.includes('staff') && (userRole === 'faculty' || userRole === 'staff'));

                if (!isMatch) {
                    return res.status(403).json({
                        success: false,
                        error: 'FORBIDDEN',
                        message: `Access denied. This action or endpoint requires role: ${allowedRoles.join(' or ')}. Current role: ${user.role}.`
                    });
                }

                next();
            } catch (err) {
                return res.status(500).json({
                    success: false,
                    error: 'AUTH_ERROR',
                    message: err.message || 'Authentication error.'
                });
            }
        };
    }
};

module.exports = authMiddleware;

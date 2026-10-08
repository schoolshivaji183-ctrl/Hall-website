/**
 * User Model & Authentication Repository (MongoDB Atlas & Mongoose)
 * 
 * Manages user accounts, roles (Admin, Staff), authentication,
 * and permissions across the Hall Booking Management System.
 * MongoDB Atlas is the single source of truth.
 */

const bcrypt = require('bcryptjs');
const { User } = require('./schemas/UserSchema');
const { isConnected } = require('../config/db');

const DEFAULT_USERS = [
    {
        username: "admin",
        password: bcrypt.hashSync("admin123", 10),
        name: "System Administrator",
        email: "admin@hallmanager.edu",
        role: "Admin",
        department: "Estate & Operations",
        isActive: true
    },
    {
        username: "staff",
        password: bcrypt.hashSync("staff123", 10),
        name: "Staff Desk Officer",
        email: "staff@hallmanager.edu",
        role: "Staff",
        department: "Facility Operations",
        isActive: true
    }
];

let usersStore = [...DEFAULT_USERS];

class UserModel {
    /**
     * Hash a plain-text password using bcrypt
     */
    static hashPassword(plainPassword) {
        if (!plainPassword) return '';
        return bcrypt.hashSync(plainPassword, 10);
    }

    /**
     * Verify a plain-text password against a stored password string (bcrypt hash or fallback)
     */
    static verifyPassword(plainPassword, storedPassword) {
        if (!plainPassword || !storedPassword) return false;
        try {
            if (typeof storedPassword === 'string' && (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$'))) {
                return bcrypt.compareSync(plainPassword, storedPassword);
            }
        } catch (err) {
            console.warn('⚠️  [Bcrypt] Hash comparison error:', err.message);
        }
        // Fallback for direct plain-text matching if raw record was inserted manually
        return plainPassword === storedPassword;
    }

    /**
     * Synchronize in-memory cache with MongoDB Atlas
     */
    static async syncFromDB() {
        if (isConnected()) {
            try {
                const docs = await User.find({}).lean();
                if (docs && docs.length > 0) {
                    usersStore = docs;
                } else {
                    for (const u of DEFAULT_USERS) {
                        await User.findOneAndUpdate({ username: u.username }, u, { upsert: true });
                    }
                    usersStore = [...DEFAULT_USERS];
                }
                return usersStore;
            } catch (err) {
                console.warn('⚠️  [MongoDB] Failed to sync users from Atlas:', err.message);
            }
        }
        return usersStore;
    }

    /**
     * Clear local in-memory store (for testing/resets)
     */
    static clearStore() {
        usersStore = [...DEFAULT_USERS];
    }

    /**
     * Retrieve all users (excluding passwords)
     */
    static findAll() {
        return usersStore.map(u => {
            const { password, ...safeUser } = u;
            return safeUser;
        });
    }

    /**
     * Synchronous search in cached store
     */
    static findByUsername(username) {
        if (!username) return null;
        const normalized = username.trim().toLowerCase();
        return usersStore.find(u => (u.username || '').toLowerCase() === normalized) || null;
    }

    /**
     * Asynchronous search directly querying MongoDB Atlas if connected
     */
    static async findByUsernameAsync(username) {
        if (!username) return null;
        const normalized = username.trim().toLowerCase();

        if (isConnected()) {
            try {
                const userDoc = await User.findOne({ username: normalized }).lean();
                if (userDoc) {
                    const idx = usersStore.findIndex(u => (u.username || '').toLowerCase() === normalized);
                    if (idx >= 0) {
                        usersStore[idx] = userDoc;
                    } else {
                        usersStore.push(userDoc);
                    }
                    return userDoc;
                }
            } catch (err) {
                console.warn('⚠️  [MongoDB] Error querying user by username:', err.message);
            }
        }

        return this.findByUsername(normalized);
    }

    /**
     * Authenticate user credentials against MongoDB Atlas
     */
    static async authenticate(username, password) {
        if (!username || !password) return null;
        const normalized = username.trim().toLowerCase();

        const user = await this.findByUsernameAsync(normalized);
        if (!user) return null;
        if (user.isActive === false) return null;

        const isMatch = this.verifyPassword(password.trim(), user.password);
        if (isMatch) {
            const { password: _, ...safeUser } = user;
            return safeUser;
        }

        return null;
    }

    /**
     * Create a new user with hashed password and role
     */
    static async createUser(userData) {
        const username = (userData.username || '').trim().toLowerCase();
        if (!username) throw new Error('Username is required.');
        if (!userData.password) throw new Error('Password is required.');

        const existing = await this.findByUsernameAsync(username);
        if (existing) {
            throw new Error(`User '${username}' already exists.`);
        }

        const role = (userData.role === 'Admin') ? 'Admin' : 'Staff';
        const hashedPassword = this.hashPassword(userData.password.trim());

        const newUser = {
            username,
            password: hashedPassword,
            name: (userData.name || username).trim(),
            email: (userData.email || '').trim(),
            role,
            department: userData.department || (role === 'Admin' ? 'Administration' : 'Facility Operations'),
            isActive: userData.isActive !== undefined ? userData.isActive : true
        };

        if (isConnected()) {
            const doc = await User.create(newUser);
            newUser._id = doc._id;
        }

        usersStore.push(newUser);

        const { password: _, ...safeUser } = newUser;
        return safeUser;
    }
}

module.exports = UserModel;

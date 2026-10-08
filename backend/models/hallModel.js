const { Hall } = require('./schemas/HallSchema');
const { isConnected } = require('../config/db');

// In-memory cache synced with MongoDB Atlas
let hallsStore = [
    {
        hallId: "HALL-01",
        name: "Hall 1",
        capacity: 350,
        basePricePerHour: 2500,
        basePricePerDay: 15000,
        amenities: ["HD Laser Projector", "Central Air Conditioning", "Surround Sound Array", "Podium with Mic", "Stage Lighting"],
        location: "Main Academic Block - Ground Floor",
        status: "available",
        isActive: true
    },
    {
        hallId: "HALL-02",
        name: "Hall 2",
        capacity: 180,
        basePricePerHour: 1800,
        basePricePerDay: 10000,
        amenities: ["Interactive Smart Display", "Air Conditioning", "PA Sound System", "High-speed Wi-Fi", "Green Room"],
        location: "Convention Wing - 2nd Floor",
        status: "available",
        isActive: true
    }
];

class HallModel {
    /**
     * Synchronize halls in memory from MongoDB Atlas
     */
    static async syncFromDB() {
        if (!isConnected()) return hallsStore;
        try {
            const docs = await Hall.find({ isActive: true }).lean();
            if (docs && docs.length > 0) {
                hallsStore = docs.map(d => ({
                    id: d.hallId || d._id.toString(),
                    hallId: d.hallId,
                    name: d.name,
                    capacity: d.capacity || 200,
                    basePricePerHour: d.basePricePerHour || 2000,
                    basePricePerDay: d.basePricePerDay || 10000,
                    amenities: d.amenities || [],
                    location: d.location || 'Main Campus Building',
                    status: d.status || 'available',
                    isActive: d.isActive !== false
                }));
                console.log(`🏛️  [MongoDB] Synced ${hallsStore.length} Halls from Atlas.`);
            } else {
                // Ensure initial master halls exist in DB
                for (const h of hallsStore) {
                    await Hall.findOneAndUpdate({ hallId: h.hallId }, h, { upsert: true, returnDocument: 'after' });
                }
            }
        } catch (err) {
            console.warn('⚠️  [MongoDB] Hall sync notice:', err.message);
        }
        return hallsStore;
    }

    /**
     * Retrieve all active master halls
     */
    static async findAll(forceRefresh = false) {
        if ((forceRefresh || hallsStore.length === 0) && isConnected()) {
            try {
                const docs = await Hall.find({ isActive: true }).lean();
                if (docs && docs.length > 0) {
                    hallsStore = docs.map(d => ({
                        id: d.hallId || d._id.toString(),
                        hallId: d.hallId,
                        name: d.name,
                        capacity: d.capacity || 200,
                        basePricePerHour: d.basePricePerHour || 2000,
                        basePricePerDay: d.basePricePerDay || 10000,
                        amenities: d.amenities || [],
                        location: d.location || 'Main Campus Building',
                        status: d.status || 'available',
                        isActive: d.isActive !== false
                    }));
                }
            } catch (err) {
                console.warn('⚠️  [MongoDB] Error querying halls:', err.message);
            }
        }
        return [...hallsStore];
    }

    /**
     * Find hall by ID or hallId
     */
    static async findById(id) {
        const halls = await this.findAll();
        return halls.find(h => h.id === id || h.hallId === id) || null;
    }

    /**
     * Find hall by name (supports "Hall 1", "Small Hall", etc.)
     */
    static async findByName(name) {
        if (!name) return null;
        const normalized = name.trim().toLowerCase();
        const halls = await this.findAll();
        return halls.find(h => {
            const hName = (h.name || '').toLowerCase();
            if (hName === normalized) return true;
            if (normalized === 'small hall' && (hName === 'hall 1' || h.hallId === 'HALL-01')) return true;
            if (normalized === 'big hall' && (hName === 'hall 2' || h.hallId === 'HALL-02')) return true;
            if (normalized === 'hall 1' && (hName === 'small hall' || h.hallId === 'HALL-01')) return true;
            if (normalized === 'hall 2' && (hName === 'big hall' || h.hallId === 'HALL-02')) return true;
            return false;
        }) || null;
    }

    /**
     * Update hall status in MongoDB Atlas and cache
     */
    static async updateStatus(hallId, status) {
        const validStatuses = ['available', 'booked', 'maintenance'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid hall status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const hall = await this.findById(hallId);
        if (!hall) {
            throw new Error(`Hall not found: ${hallId}`);
        }

        hall.status = status;

        const idx = hallsStore.findIndex(h => h.hallId === hall.hallId || h.id === hall.id);
        if (idx !== -1) {
            hallsStore[idx].status = status;
        }

        if (isConnected()) {
            await Hall.updateOne({ hallId: hall.hallId }, { $set: { status } });
        }

        return hall;
    }
}

module.exports = HallModel;

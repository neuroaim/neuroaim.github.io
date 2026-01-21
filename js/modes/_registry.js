// ==================== MODE REGISTRY ====================
// Central registration and management of all training modes

const ModeRegistry = {
    _modes: new Map(),
    
    /**
     * Register a mode class
     * @param {Function} ModeClass - Class extending BaseMode
     */
    register(ModeClass) {
        if (!ModeClass.ID) {
            console.error('[ModeRegistry] Mode class must have static ID property');
            return;
        }
        this._modes.set(ModeClass.ID, ModeClass);
        console.log(`[ModeRegistry] Registered Mode ${ModeClass.ID}: ${ModeClass.name}`);
    },
    
    /**
     * Get a mode class by ID
     * @param {number} id - Mode ID
     * @returns {Function|undefined} Mode class
     */
    get(id) {
        return this._modes.get(id);
    },
    
    /**
     * Get all registered mode classes sorted by ID
     * @returns {Array} Array of mode classes
     */
    getAll() {
        return [...this._modes.values()].sort((a, b) => a.ID - b.ID);
    },
    
    /**
     * Get all mode IDs sorted
     * @returns {Array} Array of mode IDs
     */
    getAllIds() {
        return [...this._modes.keys()].sort((a, b) => a - b);
    },
    
    /**
     * Create a mode instance
     * @param {number} id - Mode ID
     * @param {Object} engine - Game engine reference
     * @returns {Object} Mode instance
     */
    create(id, engine) {
        const ModeClass = this.get(id);
        if (!ModeClass) {
            throw new Error(`[ModeRegistry] Mode ${id} not registered`);
        }
        return new ModeClass(engine);
    },
    
    /**
     * Get mode colors map for stats/UI
     * @returns {Object} Map of mode ID to color
     */
    getColors() {
        const colors = {};
        this._modes.forEach((ModeClass, id) => {
            colors[id] = ModeClass.COLOR || '#ffffff';
        });
        return colors;
    },
    
    /**
     * Get mode color by ID
     * @param {number} id - Mode ID
     * @returns {string} Hex color
     */
    getColor(id) {
        const ModeClass = this.get(id);
        return ModeClass ? ModeClass.COLOR : '#ffffff';
    },
    
    /**
     * Get mode count
     * @returns {number} Number of registered modes
     */
    count() {
        return this._modes.size;
    },
    
    /**
     * Check if a mode is registered
     * @param {number} id - Mode ID
     * @returns {boolean}
     */
    has(id) {
        return this._modes.has(id);
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModeRegistry;
}

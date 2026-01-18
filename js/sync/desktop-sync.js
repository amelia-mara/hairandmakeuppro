/**
 * Desktop Sync Module
 * Handles sync code generation, device management, and data coordination
 */

const DesktopSync = {
    // Storage keys
    STORAGE_KEYS: {
        SYNC_CODES: 'hmp_sync_codes',
        LINKED_DEVICES: 'hmp_linked_devices',
        SYNC_HISTORY: 'hmp_sync_history'
    },

    // Sync code configuration
    CODE_LENGTH: 6,
    CODE_EXPIRY_HOURS: 24,

    /**
     * Initialize the sync module
     */
    init() {
        this.cleanExpiredCodes();
        console.log('[DesktopSync] Initialized');
    },

    /**
     * Generate a new 6-character sync code
     * Format: XXX-XXX (e.g., "A3X-7K2")
     */
    generateSyncCode(projectId) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0, O, 1, I)
        let code = '';

        for (let i = 0; i < this.CODE_LENGTH; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Format as XXX-XXX
        const formattedCode = code.slice(0, 3) + '-' + code.slice(3);
        const rawCode = code; // Without hyphen for storage

        const syncCodes = this.getSyncCodes();
        const now = Date.now();

        syncCodes[rawCode] = {
            projectId: projectId,
            formattedCode: formattedCode,
            createdAt: now,
            expiresAt: now + (this.CODE_EXPIRY_HOURS * 60 * 60 * 1000),
            linkedDevices: []
        };

        localStorage.setItem(this.STORAGE_KEYS.SYNC_CODES, JSON.stringify(syncCodes));

        return {
            code: formattedCode,
            rawCode: rawCode,
            expiresAt: syncCodes[rawCode].expiresAt
        };
    },

    /**
     * Validate a sync code
     */
    validateSyncCode(code) {
        const rawCode = code.replace(/-/g, '').toUpperCase();
        const syncCodes = this.getSyncCodes();
        const codeData = syncCodes[rawCode];

        if (!codeData) {
            return { valid: false, error: 'Invalid sync code' };
        }

        if (Date.now() > codeData.expiresAt) {
            return { valid: false, error: 'Sync code has expired' };
        }

        return {
            valid: true,
            projectId: codeData.projectId,
            codeData: codeData
        };
    },

    /**
     * Register a device with a sync code
     */
    registerDevice(code, deviceInfo) {
        const rawCode = code.replace(/-/g, '').toUpperCase();
        const syncCodes = this.getSyncCodes();
        const codeData = syncCodes[rawCode];

        if (!codeData) {
            return { success: false, error: 'Invalid sync code' };
        }

        const device = {
            id: deviceInfo.deviceId,
            name: deviceInfo.deviceName || 'Unknown Device',
            registeredAt: Date.now(),
            lastSync: null
        };

        // Check if device already registered
        const existingIndex = codeData.linkedDevices.findIndex(d => d.id === device.id);
        if (existingIndex >= 0) {
            codeData.linkedDevices[existingIndex] = device;
        } else {
            codeData.linkedDevices.push(device);
        }

        syncCodes[rawCode] = codeData;
        localStorage.setItem(this.STORAGE_KEYS.SYNC_CODES, JSON.stringify(syncCodes));

        // Also update linked devices list
        this.updateLinkedDevice(device, codeData.projectId);

        return { success: true, device: device };
    },

    /**
     * Update linked devices registry
     */
    updateLinkedDevice(device, projectId) {
        const devices = this.getLinkedDevices();

        const entry = {
            ...device,
            projectId: projectId,
            lastSync: Date.now()
        };

        const existingIndex = devices.findIndex(d => d.id === device.id);
        if (existingIndex >= 0) {
            devices[existingIndex] = entry;
        } else {
            devices.push(entry);
        }

        localStorage.setItem(this.STORAGE_KEYS.LINKED_DEVICES, JSON.stringify(devices));
    },

    /**
     * Get all sync codes
     */
    getSyncCodes() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SYNC_CODES)) || {};
        } catch {
            return {};
        }
    },

    /**
     * Get linked devices
     */
    getLinkedDevices() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.LINKED_DEVICES)) || [];
        } catch {
            return [];
        }
    },

    /**
     * Get linked devices for a specific project
     */
    getLinkedDevicesForProject(projectId) {
        return this.getLinkedDevices().filter(d => d.projectId === projectId);
    },

    /**
     * Remove a linked device
     */
    removeLinkedDevice(deviceId) {
        const devices = this.getLinkedDevices().filter(d => d.id !== deviceId);
        localStorage.setItem(this.STORAGE_KEYS.LINKED_DEVICES, JSON.stringify(devices));
    },

    /**
     * Clean up expired sync codes
     */
    cleanExpiredCodes() {
        const syncCodes = this.getSyncCodes();
        const now = Date.now();
        let cleaned = 0;

        Object.keys(syncCodes).forEach(code => {
            if (now > syncCodes[code].expiresAt) {
                delete syncCodes[code];
                cleaned++;
            }
        });

        if (cleaned > 0) {
            localStorage.setItem(this.STORAGE_KEYS.SYNC_CODES, JSON.stringify(syncCodes));
            console.log(`[DesktopSync] Cleaned ${cleaned} expired sync codes`);
        }
    },

    /**
     * Revoke a sync code
     */
    revokeSyncCode(code) {
        const rawCode = code.replace(/-/g, '').toUpperCase();
        const syncCodes = this.getSyncCodes();

        if (syncCodes[rawCode]) {
            delete syncCodes[rawCode];
            localStorage.setItem(this.STORAGE_KEYS.SYNC_CODES, JSON.stringify(syncCodes));
            return true;
        }
        return false;
    },

    /**
     * Get remaining time for a sync code
     */
    getCodeTimeRemaining(code) {
        const rawCode = code.replace(/-/g, '').toUpperCase();
        const syncCodes = this.getSyncCodes();
        const codeData = syncCodes[rawCode];

        if (!codeData) return null;

        const remaining = codeData.expiresAt - Date.now();
        if (remaining <= 0) return null;

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        return {
            total: remaining,
            hours,
            minutes,
            seconds,
            formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };
    },

    /**
     * Log sync activity
     */
    logSyncActivity(type, details) {
        try {
            const history = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SYNC_HISTORY)) || [];

            history.unshift({
                type: type,
                details: details,
                timestamp: Date.now()
            });

            // Keep last 100 entries
            if (history.length > 100) {
                history.splice(100);
            }

            localStorage.setItem(this.STORAGE_KEYS.SYNC_HISTORY, JSON.stringify(history));
        } catch (e) {
            console.error('[DesktopSync] Error logging sync activity:', e);
        }
    },

    /**
     * Get sync history
     */
    getSyncHistory(limit = 50) {
        try {
            const history = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SYNC_HISTORY)) || [];
            return history.slice(0, limit);
        } catch {
            return [];
        }
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.DesktopSync = DesktopSync;
}

export default DesktopSync;

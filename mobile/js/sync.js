/**
 * Mobile Sync Module
 * Handles project import from desktop and data export to desktop
 */

const MobileSync = {
    // Storage keys
    STORAGE_KEYS: {
        PROJECT: 'hmp_project',
        SCENES: 'hmp_scenes',
        CHARACTERS: 'hmp_characters',
        TIMESHEETS: 'hmp_timesheets',
        SYNC_STATUS: 'hmp_sync_status',
        PENDING_SYNC: 'hmp_pending_sync'
    },

    // Current sync state
    syncStatus: {
        connected: false,
        projectId: null,
        projectName: null,
        lastSync: null,
        pendingItems: 0
    },

    /**
     * Initialize the sync module
     */
    init() {
        this.loadSyncStatus();
        this.setupOfflineListener();
        console.log('[MobileSync] Initialized');
    },

    /**
     * Load sync status from storage
     */
    loadSyncStatus() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEYS.SYNC_STATUS);
            if (stored) {
                this.syncStatus = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[MobileSync] Error loading sync status:', e);
        }
        return this.syncStatus;
    },

    /**
     * Save sync status to storage
     */
    saveSyncStatus() {
        localStorage.setItem(this.STORAGE_KEYS.SYNC_STATUS, JSON.stringify(this.syncStatus));
    },

    /**
     * Setup listener for online/offline events
     */
    setupOfflineListener() {
        window.addEventListener('online', () => {
            console.log('[MobileSync] Back online, processing sync queue');
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            console.log('[MobileSync] Gone offline');
        });
    },

    /**
     * Import project data from desktop JSON file
     */
    async importProjectFromFile(file) {
        try {
            const text = await file.text();
            const payload = JSON.parse(text);

            // Validate payload
            if (!payload.syncVersion || !payload.project) {
                throw new Error('Invalid sync file format');
            }

            // Store project data
            const projectData = {
                id: payload.projectId,
                name: payload.project.name,
                genre: payload.project.genre,
                type: payload.project.type,
                importedAt: Date.now(),
                isDemo: false
            };
            localStorage.setItem(this.STORAGE_KEYS.PROJECT, JSON.stringify(projectData));

            // Store scenes
            if (payload.scenes && payload.scenes.length > 0) {
                localStorage.setItem(this.STORAGE_KEYS.SCENES, JSON.stringify(payload.scenes));
            }

            // Store characters
            if (payload.characters && payload.characters.length > 0) {
                const characterNames = payload.characters.map(c => c.name || c);
                localStorage.setItem(this.STORAGE_KEYS.CHARACTERS, JSON.stringify(characterNames));
            }

            // Store rate card if provided
            if (payload.rateCard) {
                localStorage.setItem('hmp_rate_card', JSON.stringify(payload.rateCard));
            }

            // Store crew member info if provided
            if (payload.crewMember) {
                localStorage.setItem('hmp_crew_member', JSON.stringify(payload.crewMember));
            }

            // Store shooting schedule if provided
            if (payload.schedule) {
                localStorage.setItem('hmp_shooting_schedule', JSON.stringify(payload.schedule));
            }

            // Update sync status
            this.syncStatus = {
                connected: true,
                projectId: payload.projectId,
                projectName: payload.project.name,
                lastSync: Date.now(),
                pendingItems: 0
            };
            this.saveSyncStatus();

            return {
                success: true,
                project: projectData,
                scenesCount: payload.scenes?.length || 0,
                charactersCount: payload.characters?.length || 0
            };

        } catch (error) {
            console.error('[MobileSync] Import error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Build export payload with timesheet and photo data
     */
    async buildExportPayload(options = {}) {
        const deviceId = await this.getDeviceId();
        const project = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PROJECT) || '{}');
        const timesheets = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TIMESHEETS) || '[]');

        // Filter timesheets by date range if specified
        let filteredTimesheets = timesheets;
        if (options.startDate) {
            filteredTimesheets = timesheets.filter(t => t.date >= options.startDate);
        }
        if (options.endDate) {
            filteredTimesheets = filteredTimesheets.filter(t => t.date <= options.endDate);
        }

        const payload = {
            syncVersion: '1.0.0',
            exportedAt: new Date().toISOString(),
            deviceId: deviceId,
            deviceName: this.getDeviceName(),
            projectId: project.id || this.syncStatus.projectId,

            timesheetEntries: filteredTimesheets.map(entry => ({
                id: entry.id,
                date: entry.date,
                dayNumber: entry.shootDay || entry.dayNumber,
                preCall: entry.preCall,
                unitCall: entry.unitCall,
                wrap: entry.wrap,
                sixthDay: entry.sixthDay || false,
                brokenLunch: entry.brokenLunch || false,
                notes: entry.notes || '',
                lastModified: entry.lastModified || Date.now()
            })),

            photos: []
        };

        // Get photos from IndexedDB
        if (typeof PhotoStorage !== 'undefined' && options.includePhotos !== false) {
            try {
                const photos = await PhotoStorage.getAllPhotos();
                payload.photos = photos.map(photo => ({
                    id: photo.id,
                    sceneIndex: photo.sceneIndex,
                    characterName: photo.characterName,
                    angle: photo.angle,
                    data: photo.data, // Base64 image
                    timestamp: photo.timestamp,
                    notes: photo.notes || ''
                }));
            } catch (e) {
                console.error('[MobileSync] Error getting photos:', e);
            }
        }

        return payload;
    },

    /**
     * Export data as JSON file
     */
    async exportToFile(options = {}) {
        try {
            const payload = await this.buildExportPayload(options);
            const date = new Date().toISOString().split('T')[0];
            const filename = `mobile_sync_${date}.json`;

            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json' });

            // Use Web Share API if available (mobile-friendly)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename)] })) {
                const file = new File([blob], filename, { type: 'application/json' });
                await navigator.share({
                    files: [file],
                    title: 'Hair & Makeup Pro Sync',
                    text: 'Sync data for desktop import'
                });
                return { success: true, method: 'share', filename };
            }

            // Fallback to download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return { success: true, method: 'download', filename };

        } catch (error) {
            console.error('[MobileSync] Export error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Export today's data only
     */
    async exportTodayData() {
        const today = new Date().toISOString().split('T')[0];
        return this.exportToFile({
            startDate: today,
            endDate: today,
            includePhotos: true
        });
    },

    /**
     * Export this week's data
     */
    async exportWeekData() {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);

        return this.exportToFile({
            startDate: monday.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0],
            includePhotos: true
        });
    },

    /**
     * Add item to sync queue for later upload
     */
    addToSyncQueue(type, data) {
        const queue = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PENDING_SYNC) || '[]');

        queue.push({
            id: Date.now().toString(),
            type: type, // 'timesheet' or 'photo'
            data: data,
            timestamp: Date.now(),
            attempts: 0
        });

        localStorage.setItem(this.STORAGE_KEYS.PENDING_SYNC, JSON.stringify(queue));

        // Update pending count
        this.syncStatus.pendingItems = queue.length;
        this.saveSyncStatus();

        return queue.length;
    },

    /**
     * Process sync queue (for future cloud sync)
     */
    async processSyncQueue() {
        const queue = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PENDING_SYNC) || '[]');

        if (queue.length === 0) return { processed: 0 };

        // For now, just log - actual cloud sync would go here
        console.log(`[MobileSync] Sync queue has ${queue.length} items waiting`);

        // In future: iterate through queue and upload to cloud
        // For MVP, items stay in queue until exported manually

        return { processed: 0, remaining: queue.length };
    },

    /**
     * Get pending sync count
     */
    getPendingSyncCount() {
        const queue = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PENDING_SYNC) || '[]');
        return queue.length;
    },

    /**
     * Clear sync queue (after successful manual export)
     */
    clearSyncQueue() {
        localStorage.setItem(this.STORAGE_KEYS.PENDING_SYNC, '[]');
        this.syncStatus.pendingItems = 0;
        this.saveSyncStatus();
    },

    /**
     * Get or generate device ID
     */
    async getDeviceId() {
        let deviceId = localStorage.getItem('hmp_device_id');

        if (!deviceId) {
            // Generate a UUID
            deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('hmp_device_id', deviceId);
        }

        return deviceId;
    },

    /**
     * Get device name
     */
    getDeviceName() {
        // Try to get a meaningful device name
        const ua = navigator.userAgent;

        if (/iPhone/.test(ua)) return 'iPhone';
        if (/iPad/.test(ua)) return 'iPad';
        if (/Android/.test(ua)) {
            const match = ua.match(/Android.*?;\s*([^)]+)/);
            if (match) return match[1].split(';')[0].trim();
            return 'Android Device';
        }

        return 'Mobile Device';
    },

    /**
     * Disconnect from project
     */
    disconnect() {
        this.syncStatus = {
            connected: false,
            projectId: null,
            projectName: null,
            lastSync: null,
            pendingItems: 0
        };
        this.saveSyncStatus();

        // Clear project data
        localStorage.removeItem(this.STORAGE_KEYS.PROJECT);
        localStorage.removeItem(this.STORAGE_KEYS.SCENES);
        localStorage.removeItem(this.STORAGE_KEYS.CHARACTERS);
        localStorage.removeItem('hmp_rate_card');
        localStorage.removeItem('hmp_crew_member');
    },

    /**
     * Get sync status summary for UI
     */
    getStatusSummary() {
        const pending = this.getPendingSyncCount();
        const isOnline = navigator.onLine;

        return {
            connected: this.syncStatus.connected,
            projectName: this.syncStatus.projectName,
            lastSync: this.syncStatus.lastSync,
            lastSyncFormatted: this.formatRelativeTime(this.syncStatus.lastSync),
            pendingItems: pending,
            isOnline: isOnline,
            statusText: this.getStatusText(pending, isOnline),
            statusClass: this.getStatusClass(pending, isOnline)
        };
    },

    /**
     * Get status text for UI
     */
    getStatusText(pending, isOnline) {
        if (!isOnline) return `Offline (${pending} pending)`;
        if (pending === 0) return 'Synced';
        return `${pending} pending`;
    },

    /**
     * Get status CSS class
     */
    getStatusClass(pending, isOnline) {
        if (!isOnline) return 'status-offline';
        if (pending === 0) return 'status-synced';
        return 'status-pending';
    },

    /**
     * Format relative time
     */
    formatRelativeTime(timestamp) {
        if (!timestamp) return 'Never';

        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.MobileSync = MobileSync;
    document.addEventListener('DOMContentLoaded', () => MobileSync.init());
}

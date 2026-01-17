/**
 * Hair & Makeup Pro - Photo Storage Module
 * Stage 4: Photo Capture System
 *
 * Uses IndexedDB for storing continuity photos with metadata.
 * Supports offline storage and efficient retrieval.
 */

const PhotoStorage = {
    // Database configuration
    DB_NAME: 'HairMakeupProPhotos',
    DB_VERSION: 1,
    STORE_NAME: 'photos',

    // Database instance
    db: null,

    // ============================================
    // DATABASE INITIALIZATION
    // ============================================

    /**
     * Initialize the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create photos object store
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Create indexes for efficient querying
                    store.createIndex('sceneIndex', 'sceneIndex', { unique: false });
                    store.createIndex('characterName', 'characterName', { unique: false });
                    store.createIndex('angle', 'angle', { unique: false });
                    store.createIndex('sceneCharacter', ['sceneIndex', 'characterName'], { unique: false });
                    store.createIndex('sceneCharacterAngle', ['sceneIndex', 'characterName', 'angle'], { unique: true });

                    console.log('IndexedDB store created with indexes');
                }
            };
        });
    },

    /**
     * Ensure database is ready
     */
    async ensureDB() {
        if (!this.db) {
            await this.init();
        }
        return this.db;
    },

    // ============================================
    // PHOTO OPERATIONS
    // ============================================

    /**
     * Save a photo to the database
     * @param {Object} photoData - Photo data object
     * @returns {Promise<number>} - The saved photo's ID
     */
    async savePhoto(photoData) {
        await this.ensureDB();

        const photo = {
            sceneIndex: photoData.sceneIndex,
            characterName: photoData.characterName,
            angle: photoData.angle, // 'front', 'left', 'right', 'back'
            data: photoData.data, // base64 image data
            timestamp: new Date().toISOString(),
            deviceId: this.getDeviceId()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);

            // First, check if a photo already exists for this scene/character/angle
            const index = store.index('sceneCharacterAngle');
            const key = [photo.sceneIndex, photo.characterName, photo.angle];
            const getRequest = index.get(key);

            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    // Update existing photo
                    photo.id = getRequest.result.id;
                    const updateRequest = store.put(photo);
                    updateRequest.onsuccess = () => resolve(photo.id);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    // Add new photo
                    const addRequest = store.add(photo);
                    addRequest.onsuccess = () => resolve(addRequest.result);
                    addRequest.onerror = () => reject(addRequest.error);
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    /**
     * Get a specific photo by scene, character, and angle
     * @param {number} sceneIndex
     * @param {string} characterName
     * @param {string} angle
     * @returns {Promise<Object|null>}
     */
    async getPhoto(sceneIndex, characterName, angle) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const index = store.index('sceneCharacterAngle');

            const request = index.get([sceneIndex, characterName, angle]);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all photos for a scene and character
     * @param {number} sceneIndex
     * @param {string} characterName
     * @returns {Promise<Array>}
     */
    async getPhotosForSceneCharacter(sceneIndex, characterName) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const index = store.index('sceneCharacter');

            const photos = [];
            const request = index.openCursor(IDBKeyRange.only([sceneIndex, characterName]));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    photos.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(photos);
                }
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all photos for a scene
     * @param {number} sceneIndex
     * @returns {Promise<Array>}
     */
    async getPhotosForScene(sceneIndex) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const index = store.index('sceneIndex');

            const photos = [];
            const request = index.openCursor(IDBKeyRange.only(sceneIndex));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    photos.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(photos);
                }
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all photos for a character across all scenes
     * @param {string} characterName
     * @returns {Promise<Array>}
     */
    async getPhotosForCharacter(characterName) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const index = store.index('characterName');

            const photos = [];
            const request = index.openCursor(IDBKeyRange.only(characterName));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    photos.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(photos);
                }
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all photos in the database
     * @returns {Promise<Array>}
     */
    async getAllPhotos() {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);

            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Delete a specific photo
     * @param {number} sceneIndex
     * @param {string} characterName
     * @param {string} angle
     * @returns {Promise<boolean>}
     */
    async deletePhoto(sceneIndex, characterName, angle) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const index = store.index('sceneCharacterAngle');

            const getRequest = index.get([sceneIndex, characterName, angle]);

            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    const deleteRequest = store.delete(getRequest.result.id);
                    deleteRequest.onsuccess = () => resolve(true);
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                } else {
                    resolve(false); // Photo didn't exist
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    /**
     * Delete all photos for a scene and character
     * @param {number} sceneIndex
     * @param {string} characterName
     * @returns {Promise<number>} - Number of deleted photos
     */
    async deletePhotosForSceneCharacter(sceneIndex, characterName) {
        const photos = await this.getPhotosForSceneCharacter(sceneIndex, characterName);

        for (const photo of photos) {
            await this.deletePhotoById(photo.id);
        }

        return photos.length;
    },

    /**
     * Delete a photo by its ID
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    async deletePhotoById(id) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);

            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Clear all photos from the database
     * @returns {Promise<void>}
     */
    async clearAllPhotos() {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);

            const request = store.clear();

            request.onsuccess = () => {
                console.log('All photos cleared from IndexedDB');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    },

    // ============================================
    // STATUS CALCULATION
    // ============================================

    /**
     * Get photo completion status for a scene/character
     * @param {number} sceneIndex
     * @param {string} characterName
     * @returns {Promise<Object>} - Status object with counts and completion
     */
    async getCompletionStatus(sceneIndex, characterName) {
        const photos = await this.getPhotosForSceneCharacter(sceneIndex, characterName);

        const angles = ['front', 'left', 'right', 'back'];
        const capturedAngles = photos.map(p => p.angle);

        const status = {
            total: 4,
            captured: capturedAngles.length,
            missing: angles.filter(a => !capturedAngles.includes(a)),
            isComplete: capturedAngles.length === 4,
            isPartial: capturedAngles.length > 0 && capturedAngles.length < 4,
            isPending: capturedAngles.length === 0,
            photos: {}
        };

        // Map photos by angle
        photos.forEach(photo => {
            status.photos[photo.angle] = photo;
        });

        return status;
    },

    /**
     * Get overall scene status based on all characters
     * @param {number} sceneIndex
     * @param {Array<string>} characterNames - Characters in this scene
     * @returns {Promise<string>} - 'complete', 'partial', or 'pending'
     */
    async getSceneStatus(sceneIndex, characterNames) {
        if (!characterNames || characterNames.length === 0) {
            return 'pending';
        }

        let hasAnyPhoto = false;
        let allComplete = true;

        for (const characterName of characterNames) {
            const status = await this.getCompletionStatus(sceneIndex, characterName);

            if (status.captured > 0) {
                hasAnyPhoto = true;
            }

            if (!status.isComplete) {
                allComplete = false;
            }
        }

        if (allComplete && hasAnyPhoto) {
            return 'complete';
        } else if (hasAnyPhoto) {
            return 'partial';
        } else {
            return 'pending';
        }
    },

    /**
     * Get status for all scenes
     * @param {Array} scenes - Array of scene objects with characters
     * @returns {Promise<Object>} - Map of sceneIndex to status
     */
    async getAllSceneStatuses(scenes) {
        const statuses = {};

        for (const scene of scenes) {
            statuses[scene.index] = await this.getSceneStatus(scene.index, scene.characters);
        }

        return statuses;
    },

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Get photo count
     * @returns {Promise<number>}
     */
    async getPhotoCount() {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);

            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Estimate storage usage
     * @returns {Promise<Object>}
     */
    async getStorageStats() {
        const photos = await this.getAllPhotos();
        const count = photos.length;

        // Estimate size (base64 is ~1.37x larger than binary)
        let totalSize = 0;
        photos.forEach(photo => {
            if (photo.data) {
                totalSize += photo.data.length;
            }
        });

        return {
            count,
            totalSizeBytes: totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            averageSizeKB: count > 0 ? ((totalSize / count) / 1024).toFixed(1) : 0
        };
    },

    // ============================================
    // UTILITIES
    // ============================================

    /**
     * Get or generate a device ID
     * @returns {string}
     */
    getDeviceId() {
        let deviceId = localStorage.getItem('hmp_device_id');
        if (!deviceId) {
            deviceId = 'mobile-' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('hmp_device_id', deviceId);
        }
        return deviceId;
    },

    /**
     * Get the most recent photo for a character (for reference)
     * @param {string} characterName
     * @param {number} beforeSceneIndex - Get photo from before this scene
     * @returns {Promise<Object|null>}
     */
    async getMostRecentPhoto(characterName, beforeSceneIndex) {
        const photos = await this.getPhotosForCharacter(characterName);

        // Filter to photos from earlier scenes and sort by scene index (descending)
        const relevantPhotos = photos
            .filter(p => p.sceneIndex < beforeSceneIndex)
            .sort((a, b) => b.sceneIndex - a.sceneIndex);

        // Return the front photo from the most recent scene, or any photo
        const frontPhoto = relevantPhotos.find(p => p.angle === 'front');
        return frontPhoto || relevantPhotos[0] || null;
    }
};

// Export for global access
window.PhotoStorage = PhotoStorage;

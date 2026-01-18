/**
 * Desktop Import/Export Module
 * Handles data export to mobile and import from mobile
 */

const SyncImportExport = {
    // Version for data compatibility
    SYNC_VERSION: '1.0.0',

    /**
     * Build the sync payload to send to mobile
     * Contains project settings, rate card, scenes, and characters
     */
    buildExportPayload(projectId) {
        const project = this.getCurrentProject();
        const scenes = this.getScenes();
        const characters = this.getCharacters();
        const rateCard = this.getRateCard();
        const masterContext = this.getMasterContext();
        const sceneBreakdowns = this.getSceneBreakdowns();

        return {
            syncVersion: this.SYNC_VERSION,
            exportedAt: new Date().toISOString(),
            projectId: projectId || project?.id || Date.now().toString(),

            // Project metadata
            project: {
                id: project?.id || Date.now().toString(),
                name: project?.name || 'Untitled Project',
                genre: project?.genre || '',
                type: project?.type || '',
                productionStart: project?.productionStart || null,
                productionEnd: project?.productionEnd || null
            },

            // Rate card settings for timesheet calculations
            rateCard: rateCard || {
                dayStructure: '10+1',
                baseHours: 10,
                lunchDuration: 60,
                dayRate: 350,
                otMultiplier: 1.5,
                lateOtMultiplier: 2.0,
                lateNightThreshold: '23:00',
                sixthDayMultiplier: 1.5,
                preCallMultiplier: 1.5,
                deRigMultiplier: 1.5,
                brokenLunchMultiplier: 1.5,
                brokenTurnaroundMultiplier: 1.5,
                requiredTurnaround: 11
            },

            // Crew member info (current user)
            crewMember: this.getCrewMember(),

            // Scenes for continuity reference (simplified)
            scenes: scenes.map((scene, index) => {
                // Get synopsis from sceneBreakdowns if available
                const breakdown = sceneBreakdowns[index] || sceneBreakdowns[scene.sceneNumber] || {};
                return {
                    index: index,
                    number: scene.sceneNumber || (index + 1),
                    heading: scene.heading || scene.title || `Scene ${index + 1}`,
                    storyDay: scene.storyDay || null,
                    timeOfDay: scene.timeOfDay || null,
                    location: scene.location || null,
                    characters: scene.characters || [],
                    // Include synopsis data
                    synopsis: breakdown.synopsis || scene.synopsis || null,
                    synopsisSource: (breakdown.synopsis || scene.synopsis) ? 'desktop' : null,
                    content: scene.content || null // Full scene content if available
                };
            }),

            // Characters for continuity
            characters: characters.map(char => ({
                id: char.id || char.name,
                name: char.name || char,
                scenes: char.scenes || []
            })),

            // Simplified breakdowns for mobile reference
            breakdowns: this.simplifyBreakdowns(sceneBreakdowns),

            // Master context summary (if available)
            masterContextSummary: masterContext ? {
                title: masterContext.title,
                totalScenes: masterContext.totalScenes,
                storyDays: masterContext.storyStructure?.totalDays || null,
                characterCount: Object.keys(masterContext.characters || {}).length
            } : null,

            // Shooting schedule (if available)
            schedule: this.getShootingSchedule()
        };
    },

    /**
     * Export project data as JSON file for mobile
     */
    async exportForMobile(projectId) {
        try {
            const payload = this.buildExportPayload(projectId);
            const projectName = payload.project.name.replace(/[^a-z0-9]/gi, '_');
            const filename = `${projectName}_mobile_sync.json`;

            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json' });

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Log activity
            if (window.DesktopSync) {
                window.DesktopSync.logSyncActivity('export', {
                    projectId: projectId,
                    filename: filename,
                    scenesCount: payload.scenes.length,
                    charactersCount: payload.characters.length
                });
            }

            return { success: true, filename: filename, payload: payload };
        } catch (error) {
            console.error('[SyncImportExport] Export error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Import data from mobile (timesheet entries and photos)
     */
    async importFromMobile(file) {
        try {
            const text = await file.text();
            const payload = JSON.parse(text);

            const result = {
                success: true,
                timesheetsImported: 0,
                photosImported: 0,
                errors: []
            };

            // Import timesheet entries
            if (payload.timesheetEntries && payload.timesheetEntries.length > 0) {
                for (const entry of payload.timesheetEntries) {
                    try {
                        await this.mergeTimesheetEntry(entry);
                        result.timesheetsImported++;
                    } catch (e) {
                        result.errors.push(`Timesheet ${entry.date}: ${e.message}`);
                    }
                }
            }

            // Import photos
            if (payload.photos && payload.photos.length > 0) {
                for (const photo of payload.photos) {
                    try {
                        await this.importPhoto(photo);
                        result.photosImported++;
                    } catch (e) {
                        result.errors.push(`Photo ${photo.id}: ${e.message}`);
                    }
                }
            }

            // Recalculate pay for imported entries
            if (result.timesheetsImported > 0) {
                this.recalculatePayForEntries(payload.timesheetEntries);
            }

            // Log activity
            if (window.DesktopSync) {
                window.DesktopSync.logSyncActivity('import', {
                    deviceId: payload.deviceId,
                    projectId: payload.projectId,
                    timesheetsImported: result.timesheetsImported,
                    photosImported: result.photosImported
                });
            }

            return result;
        } catch (error) {
            console.error('[SyncImportExport] Import error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Merge a timesheet entry (last-write-wins with merge for non-conflicting fields)
     */
    async mergeTimesheetEntry(incoming) {
        const timesheets = this.getTimesheets();
        const existingIndex = timesheets.findIndex(t => t.id === incoming.id || t.date === incoming.date);

        if (existingIndex >= 0) {
            const existing = timesheets[existingIndex];

            // If incoming is newer, use it but preserve desktop-only calculations
            if (!existing.lastModified || incoming.lastModified > existing.lastModified) {
                timesheets[existingIndex] = {
                    ...existing,
                    ...incoming,
                    // Preserve any desktop-specific fields
                    calculatedPay: existing.calculatedPay,
                    payBreakdown: existing.payBreakdown,
                    mergedAt: Date.now(),
                    source: 'mobile'
                };
            } else {
                // Existing is newer, but add any new fields from incoming
                timesheets[existingIndex] = {
                    ...incoming,
                    ...existing
                };
            }
        } else {
            // New entry
            timesheets.push({
                ...incoming,
                importedAt: Date.now(),
                source: 'mobile'
            });
        }

        localStorage.setItem('hmp_timesheets', JSON.stringify(timesheets));
        return timesheets;
    },

    /**
     * Import a photo into IndexedDB
     */
    async importPhoto(photo) {
        // Open or create IndexedDB
        const db = await this.openPhotoDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');

            // Check if photo already exists
            const index = store.index('sceneCharacterAngle');
            const request = index.get([photo.sceneIndex, photo.characterName, photo.angle]);

            request.onsuccess = (event) => {
                const existing = event.target.result;

                if (existing) {
                    // Update existing photo if newer
                    if (!existing.timestamp || new Date(photo.timestamp) > new Date(existing.timestamp)) {
                        const updateRequest = store.put({
                            ...existing,
                            ...photo,
                            id: existing.id,
                            importedAt: Date.now()
                        });
                        updateRequest.onsuccess = () => resolve(true);
                        updateRequest.onerror = () => reject(new Error('Failed to update photo'));
                    } else {
                        resolve(false); // Existing is newer, skip
                    }
                } else {
                    // Add new photo
                    const addRequest = store.add({
                        ...photo,
                        importedAt: Date.now()
                    });
                    addRequest.onsuccess = () => resolve(true);
                    addRequest.onerror = () => reject(new Error('Failed to add photo'));
                }
            };

            request.onerror = () => reject(new Error('Failed to check existing photo'));
        });
    },

    /**
     * Open/create photo IndexedDB (same as mobile for compatibility)
     */
    async openPhotoDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('HairMakeupProPhotos', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('photos')) {
                    const store = db.createObjectStore('photos', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('sceneIndex', 'sceneIndex', { unique: false });
                    store.createIndex('characterName', 'characterName', { unique: false });
                    store.createIndex('angle', 'angle', { unique: false });
                    store.createIndex('sceneCharacter', ['sceneIndex', 'characterName'], { unique: false });
                    store.createIndex('sceneCharacterAngle', ['sceneIndex', 'characterName', 'angle'], { unique: true });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Failed to open photo database'));
        });
    },

    /**
     * Recalculate pay for timesheet entries using rate card
     */
    recalculatePayForEntries(entries) {
        const rateCard = this.getRateCard();
        if (!rateCard) return;

        const timesheets = this.getTimesheets();

        for (const entry of entries) {
            const index = timesheets.findIndex(t => t.id === entry.id || t.date === entry.date);
            if (index >= 0) {
                const ts = timesheets[index];
                const calculation = this.calculatePay(ts, rateCard);
                timesheets[index] = {
                    ...ts,
                    ...calculation
                };
            }
        }

        localStorage.setItem('hmp_timesheets', JSON.stringify(timesheets));
    },

    /**
     * Calculate pay for a timesheet entry
     */
    calculatePay(entry, rateCard) {
        const preCall = this.parseTime(entry.preCall);
        const unitCall = this.parseTime(entry.unitCall);
        const wrap = this.parseTime(entry.wrap);

        if (!preCall || !unitCall || !wrap) {
            return { calculatedPay: null, payBreakdown: null };
        }

        const preCallMinutes = (unitCall.hours * 60 + unitCall.minutes) - (preCall.hours * 60 + preCall.minutes);
        const workMinutes = (wrap.hours * 60 + wrap.minutes) - (unitCall.hours * 60 + unitCall.minutes) - rateCard.lunchDuration;
        const totalMinutes = preCallMinutes + workMinutes;
        const totalHours = totalMinutes / 60;

        const baseHours = rateCard.baseHours;
        const hourlyRate = rateCard.dayRate / baseHours;

        let pay = rateCard.dayRate;
        let breakdown = {
            baseDay: rateCard.dayRate,
            preCallPay: 0,
            overtimePay: 0,
            sixthDayBonus: 0,
            brokenLunchPay: 0
        };

        // Pre-call pay
        if (preCallMinutes > 0) {
            breakdown.preCallPay = (preCallMinutes / 60) * hourlyRate * rateCard.preCallMultiplier;
            pay += breakdown.preCallPay;
        }

        // Overtime pay
        if (workMinutes > baseHours * 60) {
            const otMinutes = workMinutes - (baseHours * 60);
            breakdown.overtimePay = (otMinutes / 60) * hourlyRate * rateCard.otMultiplier;
            pay += breakdown.overtimePay;
        }

        // Sixth day bonus
        if (entry.sixthDay) {
            breakdown.sixthDayBonus = rateCard.dayRate * (rateCard.sixthDayMultiplier - 1);
            pay += breakdown.sixthDayBonus;
        }

        // Broken lunch pay
        if (entry.brokenLunch) {
            breakdown.brokenLunchPay = hourlyRate * rateCard.brokenLunchMultiplier;
            pay += breakdown.brokenLunchPay;
        }

        return {
            calculatedPay: Math.round(pay * 100) / 100,
            payBreakdown: breakdown,
            totalHours: Math.round(totalHours * 100) / 100
        };
    },

    /**
     * Parse time string "HH:MM" to object
     */
    parseTime(timeStr) {
        if (!timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        return { hours, minutes };
    },

    // ========== Data Access Helpers ==========

    getCurrentProject() {
        try {
            // Try multiple storage keys for compatibility
            const current = localStorage.getItem('currentProject');
            if (current) return JSON.parse(current);

            const projects = localStorage.getItem('checksHappyProjects');
            if (projects) {
                const arr = JSON.parse(projects);
                return arr.length > 0 ? arr[0] : null;
            }

            const hmpProject = localStorage.getItem('hmp_project');
            if (hmpProject) return JSON.parse(hmpProject);

            return null;
        } catch {
            return null;
        }
    },

    getScenes() {
        try {
            const scenes = localStorage.getItem('hmp_scenes');
            return scenes ? JSON.parse(scenes) : [];
        } catch {
            return [];
        }
    },

    getCharacters() {
        try {
            const chars = localStorage.getItem('hmp_characters');
            if (chars) {
                const parsed = JSON.parse(chars);
                // Handle both array and Set-like structures
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') return Object.values(parsed);
            }
            return [];
        } catch {
            return [];
        }
    },

    getRateCard() {
        try {
            const rateCard = localStorage.getItem('hmp_rate_card');
            return rateCard ? JSON.parse(rateCard) : null;
        } catch {
            return null;
        }
    },

    getMasterContext() {
        try {
            const mc = localStorage.getItem('masterContext');
            return mc ? JSON.parse(mc) : null;
        } catch {
            return null;
        }
    },

    getSceneBreakdowns() {
        try {
            const breakdowns = localStorage.getItem('hmp_scene_breakdowns');
            return breakdowns ? JSON.parse(breakdowns) : {};
        } catch {
            return {};
        }
    },

    getTimesheets() {
        try {
            const timesheets = localStorage.getItem('hmp_timesheets');
            return timesheets ? JSON.parse(timesheets) : [];
        } catch {
            return [];
        }
    },

    getCrewMember() {
        try {
            const crew = localStorage.getItem('hmp_crew_member');
            return crew ? JSON.parse(crew) : {
                id: 'default',
                name: 'Crew Member',
                position: 'HOD',
                department: 'Hair & Makeup',
                dayRate: 350,
                employmentType: 'Ltd'
            };
        } catch {
            return null;
        }
    },

    getShootingSchedule() {
        try {
            const schedule = localStorage.getItem('hmp_shooting_schedule');
            return schedule ? JSON.parse(schedule) : [];
        } catch {
            return [];
        }
    },

    /**
     * Simplify breakdowns for mobile (reduce payload size)
     */
    simplifyBreakdowns(breakdowns) {
        if (!breakdowns) return {};

        const simplified = {};
        for (const [key, breakdown] of Object.entries(breakdowns)) {
            simplified[key] = {
                cast: breakdown.cast || [],
                hair: (breakdown.hair || []).map(h => ({
                    character: h.character,
                    description: h.description
                })),
                makeup: (breakdown.makeup || []).map(m => ({
                    character: m.character,
                    description: m.description
                })),
                synopsis: breakdown.synopsis || ''
            };
        }
        return simplified;
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.SyncImportExport = SyncImportExport;
}

export default SyncImportExport;

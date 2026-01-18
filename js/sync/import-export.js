/**
 * Desktop Import/Export Module
 * Handles data export to mobile and import from mobile
 */

const SyncImportExport = {
    // Version for data compatibility
    SYNC_VERSION: '1.1.0',

    // ============================================
    // CONTINUITY EVENT TYPE MAPPING
    // ============================================
    // Website types: 'injury', 'condition', 'transformation', 'wardrobe_change', 'makeup_effect'
    // Mobile types: 'Wound', 'Bruise', 'Prosthetic', 'Scar', 'Tattoo', 'Other'

    WEBSITE_TO_MOBILE_EVENT_TYPES: {
        'injury': 'Wound',
        'condition': 'Other',
        'transformation': 'Prosthetic',
        'wardrobe_change': 'Other',
        'makeup_effect': 'Other'
    },

    MOBILE_TO_WEBSITE_EVENT_TYPES: {
        'Wound': 'injury',
        'Bruise': 'injury',
        'Prosthetic': 'transformation',
        'Scar': 'makeup_effect',
        'Tattoo': 'makeup_effect',
        'Other': 'condition'
    },

    /**
     * Map website continuity event to mobile format
     */
    mapWebsiteEventToMobile(event) {
        return {
            id: event.id,
            type: this.WEBSITE_TO_MOBILE_EVENT_TYPES[event.type] || 'Other',
            name: event.description?.split(' ').slice(0, 3).join(' ') || event.type,
            description: event.description || '',
            stage: event.progression?.[0]?.stage || 'Fresh',
            sceneRange: event.startScene && event.endScene
                ? `${event.startScene}-${event.endScene}`
                : event.startScene?.toString() || '',
            products: event.progression?.[0]?.makeupNotes || '',
            referencePhotos: [],
            // Preserve original data for reverse sync
            _websiteType: event.type,
            _progression: event.progression
        };
    },

    /**
     * Map mobile continuity event to website format
     */
    mapMobileEventToWebsite(event) {
        // Parse scene range (e.g., "5-10" or "5")
        let startScene = null, endScene = null;
        if (event.sceneRange) {
            const parts = event.sceneRange.split('-').map(s => parseInt(s.trim()));
            startScene = parts[0] || null;
            endScene = parts[1] || parts[0] || null;
        }

        return {
            id: event.id,
            character: event.characterName || '',
            type: event._websiteType || this.MOBILE_TO_WEBSITE_EVENT_TYPES[event.type] || 'condition',
            startScene: startScene,
            endScene: endScene,
            description: event.description || event.name || '',
            progression: event._progression || [{
                sceneIndex: startScene,
                stage: event.stage || 'Fresh',
                description: event.description,
                makeupNotes: event.products,
                hairNotes: ''
            }],
            createdAt: new Date().toISOString()
        };
    },

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
            schedule: this.getShootingSchedule(),

            // Timesheet entries (mapped to mobile format)
            timesheetEntries: this.getTimesheets().map(entry => this.mapWebsiteToMobileFields(entry)),

            // Continuity events (mapped to mobile format)
            continuityEvents: this.getContinuityEvents().map(event => this.mapWebsiteEventToMobile(event)),

            // Continuity flags (quick status flags)
            continuityFlags: this.getContinuityFlags()
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
     * Import data from mobile (timesheet entries, photos, continuity data)
     */
    async importFromMobile(file) {
        try {
            const text = await file.text();
            const payload = JSON.parse(text);

            const result = {
                success: true,
                timesheetsImported: 0,
                photosImported: 0,
                continuityEventsImported: 0,
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

            // Import continuity events from mobile
            if (payload.continuityEvents && payload.continuityEvents.length > 0) {
                try {
                    this.saveContinuityEvents(payload.continuityEvents);
                    result.continuityEventsImported = payload.continuityEvents.length;
                } catch (e) {
                    result.errors.push(`Continuity events: ${e.message}`);
                }
            }

            // Import continuity flags from mobile
            if (payload.continuityFlags) {
                try {
                    this.saveContinuityFlags(payload.continuityFlags);
                } catch (e) {
                    result.errors.push(`Continuity flags: ${e.message}`);
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
                    photosImported: result.photosImported,
                    continuityEventsImported: result.continuityEventsImported
                });
            }

            return result;
        } catch (error) {
            console.error('[SyncImportExport] Import error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Map mobile timesheet fields to website format
     * Mobile uses: outOfChair (done with talent), wrapOut (leave building)
     * Website uses: actualWrap (done with work), deRig (leave building)
     */
    mapMobileToWebsiteFields(mobileEntry) {
        return {
            ...mobileEntry,
            // Map mobile field names to website field names
            actualWrap: mobileEntry.outOfChair || mobileEntry.actualWrap || '',
            deRig: mobileEntry.wrapOut || mobileEntry.deRig || '',
            sixthDay: mobileEntry.isSixthDay ?? mobileEntry.sixthDay ?? false,
            lunchActual: mobileEntry.lunchTaken ?? mobileEntry.lunchActual ?? 60,
            lunchSched: mobileEntry.lunchTaken ?? mobileEntry.lunchSched ?? 60,
            // Keep original fields for reverse sync
            outOfChair: mobileEntry.outOfChair || '',
            wrapOut: mobileEntry.wrapOut || ''
        };
    },

    /**
     * Map website timesheet fields to mobile format
     */
    mapWebsiteToMobileFields(websiteEntry) {
        return {
            ...websiteEntry,
            // Map website field names to mobile field names
            outOfChair: websiteEntry.actualWrap || websiteEntry.outOfChair || '',
            wrapOut: websiteEntry.deRig || websiteEntry.wrapOut || '',
            isSixthDay: websiteEntry.sixthDay ?? websiteEntry.isSixthDay ?? false,
            lunchTaken: websiteEntry.lunchActual ?? websiteEntry.lunchTaken ?? 60,
            // Keep original fields for reverse sync
            actualWrap: websiteEntry.actualWrap || '',
            deRig: websiteEntry.deRig || ''
        };
    },

    /**
     * Merge a timesheet entry (last-write-wins with merge for non-conflicting fields)
     */
    async mergeTimesheetEntry(incoming) {
        const timesheets = this.getTimesheets();

        // Map mobile fields to website format
        const mappedIncoming = this.mapMobileToWebsiteFields(incoming);

        const existingIndex = timesheets.findIndex(t => t.id === mappedIncoming.id || t.date === mappedIncoming.date);

        if (existingIndex >= 0) {
            const existing = timesheets[existingIndex];

            // If incoming is newer, use it but preserve desktop-only calculations
            if (!existing.lastModified || mappedIncoming.lastModified > existing.lastModified) {
                timesheets[existingIndex] = {
                    ...existing,
                    ...mappedIncoming,
                    // Preserve any desktop-specific fields
                    calculatedPay: existing.calculatedPay,
                    payBreakdown: existing.payBreakdown,
                    mergedAt: Date.now(),
                    source: 'mobile'
                };
            } else {
                // Existing is newer, but add any new fields from incoming
                timesheets[existingIndex] = {
                    ...mappedIncoming,
                    ...existing
                };
            }
        } else {
            // New entry
            timesheets.push({
                ...mappedIncoming,
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
     * Handles both website format (actualWrap/deRig) and mobile format (outOfChair/wrapOut)
     */
    calculatePay(entry, rateCard) {
        const preCall = this.parseTime(entry.preCall);
        const unitCall = this.parseTime(entry.unitCall);
        // Use actualWrap/outOfChair as main wrap time (done with talent)
        const wrap = this.parseTime(entry.actualWrap || entry.outOfChair);
        // Use deRig/wrapOut as final out time (leave building)
        const finalOut = this.parseTime(entry.deRig || entry.wrapOut);

        if (!unitCall || !wrap) {
            return { calculatedPay: null, payBreakdown: null };
        }

        // Calculate pre-call hours (before unit call)
        let preCallMinutes = 0;
        if (preCall) {
            preCallMinutes = (unitCall.hours * 60 + unitCall.minutes) - (preCall.hours * 60 + preCall.minutes);
            if (preCallMinutes < 0) preCallMinutes = 0; // Handle edge cases
        }

        // Calculate main work minutes (unit call to wrap, minus lunch)
        const lunchMinutes = entry.lunchActual ?? entry.lunchTaken ?? rateCard.lunchDuration ?? 60;
        let workMinutes = (wrap.hours * 60 + wrap.minutes) - (unitCall.hours * 60 + unitCall.minutes) - lunchMinutes;
        // Handle overnight wrap
        if (workMinutes < 0) {
            workMinutes += 24 * 60;
        }

        // Calculate de-rig/post-wrap time (after wrap, before leaving building)
        let deRigMinutes = 0;
        if (finalOut && wrap) {
            deRigMinutes = (finalOut.hours * 60 + finalOut.minutes) - (wrap.hours * 60 + wrap.minutes);
            if (deRigMinutes < 0) deRigMinutes += 24 * 60; // Handle overnight
        }

        const totalMinutes = preCallMinutes + workMinutes + deRigMinutes;
        const totalHours = totalMinutes / 60;

        const baseHours = rateCard.baseHours || 10;
        const hourlyRate = rateCard.dayRate / baseHours;

        let pay = rateCard.dayRate;
        let breakdown = {
            baseDay: rateCard.dayRate,
            preCallPay: 0,
            overtimePay: 0,
            deRigPay: 0,
            sixthDayBonus: 0,
            brokenLunchPay: 0
        };

        // Pre-call pay (1.5x)
        if (preCallMinutes > 0) {
            const multiplier = rateCard.preCallMultiplier || 1.5;
            breakdown.preCallPay = (preCallMinutes / 60) * hourlyRate * multiplier;
            pay += breakdown.preCallPay;
        }

        // Overtime pay (1.5x after base hours)
        if (workMinutes > baseHours * 60) {
            const otMinutes = workMinutes - (baseHours * 60);
            const multiplier = rateCard.otMultiplier || 1.5;
            breakdown.overtimePay = (otMinutes / 60) * hourlyRate * multiplier;
            pay += breakdown.overtimePay;
        }

        // De-rig/post-wrap pay (1.5x)
        if (deRigMinutes > 0) {
            const multiplier = rateCard.deRigMultiplier || rateCard.preCallMultiplier || 1.5;
            breakdown.deRigPay = (deRigMinutes / 60) * hourlyRate * multiplier;
            pay += breakdown.deRigPay;
        }

        // Sixth day bonus
        const isSixthDay = entry.sixthDay ?? entry.isSixthDay ?? false;
        if (isSixthDay) {
            const multiplier = rateCard.sixthDayMultiplier || 1.5;
            breakdown.sixthDayBonus = rateCard.dayRate * (multiplier - 1);
            pay += breakdown.sixthDayBonus;
        }

        // Broken lunch pay
        if (entry.brokenLunch) {
            const multiplier = rateCard.brokenLunchMultiplier || 1.5;
            breakdown.brokenLunchPay = hourlyRate * multiplier;
            pay += breakdown.brokenLunchPay;
        }

        return {
            calculatedPay: Math.round(pay * 100) / 100,
            payBreakdown: breakdown,
            totalHours: Math.round(totalHours * 100) / 100,
            hoursBreakdown: {
                preCall: Math.round((preCallMinutes / 60) * 100) / 100,
                base: Math.min(workMinutes / 60, baseHours),
                overtime: Math.max(0, (workMinutes / 60) - baseHours),
                deRig: Math.round((deRigMinutes / 60) * 100) / 100
            }
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

    getContinuityEvents() {
        try {
            const events = localStorage.getItem('hmp_continuity_events');
            return events ? JSON.parse(events) : [];
        } catch {
            return [];
        }
    },

    getContinuityFlags() {
        try {
            const flags = localStorage.getItem('hmp_continuity_flags');
            return flags ? JSON.parse(flags) : {};
        } catch {
            return {};
        }
    },

    /**
     * Save continuity events from mobile import
     */
    saveContinuityEvents(events) {
        try {
            const existing = this.getContinuityEvents();
            const merged = [...existing];

            for (const event of events) {
                const mappedEvent = this.mapMobileEventToWebsite(event);
                const existingIndex = merged.findIndex(e => e.id === mappedEvent.id);

                if (existingIndex >= 0) {
                    merged[existingIndex] = { ...merged[existingIndex], ...mappedEvent };
                } else {
                    merged.push(mappedEvent);
                }
            }

            localStorage.setItem('hmp_continuity_events', JSON.stringify(merged));
            return merged;
        } catch (error) {
            console.error('[SyncImportExport] Error saving continuity events:', error);
            return [];
        }
    },

    /**
     * Save continuity flags from mobile import
     */
    saveContinuityFlags(flags) {
        try {
            const existing = this.getContinuityFlags();
            const merged = { ...existing, ...flags };
            localStorage.setItem('hmp_continuity_flags', JSON.stringify(merged));
            return merged;
        } catch (error) {
            console.error('[SyncImportExport] Error saving continuity flags:', error);
            return {};
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

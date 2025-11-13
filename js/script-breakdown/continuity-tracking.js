/**
 * continuity-tracking.js
 * Advanced continuity event tracking and script supervisor integration
 *
 * Responsibilities:
 * - Track continuity events (injuries, conditions, transformations)
 * - Generate progression stages across scenes
 * - Script supervisor breakdown integration
 * - Cross-reference validation
 */

import { state } from './main.js';
import { callAI } from './ai-integration.js';

// ============================================================================
// CONTINUITY EVENT TRACKER
// ============================================================================

/**
 * ContinuityEventTracker - Manages ongoing continuity events across scenes
 */
class ContinuityEventTracker {
    constructor() {
        this.events = new Map();
        this.nextId = 1;
    }

    /**
     * Create a new continuity event
     */
    createEvent(sceneId, character, type, description = '') {
        const event = {
            id: `event-${this.nextId++}`,
            character: character,
            type: type, // 'injury', 'condition', 'transformation', 'wardrobe_change', 'makeup_effect'
            startScene: sceneId,
            endScene: null,
            progression: [],
            description: description,
            createdAt: new Date().toISOString()
        };

        this.events.set(event.id, event);

        // Add event reference to scene
        if (!state.continuityEvents[character]) {
            state.continuityEvents[character] = [];
        }
        state.continuityEvents[character].push(event);

        return event;
    }

    /**
     * Close/resolve a continuity event
     */
    closeEvent(eventId, endScene) {
        const event = this.events.get(eventId);
        if (!event) return;

        event.endScene = endScene;

        // Generate progression if span is more than one scene
        if (endScene - event.startScene > 0) {
            this.generateProgression(event);
        }
    }

    /**
     * Generate AI-powered progression stages for an event
     */
    async generateProgression(event) {
        const startScene = state.scenes[event.startScene];
        const endScene = state.scenes[event.endScene];
        const scenesCount = event.endScene - event.startScene + 1;

        // Get story days for context
        const startDay = state.sceneTimeline[event.startScene]?.day || 'Unknown';
        const endDay = state.sceneTimeline[event.endScene]?.day || 'Unknown';

        const prompt = `Generate realistic progression stages for a continuity event.

Character: ${event.character}
Event Type: ${event.type}
Description: ${event.description}

Timeline:
- Starts: Scene ${event.startScene} (Story Day ${startDay})
- Ends: Scene ${event.endScene} (Story Day ${endDay})
- Total scenes in span: ${scenesCount}

Context:
Start scene: ${startScene.heading}
End scene: ${endScene.heading}

Create a progression showing how this ${event.type} evolves realistically across these scenes.
Consider:
- Story time passing (not just scene count)
- Natural healing/progression rates
- Visual continuity for hair & makeup department

Return as JSON array with one entry per scene:
[
  {
    "sceneIndex": 5,
    "stage": "early",
    "description": "Brief visual description",
    "makeupNotes": "Specific makeup requirements",
    "hairNotes": "Any hair considerations"
  }
]`;

        try {
            const response = await callAI(prompt, 1500);
            event.progression = JSON.parse(response);

            // Apply progression to affected scenes
            this.applyProgressionToScenes(event);
        } catch (error) {
            console.error('Error generating progression:', error);
            // Create basic progression if AI fails
            event.progression = this.createBasicProgression(event);
            this.applyProgressionToScenes(event);
        }
    }

    /**
     * Create basic progression without AI
     */
    createBasicProgression(event) {
        const progression = [];
        const scenesCount = event.endScene - event.startScene + 1;

        for (let i = 0; i < scenesCount; i++) {
            const sceneIndex = event.startScene + i;
            const percentage = (i / (scenesCount - 1)) * 100;

            let stage;
            if (percentage < 25) stage = 'early';
            else if (percentage < 50) stage = 'developing';
            else if (percentage < 75) stage = 'progressing';
            else stage = 'late';

            progression.push({
                sceneIndex: sceneIndex,
                stage: stage,
                description: `${event.type} - ${stage} stage`,
                makeupNotes: `See ${event.character} continuity notes`,
                hairNotes: 'Maintain consistency'
            });
        }

        return progression;
    }

    /**
     * Apply progression data to scene breakdowns
     */
    applyProgressionToScenes(event) {
        for (const stage of event.progression) {
            const sceneIndex = stage.sceneIndex;

            // Ensure scene breakdown exists
            if (!state.sceneBreakdowns[sceneIndex]) {
                state.sceneBreakdowns[sceneIndex] = {
                    cast: [],
                    hair: [],
                    makeup: [],
                    sfx: [],
                    health: [],
                    injuries: [],
                    stunts: [],
                    weather: [],
                    wardrobe: [],
                    extras: []
                };
            }

            // Add event reference to scene
            if (!state.sceneBreakdowns[sceneIndex].continuityEvents) {
                state.sceneBreakdowns[sceneIndex].continuityEvents = [];
            }

            state.sceneBreakdowns[sceneIndex].continuityEvents.push({
                eventId: event.id,
                character: event.character,
                type: event.type,
                stage: stage.stage,
                description: stage.description,
                makeupNotes: stage.makeupNotes,
                hairNotes: stage.hairNotes
            });
        }
    }

    /**
     * Get active events for a scene
     */
    getActiveEvents(sceneIndex) {
        const activeEvents = [];

        for (const [eventId, event] of this.events) {
            const isActive = sceneIndex >= event.startScene &&
                           (!event.endScene || sceneIndex <= event.endScene);

            if (isActive) {
                activeEvents.push(event);
            }
        }

        return activeEvents;
    }

    /**
     * Get current stage for an event at a specific scene
     */
    getCurrentStage(event, sceneIndex) {
        if (!event.progression || event.progression.length === 0) {
            return { stage: 'active', description: event.description };
        }

        const stage = event.progression.find(p => p.sceneIndex === sceneIndex);
        return stage || { stage: 'active', description: event.description };
    }

    /**
     * Get all events for a character
     */
    getCharacterEvents(character) {
        const events = [];
        for (const [eventId, event] of this.events) {
            if (event.character === character) {
                events.push(event);
            }
        }
        return events;
    }

    /**
     * Delete an event
     */
    deleteEvent(eventId) {
        const event = this.events.get(eventId);
        if (!event) return;

        // Remove from character events
        if (state.continuityEvents[event.character]) {
            state.continuityEvents[event.character] =
                state.continuityEvents[event.character].filter(e => e.id !== eventId);
        }

        // Remove from scenes
        if (event.progression) {
            for (const stage of event.progression) {
                const sceneIndex = stage.sceneIndex;
                if (state.sceneBreakdowns[sceneIndex]?.continuityEvents) {
                    state.sceneBreakdowns[sceneIndex].continuityEvents =
                        state.sceneBreakdowns[sceneIndex].continuityEvents.filter(
                            e => e.eventId !== eventId
                        );
                }
            }
        }

        this.events.delete(eventId);
    }
}

// Create global instance
window.continuityTracker = new ContinuityEventTracker();

// ============================================================================
// SCRIPT SUPERVISOR INTEGRATION
// ============================================================================

/**
 * Open supervisor breakdown upload modal
 */
export function openSupervisorUploadModal() {
    const modal = document.getElementById('supervisor-breakdown-modal');
    if (!modal) return;

    // Setup file input handlers
    const fileInput = document.getElementById('supervisor-file');
    const uploadArea = document.getElementById('supervisor-file-upload-area');
    const processBtn = document.getElementById('process-supervisor-btn');

    // Click upload area to trigger file input
    uploadArea.onclick = () => fileInput.click();

    // Handle file selection
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            displaySupervisorFile(file);
            processBtn.disabled = false;
        }
    };

    // Drag and drop handlers
    uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--accent-gold)';
        uploadArea.style.background = 'rgba(201, 169, 97, 0.05)';
    };

    uploadArea.ondragleave = () => {
        uploadArea.style.borderColor = 'var(--glass-border)';
        uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
    };

    uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--glass-border)';
        uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';

        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            displaySupervisorFile(file);
            processBtn.disabled = false;
        }
    };

    modal.style.display = 'flex';
}

/**
 * Close supervisor upload modal
 */
export function closeSupervisorUploadModal() {
    const modal = document.getElementById('supervisor-breakdown-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Display selected supervisor file info
 */
function displaySupervisorFile(file) {
    const fileInfo = document.getElementById('supervisor-file-info');
    const fileName = document.getElementById('supervisor-file-name');
    const fileSize = document.getElementById('supervisor-file-size');

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';

    // Store file for processing
    window.selectedSupervisorFile = file;
}

/**
 * Clear selected supervisor file
 */
window.clearSupervisorFile = function() {
    const fileInput = document.getElementById('supervisor-file');
    const fileInfo = document.getElementById('supervisor-file-info');
    const processBtn = document.getElementById('process-supervisor-btn');

    fileInput.value = '';
    fileInfo.style.display = 'none';
    processBtn.disabled = true;
    window.selectedSupervisorFile = null;
};

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Process supervisor breakdown file
 */
export async function processSupBreakdown() {
    const file = window.selectedSupervisorFile;
    if (!file) {
        alert('Please select a file first');
        return;
    }

    closeSupervisorUploadModal();

    // Show progress
    showProgressModal('Processing Supervisor Breakdown', 'Analyzing file...');

    try {
        // Read file
        const fileContent = await readFileContent(file);

        // Parse based on file type
        let supervisorData;
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'csv' || ext === 'txt') {
            supervisorData = parseCSVBreakdown(fileContent);
        } else {
            // For PDF and XLSX, use AI to extract structured data
            supervisorData = await parseWithAI(fileContent, file.name);
        }

        // Store supervisor data
        window.supervisorReference = {
            filename: file.name,
            uploadedAt: new Date().toISOString(),
            data: supervisorData
        };

        // Merge with our data
        mergeWithOurBreakdown(supervisorData);

        closeProgressModal();
        showToast('Supervisor breakdown processed successfully', 'success');
    } catch (error) {
        console.error('Error processing supervisor breakdown:', error);
        closeProgressModal();
        alert('Error processing file: ' + error.message);
    }
}

/**
 * Read file content
 */
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

/**
 * Parse CSV breakdown
 */
function parseCSVBreakdown(content) {
    const lines = content.split('\n');
    const data = {
        scenes: {},
        timeline: {},
        continuityNotes: {}
    };

    // Simple CSV parsing - can be enhanced
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(col => col.trim());
        if (cols.length < 2) continue;

        const sceneNum = cols[0];
        const storyDay = cols[1];
        const timeOfDay = cols[2] || '';
        const notes = cols[3] || '';

        data.scenes[sceneNum] = {
            sceneNumber: sceneNum,
            storyDay: storyDay,
            timeOfDay: timeOfDay,
            notes: notes
        };

        data.timeline[sceneNum] = {
            day: storyDay,
            time: timeOfDay
        };

        if (notes) {
            data.continuityNotes[sceneNum] = notes;
        }
    }

    return data;
}

/**
 * Parse file with AI
 */
async function parseWithAI(content, filename) {
    const prompt = `Parse this script supervisor's breakdown file and extract structured data.

Filename: ${filename}
Content: ${content.substring(0, 5000)}

Extract and return as JSON:
{
  "scenes": {
    "1": {
      "sceneNumber": "1",
      "storyDay": "Day 1",
      "timeOfDay": "Morning",
      "notes": "Any continuity notes"
    }
  },
  "timeline": {
    "1": { "day": "Day 1", "time": "Morning" }
  },
  "continuityNotes": {
    "1": "Any specific continuity notes"
  }
}

Focus on:
- Scene numbers
- Story days
- Time of day
- Continuity notes
- Character-specific notes`;

    try {
        const response = await callAI(prompt, 3000);
        return JSON.parse(response);
    } catch (error) {
        console.error('AI parsing error:', error);
        throw new Error('Could not parse file with AI');
    }
}

/**
 * Merge supervisor data with our breakdown
 */
function mergeWithOurBreakdown(supervisorData) {
    // Compare and merge timeline data
    for (const [sceneNum, supData] of Object.entries(supervisorData.scenes)) {
        const sceneIndex = parseInt(sceneNum) - 1;

        if (sceneIndex >= 0 && sceneIndex < state.scenes.length) {
            // Store supervisor reference for cross-checking
            if (!state.sceneTimeline[sceneIndex]) {
                state.sceneTimeline[sceneIndex] = {};
            }

            state.sceneTimeline[sceneIndex].supervisorData = {
                day: supData.storyDay,
                time: supData.timeOfDay,
                notes: supData.notes
            };
        }
    }

    console.log('Supervisor data merged:', supervisorData);
}

/**
 * Check if supervisor data differs from ours
 */
export function checkSupervisorDiscrepancy(sceneIndex, field) {
    const supData = state.sceneTimeline[sceneIndex]?.supervisorData;
    if (!supData) return null;

    const ourData = state.sceneTimeline[sceneIndex];
    if (!ourData) return null;

    if (field === 'day') {
        return supData.day !== ourData.day ? supData.day : null;
    } else if (field === 'time') {
        return supData.time !== ourData.time ? supData.time : null;
    }

    return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Show progress modal
 */
function showProgressModal(title, message) {
    const modal = document.getElementById('progress-modal');
    if (!modal) return;

    const titleEl = document.getElementById('progress-title');
    const messageEl = document.getElementById('progress-message');
    const progressFill = document.getElementById('progress-fill');
    const progressLabel = document.getElementById('progress-label');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (progressFill) progressFill.style.width = '0%';
    if (progressLabel) progressLabel.textContent = '';

    modal.style.display = 'flex';
}

/**
 * Close progress modal
 */
function closeProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) {
        setTimeout(() => {
            modal.style.display = 'none';
        }, 1000);
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.openSupervisorUploadModal = openSupervisorUploadModal;
window.closeSupervisorUploadModal = closeSupervisorUploadModal;
window.processSupBreakdown = processSupBreakdown;

/**
 * hybrid-breakdown-manager.js
 * Hybrid AI-Assisted + Manual Scene Breakdown System
 *
 * Responsibilities:
 * - Manage AI-generated suggestions vs confirmed continuity items
 * - Scene-by-scene review workflow with accept/reject/edit functionality
 * - Progress tracking through script review
 * - Manual override and custom additions
 * - Export with full audit trail
 */

import { state } from './main.js';
import { callAI } from './ai-integration.js';

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/**
 * Suggestion states
 */
export const SuggestionStatus = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EDITED: 'edited'
};

/**
 * Review status for scenes
 */
export const ReviewStatus = {
    NOT_STARTED: 'not-started',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed'
};

// ============================================================================
// HYBRID BREAKDOWN MANAGER CLASS
// ============================================================================

/**
 * HybridBreakdownManager class
 * Manages AI suggestions, manual additions, and scene review workflow
 */
export class HybridBreakdownManager {
    constructor() {
        // AI-generated suggestions (pending review)
        this.suggestedContinuity = new Map(); // sceneId -> suggestions[]

        // User-confirmed items (accepted AI suggestions)
        this.confirmedContinuity = new Map(); // sceneId -> items[]

        // User-added items (manual additions)
        this.manualAdditions = new Map(); // sceneId -> items[]

        // Scene review tracking
        this.sceneReviewStatus = new Map(); // sceneId -> ReviewStatus

        // Current scene being reviewed
        this.currentReviewScene = null;

        // Load saved data from localStorage
        this.loadFromStorage();

        // Initialize suggestion ID counter
        this.nextSuggestionId = this.loadSuggestionIdCounter();
    }

    /**
     * Generate unique suggestion ID
     */
    generateSuggestionId() {
        return `suggestion_${Date.now()}_${this.nextSuggestionId++}`;
    }

    /**
     * Load suggestion ID counter from storage
     */
    loadSuggestionIdCounter() {
        const saved = localStorage.getItem('hybridBreakdown_suggestionIdCounter');
        return saved ? parseInt(saved) : 0;
    }

    /**
     * Save suggestion ID counter to storage
     */
    saveSuggestionIdCounter() {
        localStorage.setItem('hybridBreakdown_suggestionIdCounter', this.nextSuggestionId.toString());
    }

    /**
     * Load data from localStorage
     */
    loadFromStorage() {
        try {
            const suggested = localStorage.getItem('hybridBreakdown_suggested');
            const confirmed = localStorage.getItem('hybridBreakdown_confirmed');
            const manual = localStorage.getItem('hybridBreakdown_manual');
            const reviewStatus = localStorage.getItem('hybridBreakdown_reviewStatus');

            if (suggested) {
                const data = JSON.parse(suggested);
                this.suggestedContinuity = new Map(Object.entries(data));
            }

            if (confirmed) {
                const data = JSON.parse(confirmed);
                this.confirmedContinuity = new Map(Object.entries(data));
            }

            if (manual) {
                const data = JSON.parse(manual);
                this.manualAdditions = new Map(Object.entries(data));
            }

            if (reviewStatus) {
                const data = JSON.parse(reviewStatus);
                this.sceneReviewStatus = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Error loading hybrid breakdown data:', error);
        }
    }

    /**
     * Save data to localStorage
     */
    saveToStorage() {
        try {
            // Convert Maps to objects for JSON serialization
            localStorage.setItem('hybridBreakdown_suggested',
                JSON.stringify(Object.fromEntries(this.suggestedContinuity)));

            localStorage.setItem('hybridBreakdown_confirmed',
                JSON.stringify(Object.fromEntries(this.confirmedContinuity)));

            localStorage.setItem('hybridBreakdown_manual',
                JSON.stringify(Object.fromEntries(this.manualAdditions)));

            localStorage.setItem('hybridBreakdown_reviewStatus',
                JSON.stringify(Object.fromEntries(this.sceneReviewStatus)));

            this.saveSuggestionIdCounter();
        } catch (error) {
            console.error('Error saving hybrid breakdown data:', error);
        }
    }

    /**
     * Clear all hybrid breakdown data
     */
    clearAllData() {
        this.suggestedContinuity.clear();
        this.confirmedContinuity.clear();
        this.manualAdditions.clear();
        this.sceneReviewStatus.clear();
        this.currentReviewScene = null;
        this.nextSuggestionId = 0;

        localStorage.removeItem('hybridBreakdown_suggested');
        localStorage.removeItem('hybridBreakdown_confirmed');
        localStorage.removeItem('hybridBreakdown_manual');
        localStorage.removeItem('hybridBreakdown_reviewStatus');
        localStorage.removeItem('hybridBreakdown_suggestionIdCounter');
    }

    /**
     * Generate AI suggestions for all scenes
     */
    async generateAllSuggestions() {
        if (!state.scenes || state.scenes.length === 0) {
            throw new Error('No scenes available to analyze');
        }

        const narrativeContext = window.scriptNarrativeContext;
        if (!narrativeContext) {
            throw new Error('Narrative context not available. Please run narrative analysis first.');
        }

        // Clear existing suggestions
        this.suggestedContinuity.clear();

        // Generate suggestions for each scene
        for (let i = 0; i < state.scenes.length; i++) {
            const suggestions = await this.generateSceneSuggestions(i, narrativeContext);
            if (suggestions && suggestions.length > 0) {
                this.suggestedContinuity.set(i.toString(), suggestions);
            }
        }

        this.saveToStorage();
    }

    /**
     * Generate suggestions for a specific scene
     */
    async generateSceneSuggestions(sceneIndex, narrativeContext) {
        const scene = state.scenes[sceneIndex];
        if (!scene) return [];

        const suggestions = [];

        // Get characters in this scene
        const sceneCharacters = this.getSceneCharacters(sceneIndex, narrativeContext);

        // Generate suggestions for each character
        for (const character of sceneCharacters) {
            const charSuggestions = await this.generateCharacterSuggestions(
                character,
                sceneIndex,
                narrativeContext
            );
            suggestions.push(...charSuggestions);
        }

        return suggestions;
    }

    /**
     * Get characters appearing in a scene
     */
    getSceneCharacters(sceneIndex, narrativeContext) {
        const scene = state.scenes[sceneIndex];
        const characters = [];

        // Get from existing breakdown if available
        const breakdown = state.sceneBreakdowns[sceneIndex];
        if (breakdown && breakdown.cast) {
            characters.push(...breakdown.cast);
        }

        // Get from narrative context
        if (narrativeContext && narrativeContext.characters) {
            for (const char of narrativeContext.characters) {
                if (char.scenes && char.scenes.includes(sceneIndex)) {
                    if (!characters.includes(char.name)) {
                        characters.push(char.name);
                    }
                }
            }
        }

        return characters;
    }

    /**
     * Generate continuity suggestions for a character in a scene
     */
    async generateCharacterSuggestions(character, sceneIndex, narrativeContext) {
        const scene = state.scenes[sceneIndex];
        const suggestions = [];

        // Find character data in narrative context
        const charData = narrativeContext.characters?.find(c => c.name === character);
        if (!charData) return suggestions;

        // Check for injuries
        if (charData.continuityElements?.injuries) {
            for (const injury of charData.continuityElements.injuries) {
                if (this.injuryAppliesInScene(injury, sceneIndex)) {
                    suggestions.push({
                        id: this.generateSuggestionId(),
                        character: character,
                        category: 'injuries',
                        description: injury.description,
                        confidence: injury.importance * 10, // Convert to percentage
                        status: SuggestionStatus.PENDING,
                        sourceScene: injury.startScene,
                        metadata: {
                            severity: injury.severity,
                            duration: injury.duration
                        }
                    });
                }
            }
        }

        // Check for hair/makeup changes
        if (charData.continuityElements?.hairMakeup) {
            for (const look of charData.continuityElements.hairMakeup) {
                if (this.lookAppliesInScene(look, sceneIndex)) {
                    suggestions.push({
                        id: this.generateSuggestionId(),
                        character: character,
                        category: look.type || 'makeup',
                        description: look.description,
                        confidence: 75,
                        status: SuggestionStatus.PENDING,
                        sourceScene: look.startScene
                    });
                }
            }
        }

        // Check for wardrobe
        if (charData.continuityElements?.wardrobe) {
            for (const outfit of charData.continuityElements.wardrobe) {
                if (this.wardrobeAppliesInScene(outfit, sceneIndex)) {
                    suggestions.push({
                        id: this.generateSuggestionId(),
                        character: character,
                        category: 'wardrobe',
                        description: outfit.description,
                        confidence: 80,
                        status: SuggestionStatus.PENDING,
                        sourceScene: outfit.startScene
                    });
                }
            }
        }

        // Check for emotional state
        if (charData.emotionalState) {
            const emotion = this.getEmotionalStateForScene(charData.emotionalState, sceneIndex);
            if (emotion) {
                suggestions.push({
                    id: this.generateSuggestionId(),
                    character: character,
                    category: 'condition',
                    description: `Emotional state: ${emotion}`,
                    confidence: 60,
                    status: SuggestionStatus.PENDING
                });
            }
        }

        return suggestions;
    }

    /**
     * Check if injury applies in this scene
     */
    injuryAppliesInScene(injury, sceneIndex) {
        if (!injury.startScene) return false;
        if (sceneIndex < injury.startScene) return false;
        if (injury.endScene && sceneIndex > injury.endScene) return false;
        return true;
    }

    /**
     * Check if look applies in this scene
     */
    lookAppliesInScene(look, sceneIndex) {
        if (!look.startScene) return false;
        if (sceneIndex < look.startScene) return false;
        if (look.endScene && sceneIndex > look.endScene) return false;
        return true;
    }

    /**
     * Check if wardrobe applies in this scene
     */
    wardrobeAppliesInScene(outfit, sceneIndex) {
        if (!outfit.startScene) return false;
        if (sceneIndex < outfit.startScene) return false;
        if (outfit.endScene && sceneIndex > outfit.endScene) return false;
        return true;
    }

    /**
     * Get emotional state for a specific scene
     */
    getEmotionalStateForScene(emotionalState, sceneIndex) {
        if (!emotionalState || !Array.isArray(emotionalState)) return null;

        // Find the most recent emotional state before or at this scene
        let currentEmotion = null;
        for (const state of emotionalState) {
            if (state.scene <= sceneIndex) {
                currentEmotion = state.state;
            } else {
                break;
            }
        }

        return currentEmotion;
    }

    /**
     * Get suggestions for a scene
     */
    getSuggestionsForScene(sceneIndex) {
        const key = sceneIndex.toString();
        return this.suggestedContinuity.get(key) || [];
    }

    /**
     * Get confirmed items for a scene
     */
    getConfirmedForScene(sceneIndex) {
        const key = sceneIndex.toString();
        return this.confirmedContinuity.get(key) || [];
    }

    /**
     * Get manual additions for a scene
     */
    getManualForScene(sceneIndex) {
        const key = sceneIndex.toString();
        return this.manualAdditions.get(key) || [];
    }

    /**
     * Get all items for a scene (confirmed + manual)
     */
    getAllItemsForScene(sceneIndex) {
        return [
            ...this.getConfirmedForScene(sceneIndex),
            ...this.getManualForScene(sceneIndex)
        ];
    }

    /**
     * Get a specific suggestion by ID
     */
    getSuggestion(suggestionId) {
        for (const [sceneKey, suggestions] of this.suggestedContinuity.entries()) {
            const suggestion = suggestions.find(s => s.id === suggestionId);
            if (suggestion) {
                return { suggestion, sceneIndex: parseInt(sceneKey) };
            }
        }
        return null;
    }

    /**
     * Accept a suggestion
     */
    acceptSuggestion(suggestionId) {
        const result = this.getSuggestion(suggestionId);
        if (!result) return false;

        const { suggestion, sceneIndex } = result;
        const key = sceneIndex.toString();

        // Update suggestion status
        suggestion.status = SuggestionStatus.ACCEPTED;
        suggestion.acceptedAt = Date.now();

        // Move to confirmed
        const confirmed = this.confirmedContinuity.get(key) || [];
        confirmed.push({
            ...suggestion,
            source: 'ai-suggestion'
        });
        this.confirmedContinuity.set(key, confirmed);

        this.saveToStorage();
        return true;
    }

    /**
     * Reject a suggestion
     */
    rejectSuggestion(suggestionId) {
        const result = this.getSuggestion(suggestionId);
        if (!result) return false;

        const { suggestion } = result;
        suggestion.status = SuggestionStatus.REJECTED;
        suggestion.rejectedAt = Date.now();

        this.saveToStorage();
        return true;
    }

    /**
     * Edit and accept a suggestion
     */
    editSuggestion(suggestionId, newData) {
        const result = this.getSuggestion(suggestionId);
        if (!result) return false;

        const { suggestion, sceneIndex } = result;
        const key = sceneIndex.toString();

        // Update suggestion with new data
        Object.assign(suggestion, newData);
        suggestion.status = SuggestionStatus.EDITED;
        suggestion.editedAt = Date.now();

        // Move to confirmed
        const confirmed = this.confirmedContinuity.get(key) || [];
        confirmed.push({
            ...suggestion,
            source: 'ai-suggestion-edited'
        });
        this.confirmedContinuity.set(key, confirmed);

        this.saveToStorage();
        return true;
    }

    /**
     * Accept all pending suggestions for a scene
     */
    acceptAllSuggestionsForScene(sceneIndex) {
        const suggestions = this.getSuggestionsForScene(sceneIndex);
        const pending = suggestions.filter(s => s.status === SuggestionStatus.PENDING);

        pending.forEach(suggestion => {
            this.acceptSuggestion(suggestion.id);
        });

        return pending.length;
    }

    /**
     * Add a manual continuity item
     */
    addManualItem(sceneIndex, itemData) {
        const key = sceneIndex.toString();
        const manual = this.manualAdditions.get(key) || [];

        const item = {
            id: this.generateSuggestionId(),
            ...itemData,
            source: 'manual',
            addedAt: Date.now()
        };

        manual.push(item);
        this.manualAdditions.set(key, manual);

        this.saveToStorage();
        return item;
    }

    /**
     * Delete a confirmed or manual item
     */
    deleteItem(sceneIndex, itemId, isManual = false) {
        const key = sceneIndex.toString();
        const map = isManual ? this.manualAdditions : this.confirmedContinuity;
        const items = map.get(key) || [];

        const filtered = items.filter(item => item.id !== itemId);
        map.set(key, filtered);

        this.saveToStorage();
        return true;
    }

    /**
     * Get scene review status
     */
    getSceneReviewStatus(sceneIndex) {
        const key = sceneIndex.toString();
        return this.sceneReviewStatus.get(key) || ReviewStatus.NOT_STARTED;
    }

    /**
     * Set scene review status
     */
    setSceneReviewStatus(sceneIndex, status) {
        const key = sceneIndex.toString();
        this.sceneReviewStatus.set(key, status);
        this.saveToStorage();
    }

    /**
     * Mark scene as complete
     */
    markSceneComplete(sceneIndex) {
        this.setSceneReviewStatus(sceneIndex, ReviewStatus.COMPLETED);
    }

    /**
     * Get review progress statistics
     */
    getReviewProgress() {
        const total = state.scenes ? state.scenes.length : 0;
        let completed = 0;
        let inProgress = 0;

        for (let i = 0; i < total; i++) {
            const status = this.getSceneReviewStatus(i);
            if (status === ReviewStatus.COMPLETED) completed++;
            else if (status === ReviewStatus.IN_PROGRESS) inProgress++;
        }

        return {
            total,
            completed,
            inProgress,
            notStarted: total - completed - inProgress,
            percentage: total > 0 ? (completed / total) * 100 : 0
        };
    }

    /**
     * Get statistics for a scene
     */
    getSceneStatistics(sceneIndex) {
        const suggestions = this.getSuggestionsForScene(sceneIndex);
        const confirmed = this.getConfirmedForScene(sceneIndex);
        const manual = this.getManualForScene(sceneIndex);

        return {
            totalSuggestions: suggestions.length,
            pendingSuggestions: suggestions.filter(s => s.status === SuggestionStatus.PENDING).length,
            acceptedSuggestions: suggestions.filter(s => s.status === SuggestionStatus.ACCEPTED).length,
            rejectedSuggestions: suggestions.filter(s => s.status === SuggestionStatus.REJECTED).length,
            confirmedItems: confirmed.length,
            manualItems: manual.length
        };
    }

    /**
     * Export breakdown with audit trail
     */
    exportBreakdown() {
        const breakdown = {
            exportedAt: new Date().toISOString(),
            script: state.scriptTitle || 'Untitled Script',
            reviewProgress: this.getReviewProgress(),
            scenes: []
        };

        for (let i = 0; i < state.scenes.length; i++) {
            const scene = state.scenes[i];
            const suggestions = this.getSuggestionsForScene(i);
            const confirmed = this.getConfirmedForScene(i);
            const manual = this.getManualForScene(i);
            const status = this.getSceneReviewStatus(i);

            breakdown.scenes.push({
                sceneNumber: scene.number,
                heading: scene.heading,
                reviewStatus: status,
                statistics: this.getSceneStatistics(i),
                suggestions: suggestions.map(s => ({
                    ...s,
                    statusLabel: this.getStatusLabel(s.status)
                })),
                confirmedItems: confirmed,
                manualAdditions: manual
            });
        }

        return breakdown;
    }

    /**
     * Get human-readable status label
     */
    getStatusLabel(status) {
        switch (status) {
            case SuggestionStatus.PENDING: return 'Pending Review';
            case SuggestionStatus.ACCEPTED: return 'Accepted';
            case SuggestionStatus.REJECTED: return 'Rejected';
            case SuggestionStatus.EDITED: return 'Edited & Accepted';
            default: return 'Unknown';
        }
    }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

// Create global instance
window.hybridBreakdownManager = new HybridBreakdownManager();

// ============================================================================
// EXPORTS
// ============================================================================

export default HybridBreakdownManager;

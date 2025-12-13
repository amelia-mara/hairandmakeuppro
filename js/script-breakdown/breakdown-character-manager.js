/**
 * breakdown-character-manager.js
 * Character name normalization and deduplication
 *
 * Responsibilities:
 * - CharacterManager class for handling character name variations
 * - Normalize character names to canonical form
 * - Handle aliases and variations (full name vs first name)
 * - Build character reference for AI prompts
 */

import { state as importedState } from './main.js';

/**
 * Get the current state - handles circular dependency issues
 * @returns {Object} Application state
 */
function getState() {
    if (typeof window !== 'undefined' && window.state) {
        return window.state;
    }
    return importedState;
}

/**
 * CharacterManager class
 * Handles character name normalization and deduplication
 *
 * Resolves:
 * - Case variations: "GWEN LAWSON" vs "Gwen Lawson" vs "gwen lawson"
 * - Full name vs first name: "Gwen Lawson" vs "Gwen"
 * - Different extraction methods creating separate entries
 */
export class CharacterManager {
    constructor() {
        this.characters = new Map(); // Canonical name -> character data
        this.aliases = new Map();     // All variations -> canonical name
    }

    /**
     * Add a character name, handling all variations and deduplication
     * @param {string} rawName - The character name to add
     * @returns {string|null} - The canonical name, or null if invalid
     */
    addCharacter(rawName) {
        if (!rawName || typeof rawName !== 'string') return null;

        const cleaned = rawName.trim();
        if (!cleaned) return null;

        // Check if we already know this name (any variation)
        const canonical = this.aliases.get(cleaned.toLowerCase());
        if (canonical) {
            // Already exists, return canonical name
            this.characters.get(canonical).count++;
            return canonical;
        }

        // Check if this matches an existing character's first name
        const firstName = cleaned.split(' ')[0];
        const matchingFull = this.findFullNameMatch(firstName);

        if (matchingFull) {
            // This is a short version of an existing full name
            this.addAlias(cleaned, matchingFull);
            this.characters.get(matchingFull).count++;
            return matchingFull;
        }

        // Check if any existing character is the short version of this name
        if (cleaned.split(' ').length > 1) {
            const existingShort = this.findByFirstName(firstName);
            if (existingShort) {
                // Upgrade the short name to the full name
                this.upgradeToFullName(existingShort, cleaned);
                return cleaned;
            }
        }

        // New character - normalize to title case
        const normalized = this.normalizeCase(cleaned);

        // Add to registry
        this.characters.set(normalized, {
            name: normalized,
            count: 1,
            appearances: []
        });

        // Add all case variations as aliases
        this.addAlias(cleaned, normalized);
        this.addAlias(cleaned.toUpperCase(), normalized);
        this.addAlias(cleaned.toLowerCase(), normalized);
        this.addAlias(normalized, normalized);

        return normalized;
    }

    /**
     * Convert to title case: "GWEN LAWSON" -> "Gwen Lawson"
     * @param {string} name - The name to normalize
     * @returns {string} - The normalized name
     */
    normalizeCase(name) {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Add an alias mapping
     * @param {string} variation - The variation to map
     * @param {string} canonicalName - The canonical name to map to
     */
    addAlias(variation, canonicalName) {
        this.aliases.set(variation.toLowerCase(), canonicalName);
    }

    /**
     * Find if a first name matches any existing full name
     * @param {string} firstName - The first name to check
     * @returns {string|null} - The matching full name, or null
     */
    findFullNameMatch(firstName) {
        const lowerFirst = firstName.toLowerCase();

        for (const [canonical] of this.characters.entries()) {
            const parts = canonical.split(' ');
            if (parts.length > 1 && parts[0].toLowerCase() === lowerFirst) {
                return canonical;
            }
        }
        return null;
    }

    /**
     * Find character by first name only
     * @param {string} firstName - The first name to find
     * @returns {string|null} - The character name, or null
     */
    findByFirstName(firstName) {
        const lowerFirst = firstName.toLowerCase();

        for (const [canonical] of this.characters.entries()) {
            const parts = canonical.split(' ');
            if (parts[0].toLowerCase() === lowerFirst) {
                return canonical;
            }
        }
        return null;
    }

    /**
     * Upgrade a short name to full name
     * @param {string} oldName - The short name
     * @param {string} newName - The full name
     */
    upgradeToFullName(oldName, newName) {
        const data = this.characters.get(oldName);
        this.characters.delete(oldName);

        const normalized = this.normalizeCase(newName);
        this.characters.set(normalized, data);
        data.name = normalized;

        // Update all aliases pointing to old name
        for (const [alias, canonical] of this.aliases.entries()) {
            if (canonical === oldName) {
                this.aliases.set(alias, normalized);
            }
        }

        // Add new aliases for full name
        this.addAlias(newName, normalized);
        this.addAlias(newName.toUpperCase(), normalized);
        this.addAlias(newName.toLowerCase(), normalized);
    }

    /**
     * Get canonical name for any variation
     * @param {string} rawName - The name to look up
     * @returns {string|null} - The canonical name, or null
     */
    getCanonicalName(rawName) {
        if (!rawName) return null;

        const lower = rawName.trim().toLowerCase();
        return this.aliases.get(lower) || null;
    }

    /**
     * Get all characters as sorted array
     * @returns {string[]} - Array of canonical character names
     */
    getAllCharacters() {
        return Array.from(this.characters.values())
            .sort((a, b) => b.count - a.count)
            .map(data => data.name);
    }

    /**
     * Get all variations/aliases for a canonical character name
     * @param {string} canonicalName - The canonical character name
     * @returns {string[]} - Array of all known variations for this character
     */
    getVariations(canonicalName) {
        const variations = new Set();

        // Add the canonical name itself
        variations.add(canonicalName);

        // Find all aliases that map to this canonical name
        for (const [variation, canonical] of this.aliases.entries()) {
            if (canonical === canonicalName) {
                variations.add(variation);
            }
        }

        // Add common variations
        const parts = canonicalName.split(' ');
        if (parts.length > 1) {
            // Add first name only
            variations.add(parts[0]);
            // Add last name only
            variations.add(parts[parts.length - 1]);
            // Add first name with common prefixes
            variations.add(`Mr. ${parts[parts.length - 1]}`);
            variations.add(`Ms. ${parts[parts.length - 1]}`);
            variations.add(`Mrs. ${parts[parts.length - 1]}`);
            variations.add(`Dr. ${parts[parts.length - 1]}`);
        }

        // Remove duplicates and return sorted
        return Array.from(variations).sort();
    }

    /**
     * Build character reference for AI prompts
     * Returns formatted string with all characters and their variations
     * @returns {string} - Formatted character reference
     */
    buildCharacterReferenceForAI() {
        const state = getState();
        const confirmedChars = window.scriptBreakdownState?.confirmedCharacters || state.confirmedCharacters;
        if (!confirmedChars || confirmedChars.size === 0) {
            return 'Characters will be detected automatically from the scene text.';
        }

        const lines = ['**CHARACTER REFERENCE** (use these names when tagging):'];

        for (const canonicalName of confirmedChars) {
            const variations = this.getVariations(canonicalName);
            // Filter to show most useful variations (remove case duplicates)
            const uniqueVariations = new Set(variations.map(v => v.toLowerCase()));
            const displayVariations = Array.from(uniqueVariations)
                .filter(v => v !== canonicalName.toLowerCase())
                .slice(0, 5); // Limit to 5 most common

            if (displayVariations.length > 0) {
                lines.push(`- ${canonicalName.toUpperCase()} (also matches: ${displayVariations.join(', ')})`);
            } else {
                lines.push(`- ${canonicalName.toUpperCase()}`);
            }
        }

        lines.push('');
        lines.push('**IMPORTANT**: When you find "Gwen" or "Peter" in action lines, match them to the full character names above. Use the UPPERCASE canonical name (e.g., "GWEN LAWSON") in your character field.');

        return lines.join('\n');
    }

    /**
     * Clear all data
     */
    clear() {
        this.characters.clear();
        this.aliases.clear();
    }
}

// Create and expose global instance
const characterManager = new CharacterManager();
window.characterManager = characterManager;

export { characterManager };
export default CharacterManager;

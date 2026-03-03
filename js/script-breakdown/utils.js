/**
 * utils.js
 * Utility functions and helper methods used throughout the script breakdown application
 *
 * Provides:
 * - String manipulation and normalization
 * - Scene type detection and classification
 * - Date/time formatting
 * - Data transformation helpers
 * - Common validation functions
 */

/**
 * Normalize character names for consistent matching
 * Removes extra whitespace, converts to title case
 */
export function normalizeCastName(name) {
    if (!name) return '';
    return name.trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Find matching cast member from existing list using fuzzy matching
 * Returns the matching name or null
 */
export function findMatchingCastMember(name, existingCast) {
    const normalized = normalizeCastName(name);
    const lowerName = normalized.toLowerCase();

    // Exact match
    for (const cast of existingCast) {
        if (normalizeCastName(cast).toLowerCase() === lowerName) {
            return cast;
        }
    }

    // Partial match (last name or first name)
    const nameParts = normalized.split(' ');
    for (const cast of existingCast) {
        const castParts = normalizeCastName(cast).split(' ');
        for (const part of nameParts) {
            if (part.length > 2 && castParts.some(cp => cp.toLowerCase() === part.toLowerCase())) {
                return cast;
            }
        }
    }

    return null;
}

/**
 * Detect scene type from scene heading (INT/EXT and DAY/NIGHT)
 * Returns object with intExt and timeOfDay
 */
export function getSceneType(heading) {
    const upper = heading.toUpperCase();

    // Detect INT/EXT
    let intExt = '';
    if (upper.includes('INT.') || upper.includes('INTERIOR')) intExt = 'INT';
    else if (upper.includes('EXT.') || upper.includes('EXTERIOR')) intExt = 'EXT';
    else if (upper.includes('INT/EXT') || upper.includes('INT./EXT.')) intExt = 'INT/EXT';

    // Detect time of day
    let timeOfDay = '';
    if (upper.includes('DAY') || upper.includes('MORNING') || upper.includes('AFTERNOON')) {
        timeOfDay = 'DAY';
    } else if (upper.includes('NIGHT') || upper.includes('EVENING') || upper.includes('DUSK') || upper.includes('DAWN')) {
        timeOfDay = 'NIGHT';
    }

    return { intExt, timeOfDay };
}

/**
 * Get readable label for scene type (for badges/indicators)
 */
export function getSceneTypeLabel(sceneType) {
    if (!sceneType || (!sceneType.intExt && !sceneType.timeOfDay)) return '';
    const intExt = sceneType.intExt || '';
    const time = sceneType.timeOfDay || '';
    return `${intExt}${intExt && time ? ' - ' : ''}${time}`;
}

/**
 * Get CSS class for scene type styling
 */
export function getSceneTypeClass(sceneType) {
    if (!sceneType || !sceneType.intExt || !sceneType.timeOfDay) return '';
    return `${sceneType.intExt.toLowerCase()}-${sceneType.timeOfDay.toLowerCase()}`;
}

/**
 * Extract location from scene heading
 */
export function extractLocation(heading) {
    // Remove INT./EXT. prefix and time of day suffix
    let location = heading
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|INTERIOR|EXTERIOR)\s*/i, '')
        .replace(/\s*-\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN).*$/i, '')
        .trim();

    return location || heading;
}

/**
 * Detect time of day from scene heading (more detailed than getSceneType)
 */
export function detectTimeOfDay(heading) {
    const upper = heading.toUpperCase();

    if (upper.includes('MORNING')) return 'Morning';
    if (upper.includes('AFTERNOON')) return 'Afternoon';
    if (upper.includes('EVENING')) return 'Evening';
    if (upper.includes('NIGHT')) return 'Night';
    if (upper.includes('DUSK')) return 'Dusk';
    if (upper.includes('DAWN')) return 'Dawn';
    if (upper.includes('DAY')) return 'Day';

    return '';
}

/**
 * Detect INT/EXT from scene heading
 */
export function detectIntExt(heading) {
    const upper = heading.toUpperCase();

    if (upper.includes('INT.') || upper.includes('INTERIOR')) return 'INT';
    if (upper.includes('EXT.') || upper.includes('EXTERIOR')) return 'EXT';
    if (upper.includes('INT/EXT') || upper.includes('INT./EXT.')) return 'INT/EXT';

    return '';
}

/**
 * Format scene list as ranges (e.g., [1,2,3,5,6,7] => "1-3, 5-7")
 */
export function formatSceneRange(scenes) {
    if (!scenes || scenes.length === 0) return '';

    const sorted = [...scenes].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            start = sorted[i];
            end = sorted[i];
        }
    }

    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
}

/**
 * Calculate string similarity (0-1) using Levenshtein distance
 */
export function calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Calculate appearance similarity between two appearance objects
 */
export function calculateAppearanceSimilarity(app1, app2) {
    if (!app1 || !app2) return 0;

    const fields = ['hair', 'makeup', 'sfx', 'wardrobe'];
    let matches = 0;
    let total = 0;

    for (const field of fields) {
        const val1 = (app1[field] || '').toLowerCase().trim();
        const val2 = (app2[field] || '').toLowerCase().trim();

        if (val1 && val2) {
            total++;
            if (calculateStringSimilarity(val1, val2) > 0.7) {
                matches++;
            }
        }
    }

    return total > 0 ? matches / total : 0;
}

/**
 * Get complexity indicator for look complexity level (text-based)
 */
export function getComplexityIcon(complexity) {
    switch (complexity) {
        case 'low': return '○';
        case 'medium': return '●';
        case 'high': return '◉';
        default: return '○';
    }
}

/**
 * Get defined fields from appearance object (non-empty values)
 */
export function getDefinedFields(appearance) {
    if (!appearance) return [];

    const fields = [];
    if (appearance.hair && appearance.hair.trim()) fields.push('hair');
    if (appearance.makeup && appearance.makeup.trim()) fields.push('makeup');
    if (appearance.sfx && appearance.sfx.trim()) fields.push('sfx');
    if (appearance.wardrobe && appearance.wardrobe.trim()) fields.push('wardrobe');

    return fields;
}

/**
 * Generate unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function for performance optimization
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Check if character appears in scene
 */
export function sceneHasCharacter(sceneIndex, character, sceneBreakdowns) {
    const breakdown = sceneBreakdowns[sceneIndex];
    if (!breakdown || !breakdown.cast) return false;

    return breakdown.cast.some(c =>
        normalizeCastName(c) === normalizeCastName(character)
    );
}

/**
 * export-master-context.js
 * Master context population and tag creation
 *
 * Responsibilities:
 * - Populate initial data from master context
 * - Create tags from master context data
 * - Setup character profiles and story structure
 */

import { state } from '../main.js';
import { renderSceneList } from '../scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { renderAllHighlights } from '../tag-system.js';

/**
 * Generate unique tag ID
 * @returns {string} Tag ID
 */
function generateTagId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Create tags from master context data
 * Automatically tags character names, descriptions, and key events
 * @param {Object} masterContext - Master context object
 */
export function createTagsFromMasterContext(masterContext) {
    if (!state.scriptTags) {
        state.scriptTags = {};
    }

    let totalTagsCreated = 0;

    // Tag character descriptions in each scene
    Object.entries(masterContext.characters || {}).forEach(([charName, charData]) => {
        // Tag script descriptions (character introductions/mentions)
        if (charData.scriptDescriptions && charData.scriptDescriptions.length > 0) {
            charData.scriptDescriptions.forEach(desc => {
                const sceneIndex = (desc.sceneNumber || 1) - 1;

                if (!state.scenes[sceneIndex]) return;

                const tag = {
                    id: generateTagId(),
                    category: 'cast',
                    character: charName,
                    selectedText: desc.text,
                    fullContext: `${charName} - ${desc.type || 'description'}`,
                    sceneIndex: sceneIndex,
                    position: { start: 0, end: desc.text.length },
                    importance: 8
                };

                if (!state.scriptTags[sceneIndex]) {
                    state.scriptTags[sceneIndex] = [];
                }

                state.scriptTags[sceneIndex].push(tag);
                totalTagsCreated++;
            });
        }

        // Tag extracted wardrobe mentions
        if (charData.extractedElements?.mentionedWardrobe) {
            charData.extractedElements.mentionedWardrobe.forEach((item, idx) => {
                const sceneIndex = charData.scenesPresent?.[idx] ?
                    charData.scenesPresent[idx] - 1 : charData.firstAppearance - 1;

                if (!state.scenes[sceneIndex]) return;

                const tag = {
                    id: generateTagId(),
                    category: 'wardrobe',
                    character: charName,
                    selectedText: item,
                    fullContext: `${charName} wardrobe: ${item}`,
                    sceneIndex: sceneIndex,
                    position: { start: 0, end: item.length },
                    importance: 6
                };

                if (!state.scriptTags[sceneIndex]) {
                    state.scriptTags[sceneIndex] = [];
                }

                state.scriptTags[sceneIndex].push(tag);
                totalTagsCreated++;
            });
        }
    });

    // Tag physical interactions
    Object.entries(masterContext.interactions || {}).forEach(([sceneKey, interaction]) => {
        const sceneMatch = sceneKey.match(/scene_(\d+)/);
        if (!sceneMatch) return;

        const sceneIndex = parseInt(sceneMatch[1]) - 1;
        if (!state.scenes[sceneIndex]) return;

        const tag = {
            id: generateTagId(),
            category: interaction.type === 'fight' ? 'stunts' : 'sfx',
            character: interaction.characters?.[0] || null,
            selectedText: interaction.impact || interaction.type,
            fullContext: `Physical interaction: ${interaction.type} - ${interaction.impact}`,
            sceneIndex: sceneIndex,
            position: { start: 0, end: 50 },
            importance: 7
        };

        if (!state.scriptTags[sceneIndex]) {
            state.scriptTags[sceneIndex] = [];
        }

        state.scriptTags[sceneIndex].push(tag);
        totalTagsCreated++;
    });

    // Tag emotional beats that require makeup
    Object.entries(masterContext.emotionalBeats || {}).forEach(([sceneKey, beat]) => {
        const sceneMatch = sceneKey.match(/scene_(\d+)/);
        if (!sceneMatch) return;

        const sceneIndex = parseInt(sceneMatch[1]) - 1;
        if (!state.scenes[sceneIndex]) return;

        const tag = {
            id: generateTagId(),
            category: 'makeup',
            character: beat.character || null,
            selectedText: beat.visualImpact || beat.emotion,
            fullContext: `${beat.character} - ${beat.emotion}: ${beat.visualImpact}`,
            sceneIndex: sceneIndex,
            position: { start: 0, end: 50 },
            importance: 6
        };

        if (!state.scriptTags[sceneIndex]) {
            state.scriptTags[sceneIndex] = [];
        }

        state.scriptTags[sceneIndex].push(tag);
        totalTagsCreated++;
    });

    // Tag major events
    (masterContext.majorEvents || []).forEach(event => {
        const sceneIndex = event.scene - 1;
        if (!state.scenes[sceneIndex]) return;

        let category = 'sfx';
        if (event.type === 'fight') category = 'stunts';
        if (event.type === 'accident') category = 'injuries';
        if (event.type === 'weather') category = 'weather';

        const tag = {
            id: generateTagId(),
            category: category,
            character: event.charactersAffected?.[0] || null,
            selectedText: event.visualImpact || event.type,
            fullContext: `Major event: ${event.type} - ${event.visualImpact}`,
            sceneIndex: sceneIndex,
            position: { start: 0, end: 50 },
            importance: 9
        };

        if (!state.scriptTags[sceneIndex]) {
            state.scriptTags[sceneIndex] = [];
        }

        state.scriptTags[sceneIndex].push(tag);
        totalTagsCreated++;
    });

    console.log(`Created ${totalTagsCreated} tags from master context`);
}

/**
 * Populate initial data from master context
 * Sets up the application state with the comprehensive analysis results
 * @param {Object} masterContext - Master context object
 */
export function populateInitialData(masterContext) {
    console.log('Populating initial data from master context...');

    // Update confirmed characters from master context
    if (masterContext.characters) {
        const characterNames = Object.keys(masterContext.characters);
        window.confirmedCharacters = characterNames;
        state.confirmedCharacters = new Set(characterNames);

        // Separate featured from background characters
        window.featuredCharacters = [];
        window.backgroundCharacters = [];

        Object.entries(masterContext.characters).forEach(([name, data]) => {
            const role = data.characterAnalysis?.role?.toLowerCase();
            const hasDialogue = data.storyPresence?.hasDialogue;
            const sceneCount = data.storyPresence?.totalScenes || data.sceneCount || 0;

            if ((role === 'protagonist' || role === 'antagonist' || role === 'supporting' || role === 'featured') &&
                hasDialogue && sceneCount >= 2) {
                window.featuredCharacters.push(name);
            } else {
                window.backgroundCharacters.push(name);
            }
        });

        state.featuredCharacters = window.featuredCharacters;
        state.backgroundCharacters = window.backgroundCharacters;

        console.log(`Added ${Object.keys(masterContext.characters).length} characters:`, {
            featured: window.featuredCharacters.length,
            background: window.backgroundCharacters.length
        });
    }

    // Create enhanced character importance mapping
    if (masterContext.characters) {
        window.characterImportance = {};
        window.characterProfiles = {};

        Object.entries(masterContext.characters).forEach(([name, data]) => {
            window.characterImportance[name] = {
                role: data.characterAnalysis?.role || 'supporting',
                sceneCount: data.sceneCount || 0,
                firstAppearance: data.firstAppearance || 1,
                lastAppearance: data.lastAppearance || 1
            };

            window.characterProfiles[name] = {
                name: name,
                scriptDescriptions: data.scriptDescriptions || [],
                physicalProfile: data.physicalProfile || {},
                characterAnalysis: data.characterAnalysis || {},
                visualProfile: data.visualProfile || {},
                continuityNotes: data.continuityNotes || {},
                firstAppearance: data.firstAppearance || 1,
                lastAppearance: data.lastAppearance || 1,
                sceneCount: data.sceneCount || 0,
                scenesPresent: data.scenesPresent || []
            };

            // Initialize cast profile in state if not exists
            if (!state.castProfiles[name]) {
                state.castProfiles[name] = {
                    name: name,
                    baseDescription: data.scriptDescriptions?.[0]?.text || '',
                    physicalProfile: data.physicalProfile || {},
                    visualProfile: data.visualProfile || {},
                    scenes: data.scenesPresent || [],
                    lookStates: [],
                    continuityEvents: []
                };
            }
        });

        console.log(`Created enhanced profiles for ${Object.keys(masterContext.characters).length} characters`);
    }

    // Store story structure for timeline tracking
    if (masterContext.storyStructure) {
        window.storyTimeline = masterContext.storyStructure;
        console.log(`Story timeline mapped: ${masterContext.storyStructure.totalDays} days`);

        if (masterContext.storyStructure.timeline) {
            masterContext.storyStructure.timeline.forEach(dayData => {
                dayData.scenes.forEach(sceneNum => {
                    const sceneIndex = sceneNum - 1;
                    if (state.scenes[sceneIndex]) {
                        if (!state.sceneTimeline[sceneIndex]) {
                            state.sceneTimeline[sceneIndex] = {};
                        }
                        state.sceneTimeline[sceneIndex].day = dayData.day;
                        state.scenes[sceneIndex].storyDay = dayData.day;
                    }
                });
            });
        }
    }

    // Pre-populate scene breakdowns with characters
    if (masterContext.characters) {
        console.log('Pre-populating scene breakdowns with characters...');
        let scenesCastPopulated = 0;

        Object.entries(masterContext.characters).forEach(([charName, charData]) => {
            const scenesPresent = charData.scenesPresent || charData.storyPresence?.scenesPresent || [];

            scenesPresent.forEach(sceneNum => {
                const sceneIndex = sceneNum - 1;
                if (state.scenes[sceneIndex]) {
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

                    if (!state.sceneBreakdowns[sceneIndex].cast) {
                        state.sceneBreakdowns[sceneIndex].cast = [];
                    }
                    if (!state.sceneBreakdowns[sceneIndex].cast.includes(charName)) {
                        state.sceneBreakdowns[sceneIndex].cast.push(charName);
                        scenesCastPopulated++;
                    }
                }
            });
        });

        console.log(`Populated ${scenesCastPopulated} character appearances across ${state.scenes.length} scenes`);
    }

    // Store environments affecting appearance
    if (masterContext.environments) {
        window.environmentalContext = masterContext.environments;
        console.log(`Mapped ${Object.keys(masterContext.environments).length} environmental conditions`);

        Object.entries(masterContext.environments).forEach(([sceneKey, envData]) => {
            const sceneMatch = sceneKey.match(/scene_(\d+)/);
            if (sceneMatch) {
                const sceneIndex = parseInt(sceneMatch[1]) - 1;
                if (state.scenes[sceneIndex]) {
                    state.scenes[sceneIndex].environment = envData;
                }
            }
        });
    }

    // Store physical interactions
    if (masterContext.interactions) {
        window.physicalInteractions = masterContext.interactions;
        console.log(`Tracked ${Object.keys(masterContext.interactions).length} physical interactions`);

        Object.entries(masterContext.interactions).forEach(([sceneKey, interaction]) => {
            const sceneMatch = sceneKey.match(/scene_(\d+)/);
            if (sceneMatch) {
                const sceneIndex = parseInt(sceneMatch[1]) - 1;
                if (state.scenes[sceneIndex]) {
                    if (!state.scenes[sceneIndex].interactions) {
                        state.scenes[sceneIndex].interactions = [];
                    }
                    state.scenes[sceneIndex].interactions.push(interaction);
                }
            }
        });
    }

    // Store emotional beats
    if (masterContext.emotionalBeats) {
        window.emotionalBeats = masterContext.emotionalBeats;
        console.log(`Identified ${Object.keys(masterContext.emotionalBeats).length} emotional beats`);

        Object.entries(masterContext.emotionalBeats).forEach(([sceneKey, beat]) => {
            const sceneMatch = sceneKey.match(/scene_(\d+)/);
            if (sceneMatch) {
                const sceneIndex = parseInt(sceneMatch[1]) - 1;
                if (state.scenes[sceneIndex]) {
                    if (!state.scenes[sceneIndex].emotionalBeats) {
                        state.scenes[sceneIndex].emotionalBeats = [];
                    }
                    state.scenes[sceneIndex].emotionalBeats.push(beat);
                }
            }
        });
    }

    // Store dialogue references to appearance
    if (masterContext.dialogueReferences) {
        window.dialogueReferences = masterContext.dialogueReferences;
        console.log(`Extracted ${Object.keys(masterContext.dialogueReferences).length} dialogue appearance references`);
    }

    // Store major events for continuity tracking
    if (masterContext.majorEvents) {
        window.majorEvents = masterContext.majorEvents;
        console.log(`Tracked ${masterContext.majorEvents.length} major continuity events`);

        masterContext.majorEvents.forEach(event => {
            const sceneIndex = event.scene - 1;
            if (event.charactersAffected) {
                event.charactersAffected.forEach(characterName => {
                    if (!state.continuityEvents[characterName]) {
                        state.continuityEvents[characterName] = [];
                    }
                    state.continuityEvents[characterName].push({
                        sceneIndex: sceneIndex,
                        type: event.type,
                        description: event.visualImpact,
                        importance: 8
                    });
                });
            }
        });
    }

    // Update scene list to reflect new data
    renderSceneList();

    // Create character tabs if we have characters
    const characterNames = Object.keys(masterContext.characters || {});
    if (characterNames.length > 0) {
        renderCharacterTabs();
        renderCharacterTabPanels();
    }

    // AUTO-CREATE TAGS from master context data
    console.log('Creating tags from master context data...');
    createTagsFromMasterContext(masterContext);

    // Render highlights to show tags in script
    console.log('Applying highlights to script...');
    setTimeout(() => {
        renderAllHighlights();
    }, 500);

    console.log('Initial data populated successfully:', {
        characters: characterNames.length,
        environments: Object.keys(masterContext.environments || {}).length,
        interactions: Object.keys(masterContext.interactions || {}).length,
        emotionalBeats: Object.keys(masterContext.emotionalBeats || {}).length,
        majorEvents: masterContext.majorEvents?.length || 0,
        tagsCreated: Object.values(state.scriptTags || {}).reduce((sum, tags) => sum + tags.length, 0)
    });
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.populateInitialData = populateInitialData;
window.createTagsFromMasterContext = createTagsFromMasterContext;

export default {
    populateInitialData,
    createTagsFromMasterContext
};

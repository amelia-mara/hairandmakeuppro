/**
 * Live Continuity - Main Module
 * Core logic, data management, and initialization
 * Synced with Master Breakdown data structure
 */

// Import other modules
import { renderTodayView, renderCharacterView, renderSceneView, renderLookbookView } from './continuity-views.js';
import { openContinuityCard, closeContinuityCard, saveContinuityCard, navigateToPreviousScene, navigateToNextScene, toggleProductsEdit, saveProductsEdit } from './continuity-card.js';
import { uploadToSlot, uploadAdditionalPhoto, removeFromSlot, generateCollage, updateCollagePreview } from './continuity-photos.js';
import { openCompareView, closeCompareModal, updateCompareLeft, updateCompareRight, setCompareView } from './continuity-compare.js';
import { openSearchModal, closeSearchModal, performSearch, setSearchFilter } from './continuity-search.js';
import { exportLookbookPDF, printLookbook, filterLookbook } from './continuity-export.js';

// ============================================
// GLOBAL STATE
// ============================================

export const continuityState = {
  projectName: '',
  currentShootDay: 1,
  currentTab: 'today',

  // Data from Master Breakdown (currentProject)
  scenes: [], // All scenes from breakdown
  confirmedCharacters: [], // Character names array
  sceneBreakdowns: {}, // Scene-specific breakdown data keyed by scene index
  characterStates: {}, // Per-scene character states
  continuityEvents: [], // ARRAY of continuity events (not object!)
  cast: {}, // Cast data including looks and products
  castProfiles: {}, // Alternative cast storage
  characterLooks: {}, // Look definitions

  // Shooting schedule structure
  shootingSchedule: {
    shootDays: [], // Array of shoot day objects
    sceneToShootDay: {} // Maps scene index to shoot day index
  },

  // Continuity-specific data (stored separately)
  continuityData: {
    characters: {}, // Per-character continuity records
    sceneIndex: {} // Quick scene lookup
  },

  // Current card editing state
  currentCard: null
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeContinuity();
});

function initializeContinuity() {
  loadProjectData();
  syncFromBreakdownData();
  populateSelectors();
  setupEventListeners();
  renderCurrentTab();
  updateProjectHeader();
}

function loadProjectData() {
  try {
    const projectStr = localStorage.getItem('currentProject');
    if (projectStr) {
      const project = JSON.parse(projectStr);

      // Project name
      continuityState.projectName = project.name || project.projectName || 'Untitled Project';

      // Scenes array
      continuityState.scenes = project.scenes || [];

      // Characters - handle both array and Set
      if (Array.isArray(project.confirmedCharacters)) {
        continuityState.confirmedCharacters = project.confirmedCharacters;
      } else if (project.confirmedCharacters) {
        continuityState.confirmedCharacters = Array.from(project.confirmedCharacters);
      } else {
        continuityState.confirmedCharacters = [];
      }

      // Scene breakdowns
      continuityState.sceneBreakdowns = project.sceneBreakdowns || {};

      // Character states per scene
      continuityState.characterStates = project.characterStates || {};

      // Continuity events - ARRAY format
      continuityState.continuityEvents = Array.isArray(project.continuityEvents)
        ? project.continuityEvents
        : [];

      // Cast data - try both keys
      continuityState.cast = project.cast || {};
      continuityState.castProfiles = project.castProfiles || {};

      // Character looks
      continuityState.characterLooks = project.characterLooks || {};

      // Shooting schedule - handle both old and new formats
      if (project.shootingSchedule) {
        if (project.shootingSchedule.shootDays) {
          // New format with shootDays and sceneToShootDay
          continuityState.shootingSchedule = {
            shootDays: project.shootingSchedule.shootDays || [],
            sceneToShootDay: project.shootingSchedule.sceneToShootDay || {}
          };
        } else if (Array.isArray(project.shootingSchedule)) {
          // Old format - array of days
          continuityState.shootingSchedule = {
            shootDays: project.shootingSchedule,
            sceneToShootDay: {}
          };
        } else {
          continuityState.shootingSchedule = {
            shootDays: [],
            sceneToShootDay: {}
          };
        }
      }
    }

    // Load continuity-specific data (stored separately)
    const continuityDataStr = localStorage.getItem('continuityData');
    if (continuityDataStr) {
      const savedData = JSON.parse(continuityDataStr);
      // Merge with existing structure
      if (savedData.characters) {
        continuityState.continuityData.characters = savedData.characters;
      }
      if (savedData.sceneIndex) {
        continuityState.continuityData.sceneIndex = savedData.sceneIndex;
      }
    }
  } catch (e) {
    console.error('Error loading project data:', e);
  }
}

export function saveData() {
  try {
    localStorage.setItem('continuityData', JSON.stringify(continuityState.continuityData));
  } catch (e) {
    console.error('Error saving continuity data:', e);
  }
}

function updateProjectHeader() {
  const projectNameEl = document.getElementById('project-name');
  if (projectNameEl) {
    projectNameEl.textContent = continuityState.projectName;
  }
}

// ============================================
// SYNC FROM MASTER BREAKDOWN
// ============================================

export function syncFromBreakdownData() {
  const characters = continuityState.confirmedCharacters;

  for (const charName of characters) {
    const castEntry = getCastForCharacter(charName);

    // Ensure character exists in continuity data
    if (!continuityState.continuityData.characters[charName]) {
      continuityState.continuityData.characters[charName] = {
        actorName: castEntry?.actorName || '',
        looks: {},
        continuityEvents: getEventsForCharacter(charName)
      };
    } else {
      // Update actor name if available
      if (castEntry?.actorName) {
        continuityState.continuityData.characters[charName].actorName = castEntry.actorName;
      }
      // Update events
      continuityState.continuityData.characters[charName].continuityEvents = getEventsForCharacter(charName);
    }

    // Sync each look
    const looks = getLooksForCharacter(charName);
    for (const look of looks) {
      const lookId = look.id;

      if (!continuityState.continuityData.characters[charName].looks[lookId]) {
        const testRef = loadTestReferenceFromCharacterDesign(charName, lookId);
        continuityState.continuityData.characters[charName].looks[lookId] = {
          lookId,
          lookName: look.name,
          scenes: look.scenes || [],
          testReference: testRef ? testRef.photos : null,
          master: null,
          products: getProductsForLook(charName, lookId),
          sceneRecords: {}
        };
      } else {
        // Update scenes list
        continuityState.continuityData.characters[charName].looks[lookId].scenes = look.scenes || [];
        // Update products if not manually edited
        if (!continuityState.continuityData.characters[charName].looks[lookId].productsEdited) {
          continuityState.continuityData.characters[charName].looks[lookId].products = getProductsForLook(charName, lookId);
        }
      }
    }
  }

  // Build scene index
  buildSceneIndex();
  saveData();
}

function buildSceneIndex() {
  continuityState.continuityData.sceneIndex = {};

  continuityState.scenes.forEach((scene, index) => {
    // Scene number - use scene.number, scene.sceneNumber, or index + 1
    const sceneNum = getSceneNumber(scene, index);
    // Scene heading - use scene.heading or scene.sceneHeading
    const sceneHeading = scene.heading || scene.sceneHeading || '';
    // Get breakdown data for this scene
    const breakdown = continuityState.sceneBreakdowns[index] || {};

    continuityState.continuityData.sceneIndex[sceneNum] = {
      index,
      sceneNumber: sceneNum,
      sceneHeading: sceneHeading,
      location: extractLocation(sceneHeading),
      characters: breakdown.cast || breakdown.characters || [],
      storyDay: breakdown.storyDay || scene.storyDay || null,
      timeOfDay: scene.timeOfDay || extractTimeOfDay(sceneHeading),
      isFlashback: scene.isFlashback || /flashback/i.test(sceneHeading),
      shootDay: getShootDayForSceneIndex(index),
      characterStates: continuityState.characterStates[index] || {}
    };
  });
}

// ============================================
// HELPER FUNCTIONS - SCENE NUMBERS
// ============================================

export function getSceneNumber(scene, index) {
  // Try various properties used across the codebase
  if (scene.number) return String(scene.number);
  if (scene.sceneNumber) return String(scene.sceneNumber);
  return String(index + 1);
}

export function getSceneByNumber(sceneNum) {
  const sceneData = continuityState.continuityData.sceneIndex[sceneNum];
  if (sceneData) {
    return {
      ...sceneData,
      scene: continuityState.scenes[sceneData.index]
    };
  }
  return null;
}

export function getSceneIndex(sceneNum) {
  const sceneData = continuityState.continuityData.sceneIndex[sceneNum];
  return sceneData ? sceneData.index : -1;
}

function extractLocation(heading) {
  if (!heading) return '';
  // Extract location from scene heading like "INT. OFFICE - DAY"
  const match = heading.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)\s*[-–]/i);
  return match ? match[1].trim() : heading;
}

function extractTimeOfDay(heading) {
  if (!heading) return '';
  const match = heading.match(/[-–]\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|LATER)/i);
  return match ? match[1].toUpperCase() : '';
}

// ============================================
// HELPER FUNCTIONS - CAST & CHARACTERS
// ============================================

export function getCastForCharacter(characterName) {
  // Try cast object first
  const cast = continuityState.cast || {};
  for (const castId in cast) {
    const entry = cast[castId];
    if (entry.characterName === characterName || entry.characterId === characterName) {
      return entry;
    }
  }

  // Try castProfiles
  const profiles = continuityState.castProfiles || {};
  if (profiles[characterName]) {
    return profiles[characterName];
  }

  return null;
}

export function getCharactersInScene(sceneNum) {
  const sceneData = continuityState.continuityData.sceneIndex[sceneNum];
  if (sceneData) {
    return sceneData.characters || [];
  }

  // Fallback: look up from breakdown
  const index = getSceneIndex(sceneNum);
  if (index >= 0) {
    const breakdown = continuityState.sceneBreakdowns[index];
    return breakdown?.cast || breakdown?.characters || [];
  }

  return [];
}

export function getCharacterStateInScene(characterName, sceneNum) {
  const sceneData = continuityState.continuityData.sceneIndex[sceneNum];
  if (sceneData?.characterStates?.[characterName]) {
    return sceneData.characterStates[characterName];
  }

  const index = getSceneIndex(sceneNum);
  if (index >= 0 && continuityState.characterStates[index]) {
    return continuityState.characterStates[index][characterName] || null;
  }

  return null;
}

// ============================================
// HELPER FUNCTIONS - LOOKS
// ============================================

export function getLooksForCharacter(characterName) {
  const lookMap = new Map();
  const castEntry = getCastForCharacter(characterName);

  // First, check if character has defined looks in lookDesigns
  if (castEntry?.lookDesigns) {
    Object.entries(castEntry.lookDesigns).forEach(([lookId, lookData]) => {
      lookMap.set(lookId, {
        id: lookId,
        name: lookData.name || `Look ${lookId.replace('look-', '').toUpperCase()}`,
        scenes: [],
        products: lookData.products || {}
      });
    });
  }

  // Check characterLooks
  if (continuityState.characterLooks?.[characterName]) {
    Object.entries(continuityState.characterLooks[characterName]).forEach(([lookId, lookData]) => {
      if (!lookMap.has(lookId)) {
        lookMap.set(lookId, {
          id: lookId,
          name: lookData.name || `Look ${lookId.replace('look-', '').toUpperCase()}`,
          scenes: lookData.scenes || [],
          products: lookData.products || {}
        });
      } else {
        // Merge scenes
        const existing = lookMap.get(lookId);
        existing.scenes = [...new Set([...existing.scenes, ...(lookData.scenes || [])])];
      }
    });
  }

  // Build scenes list from breakdowns
  continuityState.scenes.forEach((scene, index) => {
    const breakdown = continuityState.sceneBreakdowns[index];
    if (!breakdown) return;

    const castInScene = breakdown.cast || breakdown.characters || [];
    if (!castInScene.includes(characterName)) return;

    const sceneNum = getSceneNumber(scene, index);

    // Try to determine look from scene breakdown or character states
    let lookId = 'look-a';
    let lookName = 'Default Look';

    // Check if there's a look specified in character state
    const charState = continuityState.characterStates[index]?.[characterName];
    if (charState?.look) {
      lookId = charState.look;
      lookName = `Look ${lookId.replace('look-', '').toUpperCase()}`;
    } else {
      // Check hair/makeup notes for look references
      const allNotes = [
        ...(breakdown.hair || []),
        ...(breakdown.makeup || [])
      ].join(' ').toLowerCase();

      const lookMatch = allNotes.match(/look\s*([a-z0-9]+)/i);
      if (lookMatch) {
        lookId = `look-${lookMatch[1].toLowerCase()}`;
        lookName = `Look ${lookMatch[1].toUpperCase()}`;
      }
    }

    if (!lookMap.has(lookId)) {
      lookMap.set(lookId, {
        id: lookId,
        name: lookName,
        scenes: []
      });
    }

    const look = lookMap.get(lookId);
    if (!look.scenes.includes(sceneNum)) {
      look.scenes.push(sceneNum);
    }
  });

  // If no looks found, create a default one with all scenes
  if (lookMap.size === 0) {
    const allScenes = [];
    continuityState.scenes.forEach((scene, index) => {
      const breakdown = continuityState.sceneBreakdowns[index];
      const castInScene = breakdown?.cast || breakdown?.characters || [];
      if (castInScene.includes(characterName)) {
        allScenes.push(getSceneNumber(scene, index));
      }
    });

    lookMap.set('look-a', {
      id: 'look-a',
      name: 'Default Look',
      scenes: allScenes
    });
  }

  // Sort scenes within each look
  for (const look of lookMap.values()) {
    look.scenes.sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });
  }

  return Array.from(lookMap.values());
}

export function getLookForCharacterInScene(characterName, sceneNumber) {
  const character = continuityState.continuityData.characters[characterName];
  if (!character) return null;

  // Convert to string for comparison
  const sceneNum = String(sceneNumber);

  for (const lookId in character.looks) {
    const look = character.looks[lookId];
    if (look.scenes.map(String).includes(sceneNum)) {
      return { lookId, ...look };
    }
  }

  // Return first look as fallback
  const firstLookId = Object.keys(character.looks)[0];
  if (firstLookId) {
    return { lookId: firstLookId, ...character.looks[firstLookId] };
  }

  return null;
}

function getProductsForLook(characterName, lookId) {
  const castEntry = getCastForCharacter(characterName);
  const lookDesign = castEntry?.lookDesigns?.[lookId];

  if (lookDesign?.products) {
    return {
      face: lookDesign.products.face || [],
      eyes: lookDesign.products.eyes || [],
      lips: lookDesign.products.lips || [],
      hair: lookDesign.products.hair || [],
      sfx: lookDesign.products.sfx || []
    };
  }

  return {
    face: [],
    eyes: [],
    lips: [],
    hair: [],
    sfx: []
  };
}

function loadTestReferenceFromCharacterDesign(characterName, lookId) {
  const castEntry = getCastForCharacter(characterName);
  if (!castEntry) return null;

  const lookDesign = castEntry.lookDesigns?.[lookId];
  if (!lookDesign) return null;

  // Get moodboard images marked as test reference
  const testPhotos = lookDesign.moodboard?.elements
    ?.filter(el => el.type === 'image' && el.isTestReference)
    || [];

  // Also check for headshot as fallback
  const headshot = castEntry.headshot;

  return {
    photos: testPhotos.length > 0
      ? { front: testPhotos[0]?.url || testPhotos[0]?.src }
      : (headshot ? { front: headshot } : null),
    products: lookDesign.products || {}
  };
}

// ============================================
// HELPER FUNCTIONS - CONTINUITY EVENTS
// ============================================

export function getEventsForCharacter(characterName) {
  // continuityEvents is an ARRAY
  return continuityState.continuityEvents.filter(
    event => event.character === characterName
  );
}

export function getActiveEventsInScene(characterName, sceneNum) {
  const sceneIndex = getSceneIndex(sceneNum);
  if (sceneIndex < 0) return [];

  const events = getEventsForCharacter(characterName);

  return events.filter(event => {
    const startScene = event.startScene;
    const endScene = event.endScene;
    return sceneIndex >= startScene && sceneIndex <= endScene;
  });
}

export function getEventStageInScene(event, sceneNum) {
  const sceneIndex = getSceneIndex(sceneNum);
  if (sceneIndex < 0 || !event.progression) return null;

  // Find the stage for this scene
  const stage = event.progression.find(p => p.sceneIndex === sceneIndex);
  if (stage) return stage;

  // Find the most recent stage before this scene
  const sortedStages = [...event.progression].sort((a, b) => a.sceneIndex - b.sceneIndex);
  for (let i = sortedStages.length - 1; i >= 0; i--) {
    if (sortedStages[i].sceneIndex <= sceneIndex) {
      return sortedStages[i];
    }
  }

  return null;
}

// ============================================
// HELPER FUNCTIONS - SHOOTING SCHEDULE
// ============================================

export function getShootDayForSceneIndex(sceneIndex) {
  const { sceneToShootDay, shootDays } = continuityState.shootingSchedule;

  // Check sceneToShootDay mapping
  const dayIndex = sceneToShootDay[String(sceneIndex)];
  if (dayIndex !== undefined && shootDays[dayIndex]) {
    return dayIndex + 1; // Return 1-based day number
  }

  return null;
}

export function getShootDayForScene(sceneNumber) {
  const sceneIndex = getSceneIndex(sceneNumber);
  if (sceneIndex < 0) return null;
  return getShootDayForSceneIndex(sceneIndex);
}

export function getScenesForShootDay(dayNumber) {
  const { sceneToShootDay } = continuityState.shootingSchedule;
  const dayIndex = dayNumber - 1; // Convert to 0-based

  const sceneIndices = [];
  Object.entries(sceneToShootDay).forEach(([sceneIdx, shootDayIdx]) => {
    if (shootDayIdx === dayIndex) {
      sceneIndices.push(parseInt(sceneIdx));
    }
  });

  // Sort by scene index
  sceneIndices.sort((a, b) => a - b);

  // Convert to scene numbers
  const sceneNumbers = sceneIndices.map(idx => {
    const scene = continuityState.scenes[idx];
    return scene ? getSceneNumber(scene, idx) : String(idx + 1);
  });

  // If no scenes found in schedule, return all scenes as fallback
  if (sceneNumbers.length === 0 && dayNumber === 1) {
    return continuityState.scenes.map((s, i) => getSceneNumber(s, i));
  }

  return sceneNumbers;
}

export function getShootDayInfo(dayNumber) {
  const { shootDays } = continuityState.shootingSchedule;
  const dayIndex = dayNumber - 1;

  if (shootDays[dayIndex]) {
    const day = shootDays[dayIndex];
    return {
      number: day.number || dayNumber,
      date: day.date || '',
      location: day.location || '',
      notes: day.notes || '',
      status: day.status || 'scheduled',
      scenes: getScenesForShootDay(dayNumber)
    };
  }

  return {
    number: dayNumber,
    date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    location: '',
    notes: '',
    status: 'scheduled',
    scenes: getScenesForShootDay(dayNumber)
  };
}

export function getTotalShootDays() {
  const { shootDays, sceneToShootDay } = continuityState.shootingSchedule;

  // Use the number of shoot days if defined
  if (shootDays.length > 0) {
    return shootDays.length;
  }

  // Otherwise, find the max day index from sceneToShootDay
  let maxDay = 0;
  Object.values(sceneToShootDay).forEach(dayIdx => {
    if (dayIdx > maxDay) maxDay = dayIdx;
  });

  return maxDay > 0 ? maxDay + 1 : 1;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getCurrentDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function getCurrentShootDayNumber() {
  return continuityState.currentShootDay;
}

export function getCurrentUser() {
  return localStorage.getItem('userName') || 'User';
}

export function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================
// TAB NAVIGATION
// ============================================

export function switchTab(tabName) {
  continuityState.currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.center-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });

  renderCurrentTab();
}

function renderCurrentTab() {
  switch (continuityState.currentTab) {
    case 'today':
      renderTodayView();
      break;
    case 'character':
      renderCharacterView();
      break;
    case 'scene':
      renderSceneView();
      break;
    case 'lookbook':
      renderLookbookView();
      break;
  }
}

// ============================================
// SHOOT DAY NAVIGATION
// ============================================

export function goToPreviousDay() {
  if (continuityState.currentShootDay > 1) {
    continuityState.currentShootDay--;
    updateShootDaySelector();
    renderTodayView();
  }
}

export function goToNextDay() {
  const maxDays = getTotalShootDays();
  if (continuityState.currentShootDay < maxDays) {
    continuityState.currentShootDay++;
    updateShootDaySelector();
    renderTodayView();
  }
}

export function changeShootDay(value) {
  continuityState.currentShootDay = parseInt(value, 10);
  renderTodayView();
}

function updateShootDaySelector() {
  const select = document.getElementById('shoot-day-select');
  if (select) {
    select.value = continuityState.currentShootDay;
  }
}

// ============================================
// POPULATE SELECTORS
// ============================================

function populateSelectors() {
  // Populate shoot day selector
  const shootDaySelect = document.getElementById('shoot-day-select');
  if (shootDaySelect) {
    const numDays = Math.max(getTotalShootDays(), 10);
    shootDaySelect.innerHTML = '';
    for (let i = 1; i <= numDays; i++) {
      const option = document.createElement('option');
      option.value = i;
      const dayInfo = getShootDayInfo(i);
      option.textContent = `Day ${i}${dayInfo.date ? ` - ${dayInfo.date}` : ''}`;
      shootDaySelect.appendChild(option);
    }
    shootDaySelect.value = continuityState.currentShootDay;
  }

  // Populate character selector
  const characterSelect = document.getElementById('character-select');
  if (characterSelect) {
    characterSelect.innerHTML = '<option value="">Select character...</option>';
    continuityState.confirmedCharacters.forEach(char => {
      const option = document.createElement('option');
      option.value = char;
      const castEntry = getCastForCharacter(char);
      option.textContent = castEntry?.actorName ? `${char} (${castEntry.actorName})` : char;
      characterSelect.appendChild(option);
    });
  }

  // Populate scene selector
  const sceneSelect = document.getElementById('scene-select');
  if (sceneSelect) {
    sceneSelect.innerHTML = '<option value="">Select scene...</option>';
    continuityState.scenes.forEach((scene, index) => {
      const sceneNum = getSceneNumber(scene, index);
      const sceneHeading = scene.heading || scene.sceneHeading || '';
      const option = document.createElement('option');
      option.value = sceneNum;
      option.textContent = `Scene ${sceneNum} - ${sceneHeading}`;
      sceneSelect.appendChild(option);
    });
  }

  // Populate lookbook character filter
  const lookbookCharFilter = document.getElementById('lookbook-character-filter');
  if (lookbookCharFilter) {
    lookbookCharFilter.innerHTML = '<option value="all">All Characters</option>';
    continuityState.confirmedCharacters.forEach(char => {
      const option = document.createElement('option');
      option.value = char;
      option.textContent = char;
      lookbookCharFilter.appendChild(option);
    });
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Match status radio buttons
  document.querySelectorAll('input[name="match-status"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const varianceContainer = document.getElementById('variance-notes-container');
      if (varianceContainer) {
        varianceContainer.style.display =
          (e.target.value === 'adjusted' || e.target.value === 'different') ? 'block' : 'none';
      }
    });
  });

  // Photo upload input
  const photoInput = document.getElementById('photo-upload-input');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      import('./continuity-photos.js').then(module => {
        module.handlePhotoUpload(e);
      });
    });
  }

  // Close modals when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    }

    // Cmd/Ctrl + F for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      const searchModal = document.getElementById('search-modal');
      if (searchModal && searchModal.style.display !== 'flex') {
        e.preventDefault();
        openSearchModal();
      }
    }
  });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

export function showNotification(message, type = 'info') {
  const toast = document.getElementById('notification-toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `notification-toast visible ${type}`;

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }
}

export function showLoadingState(message = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  if (overlay) {
    if (text) text.textContent = message;
    overlay.style.display = 'flex';
  }
}

export function hideLoadingState() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ============================================
// IMAGE VIEWER
// ============================================

export function viewFullImage(imageType) {
  const modal = document.getElementById('image-viewer-modal');
  const viewerImage = document.getElementById('viewer-image');

  let imageSrc = null;

  if (imageType === 'test' && continuityState.currentCard) {
    const look = continuityState.continuityData.characters[continuityState.currentCard.characterName]
      ?.looks[continuityState.currentCard.lookId];
    if (look?.testReference?.front) {
      imageSrc = look.testReference.front;
    }
  } else if (imageType === 'master' && continuityState.currentCard) {
    const look = continuityState.continuityData.characters[continuityState.currentCard.characterName]
      ?.looks[continuityState.currentCard.lookId];
    if (look?.master?.collage) {
      imageSrc = look.master.collage;
    }
  }

  if (imageSrc && modal && viewerImage) {
    viewerImage.src = imageSrc;
    modal.style.display = 'flex';
  }
}

export function closeImageViewer() {
  const modal = document.getElementById('image-viewer-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ============================================
// GLOBAL WINDOW EXPORTS
// ============================================

// Tab navigation
window.switchTab = switchTab;

// Shoot day navigation
window.goToPreviousDay = goToPreviousDay;
window.goToNextDay = goToNextDay;
window.changeShootDay = changeShootDay;

// Character continuity
window.loadCharacterContinuity = (charName) => {
  import('./continuity-views.js').then(module => {
    module.loadCharacterContinuity(charName);
  });
};

// Scene continuity
window.loadSceneContinuity = (sceneNum) => {
  import('./continuity-views.js').then(module => {
    module.loadSceneContinuity(sceneNum);
  });
};

// Continuity card
window.openContinuityCard = (characterName, sceneNumber) => {
  import('./continuity-card.js').then(module => {
    module.openContinuityCard(characterName, sceneNumber);
  });
};
window.closeContinuityCard = () => {
  import('./continuity-card.js').then(module => {
    module.closeContinuityCard();
  });
};
window.saveContinuityCard = () => {
  import('./continuity-card.js').then(module => {
    module.saveContinuityCard();
  });
};
window.navigateToPreviousScene = () => {
  import('./continuity-card.js').then(module => {
    module.navigateToPreviousScene();
  });
};
window.navigateToNextScene = () => {
  import('./continuity-card.js').then(module => {
    module.navigateToNextScene();
  });
};
window.toggleProductsEdit = () => {
  import('./continuity-card.js').then(module => {
    module.toggleProductsEdit();
  });
};
window.saveProductsEdit = () => {
  import('./continuity-card.js').then(module => {
    module.saveProductsEdit();
  });
};

// Photos
window.uploadToSlot = (slot) => {
  import('./continuity-photos.js').then(module => {
    module.uploadToSlot(slot);
  });
};
window.uploadAdditionalPhoto = () => {
  import('./continuity-photos.js').then(module => {
    module.uploadAdditionalPhoto();
  });
};
window.removeFromSlot = (event, slot) => {
  import('./continuity-photos.js').then(module => {
    module.removeFromSlot(event, slot);
  });
};

// Compare
window.openCompareView = () => {
  import('./continuity-compare.js').then(module => {
    module.openCompareView();
  });
};
window.closeCompareModal = () => {
  import('./continuity-compare.js').then(module => {
    module.closeCompareModal();
  });
};
window.updateCompareLeft = (value) => {
  import('./continuity-compare.js').then(module => {
    module.updateCompareLeft(value);
  });
};
window.updateCompareRight = (value) => {
  import('./continuity-compare.js').then(module => {
    module.updateCompareRight(value);
  });
};
window.setCompareView = (view) => {
  import('./continuity-compare.js').then(module => {
    module.setCompareView(view);
  });
};

// Search
window.openSearchModal = () => {
  import('./continuity-search.js').then(module => {
    module.openSearchModal();
  });
};
window.closeSearchModal = () => {
  import('./continuity-search.js').then(module => {
    module.closeSearchModal();
  });
};
window.performSearch = (query) => {
  import('./continuity-search.js').then(module => {
    module.performSearch(query);
  });
};
window.setSearchFilter = (filter) => {
  import('./continuity-search.js').then(module => {
    module.setSearchFilter(filter);
  });
};

// Export / Lookbook
window.exportLookbookPDF = () => {
  import('./continuity-export.js').then(module => {
    module.exportLookbookPDF();
  });
};
window.printLookbook = () => {
  import('./continuity-export.js').then(module => {
    module.printLookbook();
  });
};
window.filterLookbook = () => {
  import('./continuity-export.js').then(module => {
    module.filterLookbook();
  });
};

// Image viewer
window.viewFullImage = viewFullImage;
window.closeImageViewer = closeImageViewer;

// Today's shoot - mark scene complete
window.markSceneComplete = (sceneNumber) => {
  import('./continuity-views.js').then(module => {
    module.markSceneComplete(sceneNumber);
  });
};

// View test reference from character design
window.viewTestReference = (characterName, lookId) => {
  const look = continuityState.continuityData.characters[characterName]?.looks[lookId];
  if (look?.testReference?.front) {
    const modal = document.getElementById('image-viewer-modal');
    const viewerImage = document.getElementById('viewer-image');
    if (modal && viewerImage) {
      viewerImage.src = look.testReference.front;
      modal.style.display = 'flex';
    }
  } else {
    showNotification('No test reference available', 'warning');
  }
};

// View SFX details
window.viewSFXDetails = (eventId) => {
  const event = continuityState.continuityEvents.find(e => e.id === eventId);
  if (event) {
    showNotification(`${event.type}: ${event.description}`, 'info');
  }
};

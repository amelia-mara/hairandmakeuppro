/**
 * Live Continuity - Main Module
 * Core logic, data management, and initialization
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
  shootingSchedule: [], // Array of shoot days
  scenes: [], // All scenes from breakdown
  confirmedCharacters: [], // Character names
  sceneBreakdowns: {}, // Scene-specific breakdown data
  continuityEvents: {}, // Character continuity events
  cast: {}, // Cast data including looks and products

  // Continuity data
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
      continuityState.projectName = project.name || project.projectName || 'Untitled Project';
      continuityState.scenes = project.scenes || [];
      continuityState.confirmedCharacters = Array.isArray(project.confirmedCharacters)
        ? project.confirmedCharacters
        : Array.from(project.confirmedCharacters || []);
      continuityState.sceneBreakdowns = project.sceneBreakdowns || {};
      continuityState.continuityEvents = project.continuityEvents || {};
      continuityState.cast = project.cast || {};
      continuityState.shootingSchedule = project.shootingSchedule || [];
    }

    // Load continuity-specific data
    const continuityDataStr = localStorage.getItem('continuityData');
    if (continuityDataStr) {
      continuityState.continuityData = JSON.parse(continuityDataStr);
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
// SYNC FROM CHARACTER DESIGN / BREAKDOWN
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
        continuityEvents: continuityState.continuityEvents[charName] || []
      };
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
          products: castEntry?.lookDesigns?.[lookId]?.products || {
            face: [],
            eyes: [],
            lips: [],
            hair: [],
            sfx: []
          },
          sceneRecords: {}
        };
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
    const sceneNum = scene.sceneNumber || String(index + 1);
    const breakdown = continuityState.sceneBreakdowns[index] || {};

    continuityState.continuityData.sceneIndex[sceneNum] = {
      index,
      sceneHeading: scene.sceneHeading || '',
      location: extractLocation(scene.sceneHeading || ''),
      characters: breakdown.cast || breakdown.characters || [],
      storyDay: breakdown.storyDay || null,
      shootDay: getShootDayForScene(sceneNum)
    };
  });
}

function extractLocation(heading) {
  // Extract location from scene heading like "INT. OFFICE - DAY"
  const match = heading.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)\s*[-–]/);
  return match ? match[1].trim() : heading;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getCastForCharacter(characterName) {
  const cast = continuityState.cast || {};
  for (const castId in cast) {
    const entry = cast[castId];
    if (entry.characterName === characterName || entry.characterId === characterName) {
      return entry;
    }
  }
  return null;
}

export function getLooksForCharacter(characterName) {
  // Get looks from scene breakdowns and character states
  const looks = [];
  const lookMap = new Map();

  continuityState.scenes.forEach((scene, index) => {
    const breakdown = continuityState.sceneBreakdowns[index];
    if (!breakdown) return;

    const castInScene = breakdown.cast || breakdown.characters || [];
    if (!castInScene.includes(characterName)) return;

    // Check for look assignments in the breakdown
    const lookNote = breakdown.hair?.find(h =>
      h.toLowerCase().includes('look') ||
      h.toLowerCase().includes(characterName.toLowerCase())
    );

    let lookId = 'look-a';
    let lookName = 'Default Look';

    if (lookNote) {
      const lookMatch = lookNote.match(/look\s*([a-z0-9]+)/i);
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

    lookMap.get(lookId).scenes.push(scene.sceneNumber || String(index + 1));
  });

  // If no looks found, create a default one
  if (lookMap.size === 0) {
    const allScenes = [];
    continuityState.scenes.forEach((scene, index) => {
      const breakdown = continuityState.sceneBreakdowns[index];
      const castInScene = breakdown?.cast || breakdown?.characters || [];
      if (castInScene.includes(characterName)) {
        allScenes.push(scene.sceneNumber || String(index + 1));
      }
    });

    lookMap.set('look-a', {
      id: 'look-a',
      name: 'Default Look',
      scenes: allScenes
    });
  }

  return Array.from(lookMap.values());
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

  // Get products
  const products = lookDesign.products || {};

  return {
    photos: testPhotos.length > 0 ? { front: testPhotos[0]?.url } : null,
    products: products
  };
}

export function getShootDayForScene(sceneNumber) {
  // Check shooting schedule
  for (let i = 0; i < continuityState.shootingSchedule.length; i++) {
    const day = continuityState.shootingSchedule[i];
    if (day.scenes && day.scenes.includes(sceneNumber)) {
      return i + 1;
    }
  }
  return null;
}

export function getScenesForShootDay(dayNumber) {
  const schedule = continuityState.shootingSchedule[dayNumber - 1];
  if (schedule && schedule.scenes) {
    return schedule.scenes;
  }

  // Fallback: return all scenes if no schedule
  return continuityState.scenes.map((s, i) => s.sceneNumber || String(i + 1));
}

export function getShootDayInfo(dayNumber) {
  const schedule = continuityState.shootingSchedule[dayNumber - 1];
  if (schedule) {
    return {
      date: schedule.date || '',
      location: schedule.location || '',
      scenes: schedule.scenes || []
    };
  }
  return {
    date: new Date().toLocaleDateString(),
    location: '',
    scenes: []
  };
}

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

export function getLookForCharacterInScene(characterName, sceneNumber) {
  const character = continuityState.continuityData.characters[characterName];
  if (!character) return null;

  for (const lookId in character.looks) {
    const look = character.looks[lookId];
    if (look.scenes.includes(sceneNumber)) {
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
  const maxDays = Math.max(continuityState.shootingSchedule.length, 1);
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
    const numDays = Math.max(continuityState.shootingSchedule.length, 10);
    shootDaySelect.innerHTML = '';
    for (let i = 1; i <= numDays; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Day ${i}`;
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
      option.textContent = char;
      characterSelect.appendChild(option);
    });
  }

  // Populate scene selector
  const sceneSelect = document.getElementById('scene-select');
  if (sceneSelect) {
    sceneSelect.innerHTML = '<option value="">Select scene...</option>';
    continuityState.scenes.forEach((scene, index) => {
      const sceneNum = scene.sceneNumber || String(index + 1);
      const option = document.createElement('option');
      option.value = sceneNum;
      option.textContent = `Scene ${sceneNum} - ${scene.sceneHeading || 'Unknown'}`;
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
// UTILITY FUNCTIONS
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

export function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function viewFullImage(imageType) {
  // Implementation for viewing full-size images
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
  // Could open a modal with SFX details
  showNotification('SFX details viewer - coming soon', 'info');
};

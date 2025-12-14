/**
 * Live Continuity - Compare Module
 * Handles side-by-side comparison view
 */

import { continuityState, getLookForCharacterInScene, getShootDayForScene } from './continuity-main.js';

// Compare state
let compareState = {
  characterName: null,
  lookId: null,
  leftSelection: 'master',
  rightSelection: null,
  viewMode: 'collage' // collage, front, left, right, back
};

// ============================================
// OPEN COMPARE VIEW
// ============================================

export function openCompareView() {
  if (!continuityState.currentCard) return;

  const { characterName, lookId, sceneNumber } = continuityState.currentCard;

  compareState = {
    characterName,
    lookId,
    leftSelection: 'master',
    rightSelection: sceneNumber,
    viewMode: 'collage'
  };

  const modal = document.getElementById('compare-modal');
  if (!modal) return;

  // Update title
  const character = continuityState.continuityData.characters[characterName];
  const look = character?.looks[lookId];
  const title = document.getElementById('compare-modal-title');
  if (title) {
    title.textContent = `COMPARE · ${characterName} · Look: ${look?.lookName || 'Default'}`;
  }

  // Populate dropdowns
  populateCompareSelectors();

  // Set initial selections
  document.getElementById('compare-left-select').value = 'master';
  document.getElementById('compare-right-select').value = sceneNumber;

  // Update images
  updateCompareLeft('master');
  updateCompareRight(sceneNumber);

  // Update view buttons
  updateViewButtons();

  modal.style.display = 'flex';
}

function populateCompareSelectors() {
  const { characterName, lookId } = compareState;
  const character = continuityState.continuityData.characters[characterName];
  const look = character?.looks[lookId];

  if (!look) return;

  const leftSelect = document.getElementById('compare-left-select');
  const rightSelect = document.getElementById('compare-right-select');

  // Common options
  const baseOptions = `
    <option value="master">Master</option>
    <option value="test">Test Reference</option>
  `;

  // Scene options
  const sceneOptions = look.scenes.map(sceneNum => {
    const record = look.sceneRecords[sceneNum];
    const shootDay = getShootDayForScene(sceneNum);
    const hasData = record?.collage;
    return `<option value="${sceneNum}" ${!hasData ? 'disabled' : ''}>Scene ${sceneNum}${shootDay ? ` (Day ${shootDay})` : ''}</option>`;
  }).join('');

  leftSelect.innerHTML = baseOptions + sceneOptions;
  rightSelect.innerHTML = baseOptions + sceneOptions;
}

// ============================================
// UPDATE PANELS
// ============================================

export function updateCompareLeft(value) {
  compareState.leftSelection = value;
  updatePanel('left', value);
}

export function updateCompareRight(value) {
  compareState.rightSelection = value;
  updatePanel('right', value);
}

function updatePanel(side, value) {
  const { characterName, lookId, viewMode } = compareState;
  const character = continuityState.continuityData.characters[characterName];
  const look = character?.looks[lookId];

  if (!look) return;

  const imageContainer = document.getElementById(`compare-${side}-image-container`);
  const detailsContainer = document.getElementById(`compare-${side}-details`);
  const image = document.getElementById(`compare-${side}-image`);

  let imageSrc = null;
  let dateText = '';
  let notesText = '';

  if (value === 'master') {
    if (look.master) {
      imageSrc = getImageForView(look.master, viewMode);
      const shootDay = getShootDayForScene(look.master.sceneNumber);
      dateText = `Scene ${look.master.sceneNumber} · Day ${shootDay || '?'}`;
      notesText = look.master.varianceFromTest || 'Master reference';
    } else {
      dateText = 'No master captured yet';
    }
  } else if (value === 'test') {
    if (look.testReference) {
      imageSrc = look.testReference.front; // Test reference usually only has front
      dateText = 'Camera Test';
      notesText = 'Test reference from Character Design';
    } else {
      dateText = 'No test reference available';
    }
  } else {
    // Scene number
    const record = look.sceneRecords[value];
    if (record) {
      imageSrc = getImageForView(record, viewMode);
      const shootDay = getShootDayForScene(value);
      dateText = `Scene ${value} · Day ${shootDay || '?'}`;
      notesText = record.varianceNotes || (record.matchStatus === 'matches' ? 'Matches master' : record.matchStatus);
    } else {
      dateText = `Scene ${value} - Not captured`;
    }
  }

  // Update image
  if (image) {
    if (imageSrc) {
      image.src = imageSrc;
      image.style.display = 'block';
    } else {
      image.style.display = 'none';
      imageContainer.innerHTML = '<div class="placeholder-collage">No image available</div>';
    }
  }

  // Update details
  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <span class="detail-date">${dateText}</span>
      <span class="detail-notes">${notesText}</span>
    `;
  }
}

function getImageForView(record, viewMode) {
  if (viewMode === 'collage') {
    return record.collage;
  }

  // Individual view
  return record.photos?.[viewMode] || record.collage;
}

// ============================================
// VIEW MODE
// ============================================

export function setCompareView(view) {
  compareState.viewMode = view;
  updateViewButtons();
  updatePanel('left', compareState.leftSelection);
  updatePanel('right', compareState.rightSelection);
}

function updateViewButtons() {
  const buttons = document.querySelectorAll('.compare-view-options .view-btn');
  buttons.forEach(btn => {
    const isActive = btn.textContent.toLowerCase() === compareState.viewMode;
    btn.classList.toggle('active', isActive);
  });
}

// ============================================
// CLOSE MODAL
// ============================================

export function closeCompareModal() {
  const modal = document.getElementById('compare-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

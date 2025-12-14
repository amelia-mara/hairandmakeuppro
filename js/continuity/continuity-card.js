/**
 * Live Continuity - Card Module
 * Handles the Continuity Card modal for individual character/scene continuity
 */

import {
  continuityState,
  getLookForCharacterInScene,
  getCastForCharacter,
  getShootDayForScene,
  getCurrentDate,
  getCurrentShootDayNumber,
  getCurrentUser,
  saveData,
  showNotification,
  switchTab
} from './continuity-main.js';

import { renderTodayView, loadCharacterContinuity, loadSceneContinuity } from './continuity-views.js';
import { updateCollagePreview } from './continuity-photos.js';

// ============================================
// OPEN CONTINUITY CARD
// ============================================

export function openContinuityCard(characterName, sceneNumber) {
  const modal = document.getElementById('continuity-card-modal');
  if (!modal) return;

  const look = getLookForCharacterInScene(characterName, sceneNumber);
  if (!look) {
    showNotification(`No look found for ${characterName} in scene ${sceneNumber}`, 'error');
    return;
  }

  const character = continuityState.continuityData.characters[characterName];
  if (!character) {
    showNotification(`Character ${characterName} not found`, 'error');
    return;
  }

  const lookData = character.looks[look.lookId];
  const sceneRecord = lookData?.sceneRecords[sceneNumber] || {};
  const castEntry = getCastForCharacter(characterName);

  // Set current card state
  continuityState.currentCard = {
    characterName,
    sceneNumber,
    lookId: look.lookId,
    lookName: look.lookName,
    photos: sceneRecord.photos ? { ...sceneRecord.photos } : {},
    additionalPhotos: sceneRecord.additionalPhotos ? [...sceneRecord.additionalPhotos] : [],
    collage: sceneRecord.collage || null,
    matchStatus: sceneRecord.matchStatus || 'matches',
    varianceNotes: sceneRecord.varianceNotes || '',
    notes: sceneRecord.notes || '',
    activeEvents: sceneRecord.activeEvents || [],
    products: lookData?.products || {}
  };

  // Get scene info
  const sceneData = continuityState.continuityData.sceneIndex[sceneNumber];

  // Update header
  document.getElementById('card-character-name').textContent = characterName;
  document.getElementById('card-scene-info').textContent = `Scene ${sceneNumber} · ${sceneData?.sceneHeading || ''}`;
  document.getElementById('card-look-badge').textContent = `Look: ${look.lookName}`;

  // Update test reference
  updateTestReference(lookData);

  // Update master reference
  updateMasterReference(lookData);

  // Update surrounding scenes
  updateSurroundingScenes(characterName, look.lookId, sceneNumber);

  // Update current scene label
  document.getElementById('current-scene-label').textContent = `Scene ${sceneNumber}`;

  // Reset photo slots
  resetPhotoSlots();

  // Populate existing photos if any
  if (continuityState.currentCard.photos) {
    Object.entries(continuityState.currentCard.photos).forEach(([slot, dataUrl]) => {
      if (dataUrl) {
        showPhotoInSlot(slot, dataUrl);
      }
    });
  }

  // Populate additional photos
  renderAdditionalPhotos();

  // Update collage preview
  if (continuityState.currentCard.collage) {
    document.getElementById('collage-preview').classList.remove('hidden');
    const canvas = document.getElementById('collage-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = continuityState.currentCard.collage;
    }
  } else {
    document.getElementById('collage-preview').classList.add('hidden');
  }

  // Update match status
  const matchStatus = continuityState.currentCard.matchStatus;
  const radio = document.querySelector(`input[name="match-status"][value="${matchStatus}"]`);
  if (radio) radio.checked = true;

  // Show/hide variance notes
  const varianceContainer = document.getElementById('variance-notes-container');
  if (varianceContainer) {
    varianceContainer.style.display = (matchStatus === 'adjusted' || matchStatus === 'different') ? 'block' : 'none';
  }
  const varianceNotes = document.getElementById('variance-notes');
  if (varianceNotes) varianceNotes.value = continuityState.currentCard.varianceNotes;

  // Update continuity alerts
  updateContinuityAlerts(characterName, sceneNumber);

  // Update products
  updateProductsDisplay(lookData, castEntry);

  // Update notes
  const notesEl = document.getElementById('scene-notes');
  if (notesEl) notesEl.value = continuityState.currentCard.notes;

  // Update capture info
  updateCaptureInfo(sceneRecord);

  // Show modal
  modal.style.display = 'flex';
}

function updateTestReference(lookData) {
  const container = document.getElementById('test-ref-collage');
  const meta = document.getElementById('test-ref-meta');

  if (lookData?.testReference?.front) {
    container.innerHTML = `<img src="${lookData.testReference.front}" alt="Test reference">`;
    meta.innerHTML = '<span>Camera Test</span>';
  } else {
    container.innerHTML = '<div class="placeholder-collage">No test reference</div>';
    meta.innerHTML = '<span>No test reference available</span>';
  }
}

function updateMasterReference(lookData) {
  const container = document.getElementById('master-ref-collage');
  const sceneInfo = document.getElementById('master-scene-info');
  const meta = document.getElementById('master-ref-meta');

  if (lookData?.master?.collage) {
    container.innerHTML = `<img src="${lookData.master.collage}" alt="Master">`;
    sceneInfo.textContent = `(Scene ${lookData.master.sceneNumber})`;
    const shootDay = getShootDayForScene(lookData.master.sceneNumber);
    meta.innerHTML = `
      <span>${lookData.master.shootDay || ''}</span>
      ${lookData.master.varianceFromTest ? `<span class="variance">${lookData.master.varianceFromTest}</span>` : ''}
    `;
  } else {
    container.innerHTML = '<div class="placeholder-collage">Not yet captured</div>';
    sceneInfo.textContent = '';
    meta.innerHTML = '<span>First capture will become master</span>';
  }
}

function updateSurroundingScenes(characterName, lookId, currentSceneNumber) {
  const character = continuityState.continuityData.characters[characterName];
  const look = character?.looks[lookId];
  if (!look) return;

  const scenes = look.scenes;
  const currentIdx = scenes.indexOf(currentSceneNumber);

  // Previous scene
  const prevPanel = document.getElementById('previous-scene-panel');
  const prevCollage = document.getElementById('previous-scene-collage');
  const prevMeta = document.getElementById('previous-scene-meta');

  let prevScene = null;
  for (let i = currentIdx - 1; i >= 0; i--) {
    const sceneNum = scenes[i];
    const record = look.sceneRecords[sceneNum];
    if (record?.status === 'complete' && record.collage) {
      prevScene = { sceneNumber: sceneNum, record };
      break;
    }
  }

  // If no previous captured, use master
  if (!prevScene && look.master?.collage) {
    prevScene = {
      sceneNumber: look.master.sceneNumber,
      record: { collage: look.master.collage },
      isMaster: true
    };
  }

  if (prevScene) {
    const label = prevPanel.querySelector('.surround-label');
    label.textContent = prevScene.isMaster ? `← MASTER (Sc ${prevScene.sceneNumber})` : `← PREVIOUS (Sc ${prevScene.sceneNumber})`;
    prevCollage.innerHTML = `<img src="${prevScene.record.collage}" alt="Previous">`;
    const shootDay = getShootDayForScene(prevScene.sceneNumber);
    prevMeta.textContent = shootDay ? `Day ${shootDay}` : '';
    prevPanel.onclick = () => openContinuityCard(characterName, prevScene.sceneNumber);
  } else {
    prevPanel.querySelector('.surround-label').textContent = '← PREVIOUS';
    prevCollage.innerHTML = '<div class="placeholder-collage">No previous</div>';
    prevMeta.textContent = '';
    prevPanel.onclick = null;
  }

  // Next scene
  const nextPanel = document.getElementById('next-scene-panel');
  const nextCollage = document.getElementById('next-scene-collage');
  const nextMeta = document.getElementById('next-scene-meta');

  if (currentIdx < scenes.length - 1) {
    const nextSceneNum = scenes[currentIdx + 1];
    const record = look.sceneRecords[nextSceneNum];
    const shootDay = getShootDayForScene(nextSceneNum);

    nextPanel.querySelector('.surround-label').textContent = `NEXT (Sc ${nextSceneNum}) →`;
    if (record?.collage) {
      nextCollage.innerHTML = `<img src="${record.collage}" alt="Next">`;
    } else {
      nextCollage.innerHTML = '<span class="placeholder-collage">Pending</span>';
    }
    nextMeta.textContent = shootDay ? `Day ${shootDay}` : '';
    nextPanel.onclick = () => openContinuityCard(characterName, nextSceneNum);
  } else {
    nextPanel.querySelector('.surround-label').textContent = 'NEXT →';
    nextCollage.innerHTML = '<div class="placeholder-collage">Last scene in look</div>';
    nextMeta.textContent = '';
    nextPanel.onclick = null;
  }

  // Store for navigation
  continuityState.currentCard.prevScene = prevScene?.sceneNumber;
  continuityState.currentCard.nextScene = currentIdx < scenes.length - 1 ? scenes[currentIdx + 1] : null;
}

function resetPhotoSlots() {
  ['front', 'left', 'right', 'back'].forEach(slot => {
    const placeholder = document.getElementById(`slot-${slot}-placeholder`);
    const image = document.getElementById(`slot-${slot}-image`);
    const removeBtn = document.getElementById(`slot-${slot}-remove`);

    if (placeholder) placeholder.classList.remove('hidden');
    if (image) {
      image.classList.add('hidden');
      image.src = '';
    }
    if (removeBtn) removeBtn.classList.add('hidden');
  });
}

export function showPhotoInSlot(slot, dataUrl) {
  const placeholder = document.getElementById(`slot-${slot}-placeholder`);
  const image = document.getElementById(`slot-${slot}-image`);
  const removeBtn = document.getElementById(`slot-${slot}-remove`);

  if (placeholder) placeholder.classList.add('hidden');
  if (image) {
    image.src = dataUrl;
    image.classList.remove('hidden');
  }
  if (removeBtn) removeBtn.classList.remove('hidden');
}

export function hidePhotoInSlot(slot) {
  const placeholder = document.getElementById(`slot-${slot}-placeholder`);
  const image = document.getElementById(`slot-${slot}-image`);
  const removeBtn = document.getElementById(`slot-${slot}-remove`);

  if (placeholder) placeholder.classList.remove('hidden');
  if (image) {
    image.classList.add('hidden');
    image.src = '';
  }
  if (removeBtn) removeBtn.classList.add('hidden');
}

export function renderAdditionalPhotos() {
  const grid = document.getElementById('additional-photos-grid');
  if (!grid || !continuityState.currentCard) return;

  const photos = continuityState.currentCard.additionalPhotos || [];

  grid.innerHTML = photos.map((photo, index) => `
    <div class="additional-thumb" data-id="${photo.id}">
      <img src="${photo.url}" alt="${photo.label || 'Additional photo'}">
      <button class="remove-btn" onclick="removeAdditionalPhoto('${photo.id}')">×</button>
    </div>
  `).join('');
}

function updateContinuityAlerts(characterName, sceneNumber) {
  const alertsList = document.getElementById('alerts-list');
  const alertsSection = document.getElementById('alerts-section');
  if (!alertsList || !alertsSection) return;

  const events = continuityState.continuityEvents[characterName] || [];
  const sceneIdx = parseInt(sceneNumber);

  const alerts = [];

  events.forEach(event => {
    // Check if event starts in this scene
    if (event.startScene === sceneIdx) {
      alerts.push({
        type: 'start',
        text: `${event.description || event.type} starts this scene`,
        eventId: event.id
      });
    }

    // Check for stage in this scene
    const stage = event.progression?.find(p => p.sceneIndex === sceneIdx);
    if (stage) {
      alerts.push({
        type: 'stage',
        text: `${event.description || event.type} (${stage.stage.toUpperCase()} stage)`,
        eventId: event.id,
        makeupNotes: stage.makeupNotes
      });
    }

    // Check if event ends in this scene
    if (event.endScene === sceneIdx) {
      alerts.push({
        type: 'end',
        text: `${event.description || event.type} ends this scene`,
        eventId: event.id
      });
    }
  });

  if (alerts.length === 0) {
    alertsSection.style.display = 'none';
    return;
  }

  alertsSection.style.display = 'block';
  alertsList.innerHTML = alerts.map(alert => `
    <div class="alert-item">
      <span class="alert-icon">⚠</span>
      <span class="alert-text">${alert.text}</span>
      <button class="view-sfx-btn" onclick="viewSFXDetails('${alert.eventId}')">View SFX Notes</button>
    </div>
  `).join('');

  // Store active events
  continuityState.currentCard.activeEvents = alerts.map(a => a.eventId);
}

function updateProductsDisplay(lookData, castEntry) {
  const products = lookData?.products || castEntry?.lookDesigns?.[continuityState.currentCard.lookId]?.products || {};
  const source = document.getElementById('products-source');

  if (source) {
    source.textContent = `From Look: ${continuityState.currentCard.lookName}`;
  }

  // Update display values
  document.getElementById('products-face').textContent = formatProducts(products.face) || '-';
  document.getElementById('products-eyes').textContent = formatProducts(products.eyes) || '-';
  document.getElementById('products-lips').textContent = formatProducts(products.lips) || '-';
  document.getElementById('products-hair').textContent = formatProducts(products.hair) || '-';

  // SFX products
  const sfxRow = document.getElementById('products-sfx-row');
  const sfxProducts = products.sfx;
  if (sfxProducts && (Array.isArray(sfxProducts) ? sfxProducts.length > 0 : sfxProducts)) {
    sfxRow.style.display = 'flex';
    document.getElementById('products-sfx').textContent = formatProducts(sfxProducts);
  } else {
    sfxRow.style.display = 'none';
  }

  // Update edit fields
  document.getElementById('edit-products-face').value = formatProducts(products.face) || '';
  document.getElementById('edit-products-eyes').value = formatProducts(products.eyes) || '';
  document.getElementById('edit-products-lips').value = formatProducts(products.lips) || '';
  document.getElementById('edit-products-hair').value = formatProducts(products.hair) || '';
  document.getElementById('edit-products-sfx').value = formatProducts(products.sfx) || '';
}

function formatProducts(products) {
  if (!products) return '';
  if (Array.isArray(products)) return products.join(', ');
  return products;
}

function updateCaptureInfo(sceneRecord) {
  const capturedBy = document.getElementById('captured-by');
  const capturedAt = document.getElementById('captured-at');

  if (sceneRecord.capturedAt) {
    const date = new Date(sceneRecord.capturedAt);
    capturedAt.textContent = date.toLocaleString();
    capturedBy.textContent = `Captured by: ${sceneRecord.capturedBy || 'Unknown'}`;
  } else {
    capturedAt.textContent = '';
    capturedBy.textContent = '';
  }
}

// ============================================
// CLOSE CONTINUITY CARD
// ============================================

export function closeContinuityCard() {
  const modal = document.getElementById('continuity-card-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  continuityState.currentCard = null;
}

// ============================================
// SAVE CONTINUITY CARD
// ============================================

export function saveContinuityCard() {
  if (!continuityState.currentCard) return;

  const { characterName, sceneNumber, lookId } = continuityState.currentCard;

  const character = continuityState.continuityData.characters[characterName];
  if (!character) {
    showNotification('Character not found', 'error');
    return;
  }

  const look = character.looks[lookId];
  if (!look) {
    showNotification('Look not found', 'error');
    return;
  }

  // Get current form values
  const matchStatus = document.querySelector('input[name="match-status"]:checked')?.value || 'matches';
  const varianceNotes = document.getElementById('variance-notes')?.value || '';
  const notes = document.getElementById('scene-notes')?.value || '';

  // Create/update scene record
  const hasPhotos = Object.values(continuityState.currentCard.photos || {}).some(p => p);

  look.sceneRecords[sceneNumber] = {
    sceneNumber,
    shootDay: getCurrentDate(),
    shootDayNumber: getCurrentShootDayNumber(),
    status: hasPhotos ? 'complete' : 'pending',
    photos: continuityState.currentCard.photos || {},
    collage: continuityState.currentCard.collage || null,
    additionalPhotos: continuityState.currentCard.additionalPhotos || [],
    matchStatus,
    varianceNotes,
    notes,
    activeEvents: continuityState.currentCard.activeEvents || [],
    capturedAt: hasPhotos ? new Date().toISOString() : null,
    capturedBy: hasPhotos ? getCurrentUser() : null
  };

  // If this is the first capture in this look, set as master
  if (!look.master?.collage && continuityState.currentCard.collage) {
    look.master = {
      sceneNumber,
      shootDay: getCurrentDate(),
      photos: continuityState.currentCard.photos,
      collage: continuityState.currentCard.collage,
      varianceFromTest: varianceNotes,
      notes: ''
    };
    look.sceneRecords[sceneNumber].isMaster = true;

    showNotification(`Scene ${sceneNumber} set as master for ${look.lookName}`, 'success');
  } else if (hasPhotos) {
    showNotification('Continuity saved successfully', 'success');
  }

  saveData();
  closeContinuityCard();
  refreshCurrentView();
}

function refreshCurrentView() {
  switch (continuityState.currentTab) {
    case 'today':
      renderTodayView();
      break;
    case 'character':
      const charSelect = document.getElementById('character-select');
      if (charSelect?.value) {
        loadCharacterContinuity(charSelect.value);
      }
      break;
    case 'scene':
      const sceneSelect = document.getElementById('scene-select');
      if (sceneSelect?.value) {
        loadSceneContinuity(sceneSelect.value);
      }
      break;
    case 'lookbook':
      import('./continuity-export.js').then(module => {
        module.filterLookbook();
      });
      break;
  }
}

// ============================================
// NAVIGATION
// ============================================

export function navigateToPreviousScene() {
  if (!continuityState.currentCard?.prevScene) return;
  const { characterName, prevScene } = continuityState.currentCard;
  openContinuityCard(characterName, prevScene);
}

export function navigateToNextScene() {
  if (!continuityState.currentCard?.nextScene) return;
  const { characterName, nextScene } = continuityState.currentCard;
  openContinuityCard(characterName, nextScene);
}

// ============================================
// PRODUCTS EDITING
// ============================================

export function toggleProductsEdit() {
  const display = document.getElementById('products-display');
  const edit = document.getElementById('products-edit');

  if (display && edit) {
    display.classList.toggle('hidden');
    edit.classList.toggle('hidden');
  }
}

export function saveProductsEdit() {
  if (!continuityState.currentCard) return;

  const { characterName, lookId } = continuityState.currentCard;
  const look = continuityState.continuityData.characters[characterName]?.looks[lookId];
  if (!look) return;

  // Get values from edit fields
  const face = document.getElementById('edit-products-face')?.value || '';
  const eyes = document.getElementById('edit-products-eyes')?.value || '';
  const lips = document.getElementById('edit-products-lips')?.value || '';
  const hair = document.getElementById('edit-products-hair')?.value || '';
  const sfx = document.getElementById('edit-products-sfx')?.value || '';

  // Update look products
  look.products = {
    face: face ? face.split(',').map(s => s.trim()) : [],
    eyes: eyes ? eyes.split(',').map(s => s.trim()) : [],
    lips: lips ? lips.split(',').map(s => s.trim()) : [],
    hair: hair ? hair.split(',').map(s => s.trim()) : [],
    sfx: sfx ? sfx.split(',').map(s => s.trim()) : []
  };

  // Update current card state
  continuityState.currentCard.products = look.products;

  // Update display
  document.getElementById('products-face').textContent = face || '-';
  document.getElementById('products-eyes').textContent = eyes || '-';
  document.getElementById('products-lips').textContent = lips || '-';
  document.getElementById('products-hair').textContent = hair || '-';

  const sfxRow = document.getElementById('products-sfx-row');
  if (sfx) {
    sfxRow.style.display = 'flex';
    document.getElementById('products-sfx').textContent = sfx;
  } else {
    sfxRow.style.display = 'none';
  }

  toggleProductsEdit();
  saveData();
  showNotification('Products updated', 'success');
}

// Global for removing additional photos
window.removeAdditionalPhoto = (photoId) => {
  if (!continuityState.currentCard) return;

  continuityState.currentCard.additionalPhotos = (continuityState.currentCard.additionalPhotos || [])
    .filter(p => p.id !== photoId);

  renderAdditionalPhotos();
};

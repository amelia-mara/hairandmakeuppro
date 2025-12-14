/**
 * Live Continuity - Views Module
 * Handles rendering of Today, By Character, By Scene, and Lookbook views
 */

import {
  continuityState,
  getScenesForShootDay,
  getShootDayInfo,
  getLookForCharacterInScene,
  getShootDayForScene,
  getCastForCharacter,
  getLooksForCharacter,
  saveData,
  showNotification,
  getInitials
} from './continuity-main.js';

// ============================================
// TODAY'S SHOOT VIEW
// ============================================

export function renderTodayView() {
  const dayNumber = continuityState.currentShootDay;
  const dayInfo = getShootDayInfo(dayNumber);
  const scenes = getScenesForShootDay(dayNumber);

  // Update header
  const shootDayTitle = document.getElementById('shoot-day-title');
  const shootDate = document.getElementById('shoot-date');
  const shootLocation = document.getElementById('shoot-location');

  if (shootDayTitle) shootDayTitle.textContent = `SHOOT DAY ${dayNumber}`;
  if (shootDate) shootDate.textContent = dayInfo.date || new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (shootLocation) shootLocation.textContent = dayInfo.location || '';

  // Render scenes timeline
  const timeline = document.getElementById('scenes-timeline');
  if (!timeline) return;

  if (scenes.length === 0) {
    timeline.innerHTML = `
      <div class="empty-state">
        <p>No scenes scheduled for this day. Set up the shooting schedule in the dashboard.</p>
      </div>
    `;
    return;
  }

  // Group scenes by status
  const shootingScenes = [];
  const upcomingScenes = [];
  const completedScenes = [];

  scenes.forEach(sceneNum => {
    const sceneData = continuityState.continuityData.sceneIndex[sceneNum] || {};
    const status = getSceneStatus(sceneNum, dayNumber);

    const sceneInfo = {
      sceneNumber: sceneNum,
      sceneHeading: sceneData.sceneHeading || '',
      characters: sceneData.characters || [],
      status
    };

    if (status === 'shooting') shootingScenes.push(sceneInfo);
    else if (status === 'completed') completedScenes.push(sceneInfo);
    else upcomingScenes.push(sceneInfo);
  });

  let html = '';

  // Shooting scenes
  shootingScenes.forEach(scene => {
    html += renderSceneBlock(scene, 'shooting');
  });

  // Upcoming scenes
  upcomingScenes.forEach(scene => {
    html += renderSceneBlock(scene, 'upcoming');
  });

  // Completed scenes
  completedScenes.forEach(scene => {
    html += renderSceneBlock(scene, 'completed');
  });

  timeline.innerHTML = html;
}

function getSceneStatus(sceneNumber, shootDay) {
  // Check continuity data for completion status
  const sceneRecords = getAllSceneRecords(sceneNumber);
  if (sceneRecords.every(r => r && r.status === 'complete')) {
    return 'completed';
  }

  // Default to upcoming (could add shooting detection)
  return 'upcoming';
}

function getAllSceneRecords(sceneNumber) {
  const records = [];
  for (const charName in continuityState.continuityData.characters) {
    const char = continuityState.continuityData.characters[charName];
    for (const lookId in char.looks) {
      const look = char.looks[lookId];
      if (look.scenes.includes(sceneNumber) && look.sceneRecords[sceneNumber]) {
        records.push(look.sceneRecords[sceneNumber]);
      }
    }
  }
  return records;
}

function renderSceneBlock(scene, status) {
  const statusLabels = {
    shooting: 'SHOOTING',
    upcoming: 'UP NEXT',
    completed: 'COMPLETE'
  };

  const statusBadge = `<div class="scene-status-badge ${status}">${statusLabels[status]}</div>`;

  // Get cast for this scene
  const castHtml = renderSceneCast(scene.sceneNumber, status);

  // Check for scene flags (flashback, etc)
  const flags = getSceneFlags(scene.sceneNumber);
  const flagsHtml = flags ? `<span class="scene-flags">${flags}</span>` : '';

  return `
    <div class="scene-block ${status}" data-scene-number="${scene.sceneNumber}">
      <div class="scene-block-header">
        ${statusBadge}
        <div class="scene-info">
          <span class="scene-number">SC ${scene.sceneNumber}</span>
          <span class="scene-heading">${scene.sceneHeading}</span>
          ${flagsHtml}
        </div>
        ${status === 'shooting' ? `<button class="mark-complete-btn" onclick="markSceneComplete('${scene.sceneNumber}')">Mark Complete</button>` : ''}
        ${status === 'completed' ? `<span class="completion-time">Wrapped</span>` : ''}
      </div>
      ${castHtml}
    </div>
  `;
}

function renderSceneCast(sceneNumber, status) {
  const sceneData = continuityState.continuityData.sceneIndex[sceneNumber] || {};
  const characters = sceneData.characters || [];

  if (characters.length === 0) {
    return `<div class="scene-cast-summary">No cast assigned</div>`;
  }

  if (status === 'completed') {
    // Compact view for completed scenes
    const thumbnails = characters.map(charName => {
      const look = getLookForCharacterInScene(charName, sceneNumber);
      const record = look ? continuityState.continuityData.characters[charName]?.looks[look.lookId]?.sceneRecords[sceneNumber] : null;
      const collage = record?.collage;

      return `
        <div class="cast-thumbnail" onclick="openContinuityCard('${charName}', '${sceneNumber}')">
          ${collage ? `<img src="${collage}" alt="${charName}">` : `<div class="placeholder-collage">${getInitials(charName)}</div>`}
          <span>${charName.split(' ')[0]}</span>
        </div>
      `;
    }).join('');

    return `<div class="scene-cast-grid compact">${thumbnails}</div>`;
  }

  // Full cards for shooting/upcoming
  const cards = characters.map(charName => {
    const look = getLookForCharacterInScene(charName, sceneNumber);
    const character = continuityState.continuityData.characters[charName];
    const record = look && character ? character.looks[look.lookId]?.sceneRecords[sceneNumber] : null;

    const hasPhotos = record?.collage;
    const statusClass = hasPhotos ? 'captured' : 'awaiting';
    const statusText = hasPhotos ? 'Captured' : 'Awaiting photos';

    // Get alerts
    const alerts = getContinuityAlerts(charName, sceneNumber);
    const alertsHtml = alerts.length > 0
      ? `<div class="card-alerts">${alerts.map(a => `<span class="alert-badge">${a}</span>`).join('')}</div>`
      : '';

    return `
      <div class="cast-continuity-card" data-character="${charName}" data-scene="${sceneNumber}">
        <div class="card-photo-area" onclick="openContinuityCard('${charName}', '${sceneNumber}')">
          ${hasPhotos
            ? `<img src="${record.collage}" alt="${charName}">`
            : `<div class="collage-placeholder"><span class="placeholder-icon">+</span><span class="placeholder-text">Upload Photos</span></div>`
          }
        </div>
        <div class="card-info">
          <span class="character-name">${charName}</span>
          <span class="look-name">Look: ${look?.lookName || 'Default'}</span>
          <span class="status ${statusClass}">${statusText}</span>
        </div>
        ${alertsHtml}
        <button class="open-card-btn" onclick="openContinuityCard('${charName}', '${sceneNumber}')">Open Card</button>
      </div>
    `;
  }).join('');

  return `<div class="scene-cast-grid">${cards}</div>`;
}

function getSceneFlags(sceneNumber) {
  const index = continuityState.scenes.findIndex(s => (s.sceneNumber || String(continuityState.scenes.indexOf(s) + 1)) === sceneNumber);
  if (index === -1) return '';

  const scene = continuityState.scenes[index];
  const heading = scene.sceneHeading || '';

  const flags = [];
  if (/flashback/i.test(heading)) flags.push('FLASHBACK');
  if (/dream/i.test(heading)) flags.push('DREAM');
  if (/montage/i.test(heading)) flags.push('MONTAGE');

  return flags.join(', ');
}

function getContinuityAlerts(characterName, sceneNumber) {
  const alerts = [];
  const events = continuityState.continuityEvents[characterName] || [];

  events.forEach(event => {
    const sceneIdx = parseInt(sceneNumber);
    if (event.startScene === sceneIdx) {
      alerts.push(`${event.description || event.type} starts`);
    }

    // Check for stage in this scene
    const stage = event.progression?.find(p => p.sceneIndex === sceneIdx);
    if (stage) {
      alerts.push(`${event.type}: ${stage.stage}`);
    }
  });

  return alerts;
}

export function markSceneComplete(sceneNumber) {
  // Mark all characters in this scene as having their photos captured
  const sceneData = continuityState.continuityData.sceneIndex[sceneNumber] || {};
  const characters = sceneData.characters || [];

  characters.forEach(charName => {
    const look = getLookForCharacterInScene(charName, sceneNumber);
    if (look && continuityState.continuityData.characters[charName]?.looks[look.lookId]) {
      if (!continuityState.continuityData.characters[charName].looks[look.lookId].sceneRecords[sceneNumber]) {
        continuityState.continuityData.characters[charName].looks[look.lookId].sceneRecords[sceneNumber] = {};
      }
      continuityState.continuityData.characters[charName].looks[look.lookId].sceneRecords[sceneNumber].status = 'complete';
    }
  });

  saveData();
  showNotification(`Scene ${sceneNumber} marked as complete`, 'success');
  renderTodayView();
}

// ============================================
// BY CHARACTER VIEW
// ============================================

export function renderCharacterView() {
  const container = document.getElementById('character-continuity-view');
  if (!container) return;

  const characterSelect = document.getElementById('character-select');
  const selectedChar = characterSelect?.value;

  if (!selectedChar) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Select a character to view their continuity records.</p>
      </div>
    `;
    return;
  }

  loadCharacterContinuity(selectedChar);
}

export function loadCharacterContinuity(characterName) {
  const container = document.getElementById('character-continuity-view');
  if (!container || !characterName) return;

  const character = continuityState.continuityData.characters[characterName];
  if (!character) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No continuity data found for ${characterName}.</p>
      </div>
    `;
    return;
  }

  const castEntry = getCastForCharacter(characterName);
  const looks = Object.values(character.looks);

  // Calculate stats
  let totalScenes = 0;
  let capturedScenes = 0;
  looks.forEach(look => {
    totalScenes += look.scenes.length;
    look.scenes.forEach(sceneNum => {
      if (look.sceneRecords[sceneNum]?.status === 'complete') {
        capturedScenes++;
      }
    });
  });

  let html = `
    <div class="character-header">
      <div class="character-info">
        <h2>${characterName}</h2>
        <span class="actor-name">${character.actorName || castEntry?.actorName || ''}</span>
      </div>
      <div class="character-stats">
        <span>${looks.length} Looks</span>
        <span>${totalScenes} Scenes</span>
        <span>${capturedScenes} Captured</span>
      </div>
    </div>
  `;

  // Render each look
  looks.forEach(look => {
    html += renderLookSection(characterName, look);
  });

  // Continuity events
  const events = character.continuityEvents || [];
  if (events.length > 0) {
    html += `
      <div class="continuity-events">
        <div class="events-label">CONTINUITY EVENTS</div>
        ${events.map(event => `
          <div class="event-item">
            <span class="event-name">${event.description || event.type}</span>
            <div class="event-progression">
              ${(event.progression || []).map(stage => `
                <span class="event-stage" data-scene="${stage.sceneIndex}">Sc ${stage.sceneIndex}: ${stage.stage.toUpperCase()}</span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderLookSection(characterName, look) {
  const character = continuityState.continuityData.characters[characterName];
  const castEntry = getCastForCharacter(characterName);

  // Get test reference
  const testRef = look.testReference;

  // Get master
  const master = look.master;

  // Get products
  const products = look.products || castEntry?.lookDesigns?.[look.lookId]?.products || {};

  // Scene thumbnails
  const sceneThumbnails = look.scenes.map(sceneNum => {
    const record = look.sceneRecords[sceneNum];
    const shootDay = getShootDayForScene(sceneNum);
    const isMaster = master?.sceneNumber === sceneNum;

    if (record?.status === 'complete' && record.collage) {
      return `
        <div class="scene-thumb complete" data-scene="${sceneNum}" onclick="openContinuityCard('${characterName}', '${sceneNum}')">
          <img src="${record.collage}" alt="Sc ${sceneNum}">
          <div class="thumb-info">
            <span class="scene-num">Sc ${sceneNum}</span>
            <span class="shoot-day">Day ${shootDay || '?'}</span>
          </div>
          ${isMaster ? '<div class="thumb-status master">MASTER</div>' : ''}
        </div>
      `;
    } else {
      // Get alerts for this scene
      const alerts = getContinuityAlerts(characterName, sceneNum);
      const alertHtml = alerts.length > 0 ? `<div class="thumb-alert">${alerts[0]}</div>` : '';

      return `
        <div class="scene-thumb pending" data-scene="${sceneNum}" onclick="openContinuityCard('${characterName}', '${sceneNum}')">
          <div class="pending-placeholder">
            <span>Sc ${sceneNum}</span>
            <span class="shoot-day">Day ${shootDay || '?'}</span>
          </div>
          ${alertHtml}
        </div>
      `;
    }
  }).join('');

  // Products display
  const productsHtml = Object.entries(products).map(([category, items]) => {
    if (!items || (Array.isArray(items) && items.length === 0)) return '';
    const itemsStr = Array.isArray(items) ? items.join(', ') : items;
    return `<span class="product-category">${category.charAt(0).toUpperCase() + category.slice(1)}:</span> ${itemsStr}`;
  }).filter(Boolean).join(' ');

  return `
    <div class="look-section" data-look-id="${look.lookId}">
      <div class="look-header">
        <h3>LOOK ${look.lookId.replace('look-', '').toUpperCase()}: ${look.lookName.toUpperCase()}</h3>
        <span class="scene-range">Scenes ${look.scenes.join(', ')}</span>
      </div>

      <div class="look-references">
        <div class="reference-block test-reference">
          <div class="reference-label">TEST REFERENCE</div>
          <div class="reference-collage">
            ${testRef?.front
              ? `<img src="${testRef.front}" alt="Test reference">`
              : '<div class="placeholder-collage">No test reference</div>'
            }
          </div>
          <div class="reference-meta">
            <span>Camera Test</span>
            ${testRef?.front ? `<button class="view-details-btn" onclick="viewTestReference('${characterName}', '${look.lookId}')">View Details</button>` : ''}
          </div>
        </div>

        <div class="reference-block master-reference">
          <div class="reference-label">MASTER</div>
          <div class="reference-collage">
            ${master?.collage
              ? `<img src="${master.collage}" alt="Master">`
              : '<div class="placeholder-collage">Not yet captured</div>'
            }
          </div>
          <div class="reference-meta">
            ${master ? `<span>Scene ${master.sceneNumber} · Day ${getShootDayForScene(master.sceneNumber) || '?'}</span>` : '<span>First capture will become master</span>'}
            ${master?.varianceFromTest ? `<span class="variance-note">${master.varianceFromTest}</span>` : ''}
          </div>
        </div>
      </div>

      ${productsHtml ? `
        <div class="look-products">
          <div class="products-label">Products:</div>
          <div class="products-list">${productsHtml}</div>
        </div>
      ` : ''}

      <div class="scene-continuity-strip">
        <div class="strip-label">SCENE CONTINUITY</div>
        <div class="scene-thumbnails">
          ${sceneThumbnails}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// BY SCENE VIEW
// ============================================

export function renderSceneView() {
  const container = document.getElementById('scene-continuity-view');
  if (!container) return;

  const sceneSelect = document.getElementById('scene-select');
  const selectedScene = sceneSelect?.value;

  if (!selectedScene) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Select a scene to view continuity for all characters.</p>
      </div>
    `;
    return;
  }

  loadSceneContinuity(selectedScene);
}

export function loadSceneContinuity(sceneNumber) {
  const container = document.getElementById('scene-continuity-view');
  const infoDisplay = document.getElementById('scene-info-display');
  if (!container || !sceneNumber) return;

  const sceneData = continuityState.continuityData.sceneIndex[sceneNumber];
  if (!sceneData) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Scene ${sceneNumber} not found.</p>
      </div>
    `;
    return;
  }

  // Update info display
  if (infoDisplay) {
    infoDisplay.textContent = `Day ${sceneData.shootDay || '?'} · ${sceneData.characters.length} characters`;
  }

  const characters = sceneData.characters || [];
  const shootDay = sceneData.shootDay;
  const status = getSceneStatus(sceneNumber, shootDay);

  let html = `
    <div class="scene-header">
      <div class="scene-info">
        <h2>SC ${sceneNumber} · ${sceneData.sceneHeading}</h2>
        <span class="story-day">${sceneData.storyDay ? `Story Day ${sceneData.storyDay}` : ''}</span>
      </div>
      <div class="scene-shoot-info">
        <span>Shoot Day ${shootDay || '?'}</span>
        <span class="scene-status ${status}">${status.toUpperCase()}</span>
      </div>
    </div>
    <div class="scene-cast-continuity">
  `;

  characters.forEach(charName => {
    const look = getLookForCharacterInScene(charName, sceneNumber);
    const character = continuityState.continuityData.characters[charName];
    const record = look && character ? character.looks[look.lookId]?.sceneRecords[sceneNumber] : null;
    const castEntry = getCastForCharacter(charName);

    // Find previous scene with same look for reference
    let referenceScene = null;
    let referenceCollage = null;
    if (look && character) {
      const lookData = character.looks[look.lookId];
      const currentIdx = lookData.scenes.indexOf(sceneNumber);
      for (let i = currentIdx - 1; i >= 0; i--) {
        const prevScene = lookData.scenes[i];
        const prevRecord = lookData.sceneRecords[prevScene];
        if (prevRecord?.status === 'complete' && prevRecord.collage) {
          referenceScene = prevScene;
          referenceCollage = prevRecord.collage;
          break;
        }
      }
      // Fall back to master
      if (!referenceCollage && lookData.master?.collage) {
        referenceScene = lookData.master.sceneNumber;
        referenceCollage = lookData.master.collage;
      }
    }

    // Get alerts
    const alerts = getContinuityAlerts(charName, sceneNumber);
    const alertsHtml = alerts.length > 0
      ? `<div class="card-alerts"><span class="alert">${alerts.join(', ')}</span></div>`
      : '';

    html += `
      <div class="cast-full-card" data-character="${charName}">
        <div class="card-header">
          <span class="character-name">${charName}</span>
          <span class="actor-name">${character?.actorName || castEntry?.actorName || ''}</span>
          <span class="look-name">Look: ${look?.lookName || 'Default'}</span>
        </div>
        <div class="card-photos">
          <div class="reference-side">
            <div class="ref-label">REFERENCE ${referenceScene ? `(Sc ${referenceScene})` : ''}</div>
            <div class="ref-collage">
              ${referenceCollage
                ? `<img src="${referenceCollage}" alt="Reference">`
                : '<div class="placeholder-collage">No reference</div>'
              }
            </div>
          </div>
          <div class="capture-side">
            <div class="capture-label">THIS SCENE</div>
            <div class="capture-collage" onclick="openContinuityCard('${charName}', '${sceneNumber}')">
              ${record?.collage
                ? `<img src="${record.collage}" alt="This scene">`
                : '<div class="placeholder-collage">Click to capture</div>'
              }
            </div>
          </div>
        </div>
        ${alertsHtml}
        <button class="open-full-card-btn" onclick="openContinuityCard('${charName}', '${sceneNumber}')">Open Full Card</button>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ============================================
// LOOKBOOK VIEW
// ============================================

export function renderLookbookView() {
  const container = document.getElementById('lookbook-preview');
  if (!container) return;

  const characterFilter = document.getElementById('lookbook-character-filter')?.value || 'all';
  const lookFilter = document.getElementById('lookbook-look-filter')?.value || 'all';

  let charactersToRender = continuityState.confirmedCharacters;

  if (characterFilter !== 'all') {
    charactersToRender = charactersToRender.filter(c => c === characterFilter);
  }

  if (charactersToRender.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No characters to display in the lookbook.</p>
      </div>
    `;
    return;
  }

  let html = '';

  charactersToRender.forEach(charName => {
    html += renderLookbookPage(charName, lookFilter);
  });

  container.innerHTML = html;
}

function renderLookbookPage(characterName, lookFilter = 'all') {
  const character = continuityState.continuityData.characters[characterName];
  if (!character) return '';

  const castEntry = getCastForCharacter(characterName);
  let looks = Object.values(character.looks);

  if (lookFilter !== 'all') {
    looks = looks.filter(l => l.lookId === lookFilter);
  }

  if (looks.length === 0) return '';

  // Render look sections
  const lookSectionsHtml = looks.map(look => {
    const master = look.master;
    const products = look.products || castEntry?.lookDesigns?.[look.lookId]?.products || {};

    // Scene strip thumbnails
    const thumbnails = look.scenes.slice(0, 10).map(sceneNum => {
      const record = look.sceneRecords[sceneNum];
      return `
        <div class="strip-thumb">
          ${record?.collage
            ? `<img src="${record.collage}" alt="Sc ${sceneNum}">`
            : '<div style="width:50px;height:50px;background:#eee;border-radius:4px;"></div>'
          }
          <span>Sc ${sceneNum}</span>
        </div>
      `;
    }).join('');

    // Products text
    const productsText = Object.entries(products).map(([cat, items]) => {
      if (!items || (Array.isArray(items) && items.length === 0)) return '';
      return `${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${Array.isArray(items) ? items.join(', ') : items}`;
    }).filter(Boolean).join('<br>');

    // Get variance/notes from master
    const notes = master?.varianceFromTest || master?.notes || '';

    return `
      <div class="lookbook-look-section">
        <div class="look-title-bar">
          <h2>LOOK ${look.lookId.replace('look-', '').toUpperCase()}: ${look.lookName.toUpperCase()}</h2>
          <span>Scenes ${look.scenes.join(', ')}</span>
        </div>

        <div class="look-content">
          <div class="master-display">
            <div class="master-collage">
              ${master?.collage
                ? `<img src="${master.collage}" alt="Master">`
                : '<div style="width:100%;height:100%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">No master</div>'
              }
            </div>
            <div class="master-label">MASTER ${master ? `(Scene ${master.sceneNumber})` : ''}</div>
          </div>

          <div class="look-details">
            <div class="detail-section">
              <h4>Hair</h4>
              <p>${products.hair ? (Array.isArray(products.hair) ? products.hair.join(', ') : products.hair) : 'Not specified'}</p>
            </div>
            <div class="detail-section">
              <h4>Makeup</h4>
              <p>${[products.face, products.eyes, products.lips].filter(Boolean).map(p => Array.isArray(p) ? p.join(', ') : p).join('. ') || 'Not specified'}</p>
            </div>
            <div class="detail-section">
              <h4>Products</h4>
              <p class="products-text">${productsText || 'Not specified'}</p>
            </div>
          </div>
        </div>

        <div class="scene-strip">
          <div class="strip-title">Scene Continuity</div>
          <div class="strip-thumbnails">
            ${thumbnails}
          </div>
        </div>

        ${notes ? `
          <div class="look-notes">
            <h4>Notes & Variances</h4>
            <p>${notes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Continuity events
  const events = character.continuityEvents || [];
  const eventsHtml = events.length > 0 ? `
    <div class="lookbook-events-section">
      <h3>Continuity Events</h3>
      ${events.map(event => `
        <div class="event-entry">
          <span class="event-name">${event.description || event.type}</span>
          <div class="event-timeline">
            ${(event.progression || []).map(stage => `Sc ${stage.sceneIndex}: ${stage.stage.toUpperCase()}`).join(' → ')}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="lookbook-page" data-character="${characterName}">
      <div class="page-header">
        <div class="project-info">
          <span class="project-title">${continuityState.projectName.toUpperCase()}</span>
          <span class="department">Hair & Makeup Continuity</span>
        </div>
        <div class="character-info">
          <h1>${characterName}</h1>
          <span class="actor">${character.actorName || castEntry?.actorName || ''}</span>
        </div>
      </div>

      ${lookSectionsHtml}
      ${eventsHtml}

      <div class="page-footer">
        <span>Generated by Hair & Makeup Pro</span>
        <span class="page-number"></span>
      </div>
    </div>
  `;
}

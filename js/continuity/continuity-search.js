/**
 * Live Continuity - Search Module
 * Handles search functionality across scenes and characters
 */

import { continuityState, switchTab, getInitials } from './continuity-main.js';

// Search state
let searchState = {
  query: '',
  filter: 'all', // all, scenes, characters
  recentSearches: []
};

// ============================================
// OPEN/CLOSE SEARCH MODAL
// ============================================

export function openSearchModal() {
  const modal = document.getElementById('search-modal');
  if (!modal) return;

  // Load recent searches
  loadRecentSearches();

  // Clear previous search
  const input = document.getElementById('search-input');
  if (input) {
    input.value = '';
    input.focus();
  }

  // Clear results
  document.getElementById('search-results').innerHTML = '';

  // Show recent searches
  showRecentSearches();

  modal.style.display = 'flex';
}

export function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

export function performSearch(query) {
  searchState.query = query;

  if (!query || query.length < 1) {
    showRecentSearches();
    return;
  }

  const results = [];
  const queryLower = query.toLowerCase().trim();

  // Search for scenes
  if (searchState.filter === 'all' || searchState.filter === 'scenes') {
    // Match scene numbers
    const sceneMatch = queryLower.match(/^(?:sc(?:ene)?\.?\s*)?(\d+)$/i);
    if (sceneMatch) {
      const sceneNum = sceneMatch[1];
      const sceneData = continuityState.continuityData.sceneIndex[sceneNum];
      if (sceneData) {
        results.push({
          type: 'scene',
          sceneNumber: sceneNum,
          sceneHeading: sceneData.sceneHeading,
          location: sceneData.location,
          characters: sceneData.characters || []
        });
      }
    }

    // Search scene headings
    for (const [sceneNum, sceneData] of Object.entries(continuityState.continuityData.sceneIndex)) {
      if (sceneData.sceneHeading?.toLowerCase().includes(queryLower) ||
          sceneData.location?.toLowerCase().includes(queryLower)) {
        // Avoid duplicates
        if (!results.find(r => r.type === 'scene' && r.sceneNumber === sceneNum)) {
          results.push({
            type: 'scene',
            sceneNumber: sceneNum,
            sceneHeading: sceneData.sceneHeading,
            location: sceneData.location,
            characters: sceneData.characters || []
          });
        }
      }
    }
  }

  // Search for characters
  if (searchState.filter === 'all' || searchState.filter === 'characters') {
    for (const [charName, charData] of Object.entries(continuityState.continuityData.characters)) {
      if (charName.toLowerCase().includes(queryLower) ||
          charData.actorName?.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'character',
          characterName: charName,
          actorName: charData.actorName || '',
          lookCount: Object.keys(charData.looks || {}).length,
          sceneCount: getTotalSceneCount(charData)
        });
      }
    }
  }

  renderSearchResults(results);

  // Save to recent searches if not empty
  if (results.length > 0) {
    saveRecentSearch(query);
  }
}

function getTotalSceneCount(charData) {
  let count = 0;
  for (const look of Object.values(charData.looks || {})) {
    count += (look.scenes || []).length;
  }
  return count;
}

// ============================================
// SEARCH FILTER
// ============================================

export function setSearchFilter(filter) {
  searchState.filter = filter;

  // Update UI
  document.querySelectorAll('.search-filters .filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });

  // Re-run search if there's a query
  if (searchState.query) {
    performSearch(searchState.query);
  }
}

// ============================================
// RENDER RESULTS
// ============================================

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  if (!container) return;

  // Hide recent searches when showing results
  const recentContainer = document.getElementById('recent-searches');
  if (recentContainer) {
    recentContainer.style.display = results.length > 0 ? 'none' : 'block';
  }

  if (results.length === 0) {
    container.innerHTML = '<div class="no-results">No results found</div>';
    return;
  }

  // Limit to 20 results
  const limitedResults = results.slice(0, 20);

  container.innerHTML = limitedResults.map(result => {
    if (result.type === 'scene') {
      const charSummary = result.characters.slice(0, 3).join(', ');
      const moreChars = result.characters.length > 3 ? ` +${result.characters.length - 3} more` : '';

      return `
        <div class="search-result scene-result" onclick="handleSearchResult('scene', '${result.sceneNumber}')">
          <div class="result-icon">SC</div>
          <div class="result-info">
            <span class="result-title">Scene ${result.sceneNumber}</span>
            <span class="result-subtitle">${result.location || result.sceneHeading} · ${charSummary}${moreChars}</span>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="search-result character-result" onclick="handleSearchResult('character', '${result.characterName}')">
          <div class="result-icon">${getInitials(result.characterName)}</div>
          <div class="result-info">
            <span class="result-title">${result.characterName}</span>
            <span class="result-subtitle">${result.actorName || ''} · ${result.lookCount} looks · ${result.sceneCount} scenes</span>
          </div>
        </div>
      `;
    }
  }).join('');
}

// ============================================
// HANDLE RESULT SELECTION
// ============================================

window.handleSearchResult = function(type, value) {
  closeSearchModal();

  if (type === 'scene') {
    // Switch to By Scene tab and load the scene
    switchTab('scene');
    const sceneSelect = document.getElementById('scene-select');
    if (sceneSelect) {
      sceneSelect.value = value;
      import('./continuity-views.js').then(module => {
        module.loadSceneContinuity(value);
      });
    }
  } else if (type === 'character') {
    // Switch to By Character tab and load the character
    switchTab('character');
    const charSelect = document.getElementById('character-select');
    if (charSelect) {
      charSelect.value = value;
      import('./continuity-views.js').then(module => {
        module.loadCharacterContinuity(value);
      });
    }
  }
};

// ============================================
// RECENT SEARCHES
// ============================================

function loadRecentSearches() {
  try {
    const stored = localStorage.getItem('continuity-recent-searches');
    searchState.recentSearches = stored ? JSON.parse(stored) : [];
  } catch (e) {
    searchState.recentSearches = [];
  }
}

function saveRecentSearch(query) {
  // Don't save if already exists
  if (searchState.recentSearches.includes(query)) {
    // Move to front
    searchState.recentSearches = searchState.recentSearches.filter(s => s !== query);
  }

  // Add to front
  searchState.recentSearches.unshift(query);

  // Keep only last 10
  searchState.recentSearches = searchState.recentSearches.slice(0, 10);

  // Save to localStorage
  try {
    localStorage.setItem('continuity-recent-searches', JSON.stringify(searchState.recentSearches));
  } catch (e) {
    console.error('Failed to save recent searches:', e);
  }
}

function showRecentSearches() {
  const container = document.getElementById('recent-search-items');
  const recentContainer = document.getElementById('recent-searches');

  if (!container || !recentContainer) return;

  recentContainer.style.display = 'block';

  if (searchState.recentSearches.length === 0) {
    container.innerHTML = '<span class="no-recent">No recent searches</span>';
    return;
  }

  container.innerHTML = searchState.recentSearches.map(query => `
    <button class="recent-item" onclick="performSearch('${escapeHtml(query)}'); document.getElementById('search-input').value = '${escapeHtml(query)}';">
      ${escapeHtml(query)}
    </button>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/'/g, "\\'");
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('search-modal');
  if (!modal || modal.style.display === 'none') return;

  // Enter to select first result
  if (e.key === 'Enter') {
    const firstResult = document.querySelector('.search-result');
    if (firstResult) {
      firstResult.click();
    }
  }
});

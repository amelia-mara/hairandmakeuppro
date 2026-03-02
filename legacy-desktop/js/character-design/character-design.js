/**
 * Character Design Page - Main Logic
 * Hair & Makeup Pro
 */

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════

let breakdownState = null;
window.currentCharacter = null;
window.currentCastEntry = null;

// ═══════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════

function loadProjectData() {
    try {
        const projectStr = localStorage.getItem('currentProject');
        if (projectStr) {
            const project = JSON.parse(projectStr);
            breakdownState = {
                projectName: project.projectName || project.name || 'Untitled Project',
                scenes: project.scenes || [],
                sceneBreakdowns: project.sceneBreakdowns || {},
                confirmedCharacters: project.confirmedCharacters || [],
                characters: project.castProfiles || {},
                characterStates: project.characterStates || {},
                continuityEvents: project.continuityEvents || {},
                scriptTags: project.scriptTags || {},
                cast: project.cast || {},
                lastSaved: project.lastSaved || null
            };

            // Update project name display if element exists
            const projectNameEl = document.getElementById('project-name');
            if (projectNameEl) {
                projectNameEl.textContent = breakdownState.projectName;
            }

            console.log('Loaded project data:', breakdownState.projectName);
        }

        // Fallback to masterContext if no direct project data
        if (!breakdownState || breakdownState.confirmedCharacters.length === 0) {
            const masterContextStr = localStorage.getItem('masterContext');
            if (masterContextStr) {
                const masterContext = JSON.parse(masterContextStr);
                if (!breakdownState) {
                    breakdownState = {
                        projectName: 'Untitled Project',
                        scenes: [],
                        sceneBreakdowns: {},
                        confirmedCharacters: [],
                        characters: {},
                        characterStates: {},
                        continuityEvents: {},
                        scriptTags: {},
                        cast: {},
                        lastSaved: null
                    };
                }

                if (masterContext.scenes) {
                    breakdownState.scenes = masterContext.scenes;
                }

                if (masterContext.characters) {
                    breakdownState.confirmedCharacters = Object.keys(masterContext.characters);
                    Object.entries(masterContext.characters).forEach(([name, data]) => {
                        breakdownState.characters[name] = {
                            ...breakdownState.characters[name],
                            ...data
                        };
                    });
                }

                if (masterContext.sceneBreakdowns) {
                    breakdownState.sceneBreakdowns = masterContext.sceneBreakdowns;
                }

                if (masterContext.characterStates) {
                    breakdownState.characterStates = masterContext.characterStates;
                }

                console.log('Loaded from masterContext');
            }
        }

        // Initialize cast data structure if not exists
        if (breakdownState && !breakdownState.cast) {
            breakdownState.cast = {};
        }

    } catch (error) {
        console.error('Error loading project data:', error);
        breakdownState = {
            projectName: 'Untitled Project',
            scenes: [],
            sceneBreakdowns: {},
            confirmedCharacters: [],
            characters: {},
            characterStates: {},
            continuityEvents: {},
            scriptTags: {},
            cast: {},
            lastSaved: null
        };
    }
}

function saveProject() {
    try {
        const projectStr = localStorage.getItem('currentProject');
        if (projectStr) {
            const project = JSON.parse(projectStr);
            project.cast = breakdownState.cast;
            project.lastSaved = new Date().toISOString();
            localStorage.setItem('currentProject', JSON.stringify(project));
            console.log('Project saved');
        }
    } catch (error) {
        console.error('Error saving project:', error);
    }
}

// ═══════════════════════════════════════════════════════════════
// CAST DATA MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function initCastData() {
    if (!breakdownState.cast) {
        breakdownState.cast = {};
    }
}

function getCastForCharacter(characterName) {
    const cast = breakdownState?.cast || {};
    return Object.values(cast).find(c => c.characterName === characterName);
}

function createCastEntry(characterName) {
    const id = `cast-${Date.now()}`;
    const character = breakdownState?.characters?.[characterName] || {};

    const castEntry = {
        id: id,
        characterId: characterName,
        characterName: characterName,

        // Actor info
        actorName: '',
        headshot: null,
        agency: '',
        contactEmail: '',
        contactPhone: '',

        // Physical/medical
        skinType: '',
        skinTone: '',
        allergies: '',
        sensitivities: '',
        notes: '',

        // Measurements
        measurements: {
            headCircumference: '',
            faceWidth: '',
            foreheadToChin: '',
            templeToTemple: ''
        },

        // Design data (per look)
        lookDesigns: {},

        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    breakdownState.cast[id] = castEntry;
    saveProject();

    return castEntry;
}

function updateCastEntry(castId, field, value) {
    if (!breakdownState?.cast?.[castId]) return;

    // Handle nested fields (e.g., 'measurements.headCircumference')
    if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (!breakdownState.cast[castId][parent]) {
            breakdownState.cast[castId][parent] = {};
        }
        breakdownState.cast[castId][parent][child] = value;
    } else {
        breakdownState.cast[castId][field] = value;
    }

    breakdownState.cast[castId].updatedAt = new Date().toISOString();
    saveProject();
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW PAGE - CHARACTER GRID
// ═══════════════════════════════════════════════════════════════

function renderCharacterDesignOverview() {
    const characters = breakdownState?.confirmedCharacters || [];
    const characterData = breakdownState?.characters || {};
    const cast = breakdownState?.cast || {};

    const container = document.getElementById('character-grid');
    if (!container) return;

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Characters Found</h3>
                <p>Import a script and complete the breakdown first.</p>
                <a href="script-breakdown.html" class="btn-primary">Go to Script Breakdown</a>
            </div>
        `;
        return;
    }

    // Sort by role priority
    const sortedCharacters = sortCharactersByRole(characters, characterData);

    container.innerHTML = sortedCharacters.map(charName => {
        const charInfo = characterData[charName] || {};
        const castEntry = getCastForCharacter(charName);
        const looks = generateLooksFromBreakdown(charName);
        const progress = calculateDesignProgress(charName, castEntry);

        return renderCharacterCard(charName, charInfo, castEntry, looks, progress);
    }).join('');
}

function renderCharacterCard(characterName, charInfo, castEntry, looks, progress) {
    const isCast = castEntry && castEntry.actorName;
    const actorName = isCast ? castEntry.actorName : 'Not yet cast';
    const headshot = castEntry?.headshot || null;
    const role = charInfo.role || charInfo.category || 'Unknown';
    const sceneCount = getSceneCountForCharacter(characterName);
    const lookCount = looks.length;

    return `
        <div class="character-card ${isCast ? 'cast' : 'not-cast'}" data-character="${characterName}">

            <div class="card-photo-area">
                ${headshot ? `
                    <img src="${headshot}" alt="${actorName}" class="card-headshot">
                ` : `
                    <div class="card-photo-placeholder" onclick="openCastAttachment('${encodeURIComponent(characterName)}')">
                        <span class="placeholder-icon">+</span>
                        <span class="placeholder-text">${isCast ? 'Add Photo' : 'Attach Cast'}</span>
                    </div>
                `}
            </div>

            <div class="card-info">
                <h3 class="character-name">${characterName}</h3>
                <p class="actor-name ${isCast ? '' : 'not-cast'}">${actorName}</p>
                <p class="character-meta">${role} | ${sceneCount} Scenes | ${lookCount} Looks</p>

                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <span class="progress-label">${progress}% Complete</span>
            </div>

            <div class="card-actions">
                <a href="character-design-detail.html?character=${encodeURIComponent(characterName)}" class="btn-open-design">
                    Open Design
                </a>
            </div>

        </div>
    `;
}

function getSceneCountForCharacter(characterName) {
    const scenes = breakdownState?.scenes || [];
    const breakdowns = breakdownState?.sceneBreakdowns || {};
    let count = 0;

    scenes.forEach((scene, index) => {
        const breakdown = breakdowns[index];
        if (breakdown?.characters?.includes(characterName)) {
            count++;
        }
    });

    // Fallback: check characterStates
    if (count === 0) {
        const charStates = breakdownState?.characterStates || {};
        Object.values(charStates).forEach(sceneStates => {
            if (sceneStates[characterName]) {
                count++;
            }
        });
    }

    return count;
}

function generateLooksFromBreakdown(characterName) {
    const looks = [];
    const charData = breakdownState?.characters?.[characterName] || {};
    const charStates = breakdownState?.characterStates || {};

    // Check for defined looks in character data
    if (charData.looks && Array.isArray(charData.looks)) {
        return charData.looks.map((look, idx) => ({
            id: `look-${idx}`,
            name: look.name || `Look ${String.fromCharCode(65 + idx)}`,
            hair: look.hair || '',
            makeup: look.makeup || '',
            notes: look.notes || '',
            scenes: look.scenes || []
        }));
    }

    // Generate from character states if no defined looks
    const uniqueStates = new Map();

    Object.entries(charStates).forEach(([sceneIdx, characters]) => {
        const state = characters[characterName];
        if (state) {
            const key = `${state.hair || ''}-${state.makeup || ''}`;
            if (!uniqueStates.has(key)) {
                uniqueStates.set(key, {
                    hair: state.hair || '',
                    makeup: state.makeup || '',
                    notes: state.notes || '',
                    scenes: [parseInt(sceneIdx)]
                });
            } else {
                uniqueStates.get(key).scenes.push(parseInt(sceneIdx));
            }
        }
    });

    let lookIndex = 0;
    uniqueStates.forEach((state, key) => {
        if (state.hair || state.makeup) {
            looks.push({
                id: `look-${lookIndex}`,
                name: `Look ${String.fromCharCode(65 + lookIndex)}`,
                ...state
            });
            lookIndex++;
        }
    });

    // If no looks found, create a default one
    if (looks.length === 0) {
        looks.push({
            id: 'look-0',
            name: 'Default Look',
            hair: charData.hair || 'Not specified',
            makeup: charData.makeup || 'Not specified',
            notes: '',
            scenes: []
        });
    }

    return looks;
}

function calculateDesignProgress(characterName, castEntry) {
    let progress = 0;
    let total = 100;

    // Has cast attached? (20%)
    if (castEntry?.actorName) progress += 20;

    // Has headshot? (10%)
    if (castEntry?.headshot) progress += 10;

    // Has basic info filled? (20%)
    if (castEntry) {
        let infoScore = 0;
        if (castEntry.skinType) infoScore += 5;
        if (castEntry.skinTone) infoScore += 5;
        if (castEntry.allergies !== undefined && castEntry.allergies !== '') infoScore += 5;
        if (castEntry.notes) infoScore += 5;
        progress += infoScore;
    }

    // Look designs progress (50%)
    const looks = generateLooksFromBreakdown(characterName);
    if (looks.length > 0) {
        const perLook = 50 / looks.length;
        looks.forEach(look => {
            const design = castEntry?.lookDesigns?.[look.id];
            if (design) {
                // Has moodboard content?
                if (design.moodboard?.elements?.length > 0) progress += perLook * 0.5;
                // Has products defined?
                if (design.products && Object.keys(design.products).length > 0) progress += perLook * 0.3;
                // Marked complete?
                if (design.status === 'complete') progress += perLook * 0.2;
            }
        });
    }

    return Math.round(Math.min(progress, 100));
}

function sortCharactersByRole(characters, characterData) {
    const roleOrder = { 'Lead': 0, 'Supporting': 1, 'Featured': 2, 'Day Player': 3, 'Extra': 4 };

    return [...characters].sort((a, b) => {
        const aRole = characterData[a]?.role || characterData[a]?.category || 'Extra';
        const bRole = characterData[b]?.role || characterData[b]?.category || 'Extra';
        const aOrder = roleOrder[aRole] ?? 4;
        const bOrder = roleOrder[bRole] ?? 4;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
    });
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW PAGE - FILTER & SEARCH
// ═══════════════════════════════════════════════════════════════

function filterCharacters(filter, buttonEl) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (buttonEl) {
        buttonEl.classList.add('active');
    }

    const cards = document.querySelectorAll('.character-card');

    cards.forEach(card => {
        const isCast = card.classList.contains('cast');
        const role = card.querySelector('.character-meta')?.textContent || '';

        let show = true;

        switch(filter) {
            case 'cast':
                show = isCast;
                break;
            case 'not-cast':
                show = !isCast;
                break;
            case 'leads':
                show = role.toLowerCase().includes('lead');
                break;
            case 'all':
            default:
                show = true;
        }

        card.style.display = show ? '' : 'none';
    });
}

function searchCharacters(query) {
    const cards = document.querySelectorAll('.character-card');
    const searchTerm = query.toLowerCase().trim();

    cards.forEach(card => {
        const characterName = card.dataset.character?.toLowerCase() || '';
        const actorName = card.querySelector('.actor-name')?.textContent?.toLowerCase() || '';

        const matches = !searchTerm ||
                        characterName.includes(searchTerm) ||
                        actorName.includes(searchTerm);

        card.style.display = matches ? '' : 'none';
    });
}

function openCastAttachment(characterName) {
    // Navigate to detail page
    window.location.href = `character-design-detail.html?character=${characterName}`;
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW PAGE - FOOTER STATS
// ═══════════════════════════════════════════════════════════════

function updateFooterStats() {
    const footer = document.getElementById('page-footer');
    if (!footer) return;

    const characters = breakdownState?.confirmedCharacters || [];
    const cast = breakdownState?.cast || {};

    let castCount = 0;
    let designsComplete = 0;

    characters.forEach(charName => {
        const castEntry = getCastForCharacter(charName);
        if (castEntry?.actorName) castCount++;

        const progress = calculateDesignProgress(charName, castEntry);
        if (progress >= 80) designsComplete++;
    });

    const notCastCount = characters.length - castCount;

    footer.textContent = `${characters.length} characters | ${castCount} cast | ${notCastCount} not cast | ${designsComplete} designs complete`;
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PAGE - INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function initCharacterDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const characterName = urlParams.get('character');

    if (!characterName) {
        window.location.href = 'character-design.html';
        return;
    }

    window.currentCharacter = decodeURIComponent(characterName);

    // Get or create cast entry
    let castEntry = getCastForCharacter(window.currentCharacter);
    if (!castEntry) {
        castEntry = createCastEntry(window.currentCharacter);
    }
    window.currentCastEntry = castEntry;

    // Render header
    renderDetailHeader(window.currentCharacter, castEntry);

    // Default to Cast Info tab
    switchTab('cast-info');
}

function renderDetailHeader(characterName, castEntry) {
    const characterData = breakdownState?.characters?.[characterName] || {};
    const actorName = castEntry?.actorName || 'Not yet cast';
    const role = characterData.role || characterData.category || 'Unknown';
    const sceneCount = getSceneCountForCharacter(characterName);

    const header = document.getElementById('detail-header');
    if (!header) return;

    header.innerHTML = `
        <div class="header-left">
            <nav class="breadcrumb-nav">
                <a href="dashboard.html">← Dashboard</a>
                <span class="separator">/</span>
                <a href="character-design.html">Characters</a>
            </nav>
            <h1 class="character-title">${characterName}</h1>
            <p class="character-subtitle">${actorName} | ${role} | ${sceneCount} Scenes</p>
        </div>
        <div class="header-right">
            <button class="btn-secondary" onclick="exportCharacterPDF('${encodeURIComponent(characterName)}')">Export PDF</button>
        </div>
    `;
}

function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabId}-tab`);
    });

    // Initialize tab content
    switch(tabId) {
        case 'cast-info':
            if (typeof renderCastInfoTab === 'function') {
                renderCastInfoTab();
            }
            break;
        case 'lookbook':
            if (typeof renderLookbookTab === 'function') {
                renderLookbookTab();
            }
            break;
        case 'moodboard':
            if (typeof initMoodboard === 'function') {
                initMoodboard();
            }
            break;
        case 'ai-generate':
            if (typeof initAIGenerateTab === 'function') {
                initAIGenerateTab();
            }
            break;
    }
}

function exportCharacterPDF(characterName) {
    alert('PDF export coming soon. Character: ' + decodeURIComponent(characterName));
}

// Make functions available globally
window.loadProjectData = loadProjectData;
window.saveProject = saveProject;
window.getCastForCharacter = getCastForCharacter;
window.createCastEntry = createCastEntry;
window.updateCastEntry = updateCastEntry;
window.generateLooksFromBreakdown = generateLooksFromBreakdown;
window.getSceneCountForCharacter = getSceneCountForCharacter;
window.breakdownState = breakdownState;

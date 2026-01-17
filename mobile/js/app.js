/**
 * Hair & Makeup Pro - Mobile PWA
 * Stage 1: Core Structure - Screen Navigation & Routing
 * Stage 2: Script Upload & Analysis
 */

// ============================================
// APPLICATION STATE
// ============================================
const App = {
    // Current screen tracking
    currentScreen: 'screen-home',
    previousScreen: null,
    screenHistory: [],

    // Navigation state
    activeTab: 'scenes',

    // Modal state
    activeModal: null,

    // Project state (Stage 2)
    project: {
        name: 'Untitled Project',
        file: null,
        isDemo: false
    },

    // Script analysis results (Stage 2)
    scenes: [],
    characters: [],
    duplicates: [],

    // LocalStorage keys
    STORAGE_KEYS: {
        PROJECT: 'hmp_project',
        SCENES: 'hmp_scenes',
        CHARACTERS: 'hmp_characters'
    },

    // Initialize the app
    init() {
        this.bindNavigationEvents();
        this.bindSearchToggle();
        this.bindFilterPills();
        this.bindUploadCard();
        this.bindSyncCodeInputs();
        this.bindModalEvents();
        this.bindTimesheetCalculation();
        this.bindCharacterConfirmation();
        this.bindSceneSearch();

        // Check for existing project and route accordingly
        this.checkInitialRoute();

        console.log('Hair & Makeup Pro Mobile initialized');
    },

    // ============================================
    // SCREEN NAVIGATION
    // ============================================

    /**
     * Navigate to a screen by ID
     * @param {string} screenId - The ID of the screen to navigate to
     * @param {object} options - Navigation options
     */
    navigateTo(screenId, options = {}) {
        const { pushHistory = true, data = null } = options;

        // Don't navigate to current screen
        if (screenId === this.currentScreen && !options.force) {
            return;
        }

        // Get screen elements
        const currentScreenEl = document.getElementById(this.currentScreen);
        const nextScreenEl = document.getElementById(screenId);

        if (!nextScreenEl) {
            console.error(`Screen not found: ${screenId}`);
            return;
        }

        // Hide current screen
        if (currentScreenEl) {
            currentScreenEl.classList.remove('active');
        }

        // Show next screen
        nextScreenEl.classList.add('active');

        // Update history
        if (pushHistory && this.currentScreen !== screenId) {
            this.screenHistory.push(this.currentScreen);
        }

        // Update current screen reference
        this.previousScreen = this.currentScreen;
        this.currentScreen = screenId;

        // Update bottom nav active state
        this.updateBottomNavState(screenId);

        // Scroll to top
        const scrollableContent = nextScreenEl.querySelector('.screen-content.scrollable');
        if (scrollableContent) {
            scrollableContent.scrollTop = 0;
        }

        // Handle screen-specific initialization
        this.onScreenEnter(screenId, data);

        console.log(`Navigated to: ${screenId}`);
    },

    /**
     * Go back to the previous screen
     */
    goBack() {
        if (this.screenHistory.length > 0) {
            const previousScreen = this.screenHistory.pop();
            this.navigateTo(previousScreen, { pushHistory: false });
        } else {
            // Default fallback - go to home
            this.navigateTo('screen-home', { pushHistory: false });
        }
    },

    /**
     * Handle screen enter events
     */
    onScreenEnter(screenId, data) {
        switch (screenId) {
            case 'screen-analyzing':
                this.startScriptAnalysis();
                break;
            case 'screen-scene-list':
                this.renderSceneList();
                this.updateSettings();
                // These are main tab screens - clear history to home
                this.screenHistory = ['screen-home'];
                break;
            case 'screen-lookbooks':
                this.renderLookbooks();
                this.screenHistory = ['screen-home'];
                break;
            case 'screen-timesheet':
            case 'screen-settings':
                this.updateSettings();
                this.screenHistory = ['screen-home'];
                break;
        }
    },

    /**
     * Update bottom navigation active state
     */
    updateBottomNavState(screenId) {
        // Map screens to their tabs
        const screenToTab = {
            'screen-scene-list': 'scenes',
            'screen-scene-detail': 'scenes',
            'screen-character-profile': 'scenes',
            'screen-photo-capture': 'scenes',
            'screen-lookbooks': 'lookbooks',
            'screen-timesheet': 'timesheet',
            'screen-timesheet-form': 'timesheet',
            'screen-settings': 'settings'
        };

        const tab = screenToTab[screenId];
        if (!tab) return;

        this.activeTab = tab;

        // Update all bottom navs
        document.querySelectorAll('.bottom-nav').forEach(nav => {
            nav.querySelectorAll('.nav-item').forEach(item => {
                const itemTab = item.dataset.tab;
                if (itemTab === tab) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        });
    },

    // ============================================
    // EVENT BINDING
    // ============================================

    /**
     * Bind navigation events
     */
    bindNavigationEvents() {
        // Handle all elements with data-navigate attribute
        document.addEventListener('click', (e) => {
            // Find the nearest clickable element with data-navigate
            const navElement = e.target.closest('[data-navigate]');
            if (navElement) {
                e.preventDefault();
                const screenId = navElement.dataset.navigate;

                // Check for special actions
                const action = navElement.dataset.action;
                if (action) {
                    this.handleAction(action, navElement);
                }

                this.navigateTo(screenId);
            }

            // Handle back buttons specifically
            if (e.target.closest('.back-btn')) {
                e.preventDefault();
                // Back buttons with data-navigate go to that screen
                // Otherwise use history
                if (!e.target.closest('[data-navigate]')) {
                    this.goBack();
                }
            }
        });
    },

    /**
     * Handle special actions
     */
    handleAction(action, element) {
        switch (action) {
            case 'show-confirmation':
                this.showModal('modal-character-confirmation');
                break;
            case 'confirm-characters':
                this.confirmCharacters();
                this.closeModal('modal-character-confirmation');
                break;
            case 'close-modal':
                this.closeActiveModal();
                break;
        }
    },

    /**
     * Bind search toggle functionality
     */
    bindSearchToggle() {
        // Scene list search toggle
        const sceneSearchBtn = document.getElementById('btn-toggle-search');
        const sceneSearchBar = document.getElementById('search-bar');
        const sceneSearchClear = document.getElementById('search-clear');
        const sceneSearchInput = document.getElementById('scene-search');

        if (sceneSearchBtn && sceneSearchBar) {
            sceneSearchBtn.addEventListener('click', () => {
                sceneSearchBar.classList.toggle('hidden');
                if (!sceneSearchBar.classList.contains('hidden')) {
                    sceneSearchInput?.focus();
                }
            });
        }

        if (sceneSearchClear && sceneSearchInput) {
            sceneSearchClear.addEventListener('click', () => {
                sceneSearchInput.value = '';
                sceneSearchInput.focus();
                this.filterScenes('');
            });
        }

        // Lookbook search toggle
        const lookbookSearchBtn = document.getElementById('btn-lookbook-search');
        const lookbookSearchBar = document.getElementById('lookbook-search-bar');
        const lookbookSearchClear = document.getElementById('lookbook-search-clear');
        const lookbookSearchInput = document.getElementById('lookbook-search');

        if (lookbookSearchBtn && lookbookSearchBar) {
            lookbookSearchBtn.addEventListener('click', () => {
                lookbookSearchBar.classList.toggle('hidden');
                if (!lookbookSearchBar.classList.contains('hidden')) {
                    lookbookSearchInput?.focus();
                }
            });
        }

        if (lookbookSearchClear && lookbookSearchInput) {
            lookbookSearchClear.addEventListener('click', () => {
                lookbookSearchInput.value = '';
                lookbookSearchInput.focus();
                this.filterLookbooks('');
            });
        }
    },

    /**
     * Bind scene search input
     */
    bindSceneSearch() {
        const sceneSearchInput = document.getElementById('scene-search');
        if (sceneSearchInput) {
            sceneSearchInput.addEventListener('input', (e) => {
                this.filterScenes(e.target.value);
            });
        }

        const lookbookSearchInput = document.getElementById('lookbook-search');
        if (lookbookSearchInput) {
            lookbookSearchInput.addEventListener('input', (e) => {
                this.filterLookbooks(e.target.value);
            });
        }
    },

    /**
     * Bind filter pills functionality
     */
    bindFilterPills() {
        document.querySelectorAll('.filter-pills').forEach(pillContainer => {
            pillContainer.addEventListener('click', (e) => {
                const pill = e.target.closest('.pill');
                if (!pill) return;

                // Update active state
                pillContainer.querySelectorAll('.pill').forEach(p => {
                    p.classList.remove('active');
                });
                pill.classList.add('active');

                // Get filter value
                const filter = pill.dataset.filter;

                // Apply filter based on context
                if (pillContainer.closest('#screen-scene-list')) {
                    this.filterScenesByStatus(filter);
                }
            });
        });
    },

    /**
     * Bind upload card click
     */
    bindUploadCard() {
        const uploadCard = document.getElementById('upload-card');
        const fileInput = document.getElementById('script-file-input');
        const fileRemove = document.getElementById('file-remove');
        const demoBtn = document.getElementById('btn-use-demo');

        if (uploadCard && fileInput) {
            uploadCard.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileSelected(file, false);
                }
            });
        }

        if (fileRemove) {
            fileRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearSelectedFile();
            });
        }

        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                // Use demo data
                this.handleFileSelected({
                    name: 'demo_script.pdf',
                    size: 2457600 // 2.4 MB
                }, true);
            });
        }
    },

    /**
     * Handle file selection
     */
    handleFileSelected(file, isDemo = false) {
        const uploadCard = document.getElementById('upload-card');
        const filePreview = document.getElementById('file-preview');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const continueBtn = document.getElementById('btn-continue-upload');
        const projectNameInput = document.getElementById('project-name');

        // Store file reference
        this.project.file = isDemo ? null : file;
        this.project.isDemo = isDemo;

        // Get project name
        if (projectNameInput && projectNameInput.value.trim()) {
            this.project.name = projectNameInput.value.trim();
        } else {
            // Extract name from file
            this.project.name = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        }

        if (uploadCard && filePreview) {
            uploadCard.classList.add('hidden');
            filePreview.classList.remove('hidden');
        }

        if (fileName) {
            fileName.textContent = file.name;
        }

        if (fileSize) {
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
            fileSize.textContent = `${sizeInMB} MB`;
        }

        if (continueBtn) {
            continueBtn.disabled = false;
        }
    },

    /**
     * Clear selected file
     */
    clearSelectedFile() {
        const uploadCard = document.getElementById('upload-card');
        const filePreview = document.getElementById('file-preview');
        const fileInput = document.getElementById('script-file-input');
        const continueBtn = document.getElementById('btn-continue-upload');

        this.project.file = null;
        this.project.isDemo = false;

        if (uploadCard && filePreview) {
            uploadCard.classList.remove('hidden');
            filePreview.classList.add('hidden');
        }

        if (fileInput) {
            fileInput.value = '';
        }

        if (continueBtn) {
            continueBtn.disabled = true;
        }
    },

    /**
     * Bind sync code inputs
     */
    bindSyncCodeInputs() {
        const code1 = document.getElementById('sync-code-1');
        const code2 = document.getElementById('sync-code-2');
        const connectBtn = document.getElementById('btn-connect-sync');

        if (code1 && code2 && connectBtn) {
            const checkComplete = () => {
                const complete = code1.value.length === 4 && code2.value.length === 4;
                connectBtn.disabled = !complete;
            };

            code1.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (e.target.value.length === 4) {
                    code2.focus();
                }
                checkComplete();
            });

            code2.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                checkComplete();
            });

            code2.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '') {
                    code1.focus();
                }
            });
        }
    },

    // ============================================
    // MODAL HANDLING
    // ============================================

    /**
     * Bind modal events
     */
    bindModalEvents() {
        // Close modal when clicking overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                this.closeActiveModal();
            });
        });

        // Skip analysis button
        const skipBtn = document.getElementById('btn-skip-analysis');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                // Use demo data when skipping
                if (!this.scenes.length) {
                    const demoData = ScriptProcessor.generateDemoData();
                    this.scenes = demoData.scenes;
                    this.characters = demoData.characters;
                    this.duplicates = demoData.duplicates;
                }
                this.renderCharacterConfirmation();
                this.showModal('modal-character-confirmation');
            });
        }
    },

    /**
     * Show a modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modalId;
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * Close a modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            if (this.activeModal === modalId) {
                this.activeModal = null;
            }
            document.body.style.overflow = '';
        }
    },

    /**
     * Close the currently active modal
     */
    closeActiveModal() {
        if (this.activeModal) {
            this.closeModal(this.activeModal);
        }
    },

    // ============================================
    // SCRIPT ANALYSIS (Stage 2)
    // ============================================

    /**
     * Start script analysis
     */
    async startScriptAnalysis() {
        const progressFill = document.getElementById('analysis-progress');
        const statusText = document.getElementById('analysis-status');

        // Reset progress
        if (progressFill) {
            progressFill.style.width = '0%';
            progressFill.style.animation = 'none';
        }

        // Check if using demo data
        if (this.project.isDemo) {
            await this.runDemoAnalysis();
            return;
        }

        // Process real file
        if (this.project.file) {
            await this.runRealAnalysis();
        } else {
            // No file, use demo
            await this.runDemoAnalysis();
        }
    },

    /**
     * Run analysis with demo data
     */
    async runDemoAnalysis() {
        const progressFill = document.getElementById('analysis-progress');
        const statusText = document.getElementById('analysis-status');
        const steps = [
            { id: 'step-scenes', text: 'Scanning for scene headings...', progress: 33 },
            { id: 'step-characters', text: 'Extracting character names...', progress: 66 },
            { id: 'step-duplicates', text: 'Checking for duplicates...', progress: 100 }
        ];

        for (let i = 0; i < steps.length; i++) {
            // Update UI
            this.updateAnalysisStep(i, steps);
            if (statusText) statusText.textContent = steps[i].text;
            if (progressFill) progressFill.style.width = `${steps[i].progress}%`;

            // Wait
            await this.delay(800);
        }

        // Get demo data
        const demoData = ScriptProcessor.generateDemoData();
        this.scenes = demoData.scenes;
        this.characters = demoData.characters;
        this.duplicates = demoData.duplicates;

        // Show confirmation modal
        await this.delay(300);
        this.renderCharacterConfirmation();
        this.showModal('modal-character-confirmation');
    },

    /**
     * Run analysis with real file
     */
    async runRealAnalysis() {
        const progressFill = document.getElementById('analysis-progress');
        const statusText = document.getElementById('analysis-status');

        try {
            const result = await ScriptProcessor.processScript(this.project.file, (progress) => {
                // Update progress UI
                if (progressFill) {
                    progressFill.style.width = `${progress.progress}%`;
                }

                // Update status text
                if (statusText) {
                    switch (progress.step) {
                        case 'extracting':
                            statusText.textContent = 'Extracting text from PDF...';
                            this.updateAnalysisStep(-1, []);
                            break;
                        case 'scenes':
                            statusText.textContent = 'Scanning for scene headings...';
                            this.updateAnalysisStep(0, [
                                { id: 'step-scenes' },
                                { id: 'step-characters' },
                                { id: 'step-duplicates' }
                            ]);
                            break;
                        case 'characters':
                            statusText.textContent = 'Extracting character names...';
                            this.updateAnalysisStep(1, [
                                { id: 'step-scenes' },
                                { id: 'step-characters' },
                                { id: 'step-duplicates' }
                            ]);
                            break;
                        case 'duplicates':
                            statusText.textContent = 'Checking for duplicates...';
                            this.updateAnalysisStep(2, [
                                { id: 'step-scenes' },
                                { id: 'step-characters' },
                                { id: 'step-duplicates' }
                            ]);
                            break;
                    }
                }
            });

            if (result.success) {
                this.scenes = result.scenes;
                this.characters = result.characters;
                this.duplicates = result.duplicates;

                // Show confirmation modal
                await this.delay(300);
                this.renderCharacterConfirmation();
                this.showModal('modal-character-confirmation');
            } else {
                // Error - show alert and go back
                alert(`Error processing script: ${result.error}`);
                this.navigateTo('screen-upload');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error processing script. Please try again.');
            this.navigateTo('screen-upload');
        }
    },

    /**
     * Update analysis step indicators
     */
    updateAnalysisStep(currentIndex, steps) {
        const stepIds = ['step-scenes', 'step-characters', 'step-duplicates'];

        stepIds.forEach((id, index) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active', 'complete');
                if (index < currentIndex) {
                    el.classList.add('complete');
                } else if (index === currentIndex) {
                    el.classList.add('active');
                }
            }
        });
    },

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // ============================================
    // CHARACTER CONFIRMATION (Stage 2)
    // ============================================

    /**
     * Bind character confirmation events
     */
    bindCharacterConfirmation() {
        // Merge button clicks will be handled by event delegation
        document.getElementById('modal-character-confirmation')?.addEventListener('click', (e) => {
            const mergeBtn = e.target.closest('[data-merge-group]');
            if (mergeBtn) {
                const groupIndex = parseInt(mergeBtn.dataset.mergeGroup);
                this.mergeDuplicateGroup(groupIndex);
            }
        });
    },

    /**
     * Render character confirmation modal content
     */
    renderCharacterConfirmation() {
        // Update stats
        const statScenes = document.getElementById('stat-scenes');
        const statCharacters = document.getElementById('stat-characters');

        if (statScenes) statScenes.textContent = this.scenes.length;
        if (statCharacters) statCharacters.textContent = this.characters.length;

        // Render duplicate warnings
        this.renderDuplicateCards();

        // Render character list
        this.renderCharacterList();

        // Show/hide duplicate warning banner
        const warningBanner = document.getElementById('duplicate-warning');
        if (warningBanner) {
            warningBanner.style.display = this.duplicates.length > 0 ? 'flex' : 'none';
        }
    },

    /**
     * Render duplicate character cards
     */
    renderDuplicateCards() {
        const container = document.getElementById('duplicate-cards');
        if (!container) return;

        if (this.duplicates.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = this.duplicates.map((group, index) => `
            <div class="duplicate-card" data-group="${index}">
                <div class="duplicate-names">
                    ${group.characters.map(c => `<span class="dup-name">${c.name}</span>`).join('<span class="dup-separator">+</span>')}
                </div>
                <div class="duplicate-info">
                    <span>${group.totalScenes} scenes combined</span>
                </div>
                <button class="btn btn-small btn-gold" data-merge-group="${index}">
                    Merge as "${group.suggestedName}"
                </button>
            </div>
        `).join('');
    },

    /**
     * Render character checkbox list
     */
    renderCharacterList() {
        const container = document.getElementById('character-list');
        if (!container) return;

        // Filter out characters that are part of duplicate groups
        const duplicateNames = new Set();
        this.duplicates.forEach(group => {
            group.characters.forEach(c => duplicateNames.add(c.name));
        });

        const visibleCharacters = this.characters.filter(c => !duplicateNames.has(c.name));

        container.innerHTML = visibleCharacters.map((char, index) => `
            <label class="character-checkbox">
                <input type="checkbox" ${char.selected ? 'checked' : ''} data-character="${char.name}">
                <span class="checkbox-custom"></span>
                <span class="character-name">${char.name}</span>
                <span class="scene-count">${char.sceneCount} scene${char.sceneCount !== 1 ? 's' : ''}</span>
            </label>
        `).join('');

        // Bind checkbox changes
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const charName = e.target.dataset.character;
                const char = this.characters.find(c => c.name === charName);
                if (char) {
                    char.selected = e.target.checked;
                }
            });
        });
    },

    /**
     * Merge a duplicate group
     */
    mergeDuplicateGroup(groupIndex) {
        const group = this.duplicates[groupIndex];
        if (!group) return;

        // Create merged character
        const mergedChar = {
            name: group.suggestedName,
            normalizedName: ScriptProcessor.normalizeName(group.suggestedName),
            occurrences: group.totalOccurrences,
            sceneIndices: Array.from(new Set(group.characters.flatMap(c => c.sceneIndices))).sort((a, b) => a - b),
            sceneCount: group.totalScenes,
            selected: true,
            mergedFrom: group.characters.map(c => c.name)
        };

        // Remove old characters from the list
        const oldNames = new Set(group.characters.map(c => c.name));
        this.characters = this.characters.filter(c => !oldNames.has(c.name));

        // Add merged character
        this.characters.push(mergedChar);

        // Sort by occurrence
        this.characters.sort((a, b) => b.occurrences - a.occurrences);

        // Update scenes to use merged name
        this.scenes.forEach(scene => {
            const hasOldName = scene.characters.some(c => oldNames.has(c));
            if (hasOldName) {
                scene.characters = scene.characters.filter(c => !oldNames.has(c));
                if (!scene.characters.includes(mergedChar.name)) {
                    scene.characters.push(mergedChar.name);
                }
            }
        });

        // Remove this duplicate group
        this.duplicates.splice(groupIndex, 1);

        // Re-render
        this.renderCharacterConfirmation();
    },

    /**
     * Confirm characters and proceed
     */
    confirmCharacters() {
        // Filter to only selected characters
        const selectedCharacters = this.characters.filter(c => c.selected);

        // Update scenes to only include selected characters
        this.scenes.forEach(scene => {
            scene.characters = scene.characters.filter(charName =>
                selectedCharacters.some(c => c.name === charName)
            );
        });

        // Update characters list
        this.characters = selectedCharacters;

        // Save to localStorage
        this.saveToStorage();

        console.log(`Confirmed ${this.characters.length} characters across ${this.scenes.length} scenes`);
    },

    // ============================================
    // SCENE LIST RENDERING (Stage 2)
    // ============================================

    /**
     * Render the scene list
     */
    renderSceneList() {
        const container = document.getElementById('scene-list');
        const countEl = document.getElementById('filtered-count');

        if (!container) return;

        if (this.scenes.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-icon">
                        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="6" y="10" width="36" height="28" rx="2"/>
                            <path d="M6 18h36"/>
                        </svg>
                    </div>
                    <h3 class="empty-title">No Scenes Yet</h3>
                    <p class="empty-text">Upload a script to get started with continuity tracking.</p>
                </div>
            `;
            if (countEl) countEl.textContent = '0';
            return;
        }

        container.innerHTML = this.scenes.map(scene => this.renderSceneCard(scene)).join('');
        if (countEl) countEl.textContent = this.scenes.length;

        // Bind scene card clicks
        container.querySelectorAll('.scene-card').forEach(card => {
            card.addEventListener('click', () => {
                const sceneIndex = parseInt(card.dataset.scene);
                this.openSceneDetail(sceneIndex);
            });
        });
    },

    /**
     * Render a single scene card
     */
    renderSceneCard(scene) {
        const statusClass = scene.status || 'pending';

        return `
            <div class="scene-card" data-scene="${scene.index}" data-status="${statusClass}">
                <div class="scene-number">${scene.number}</div>
                <div class="scene-info">
                    <p class="scene-heading">${scene.heading}</p>
                    <div class="scene-meta">
                        <span class="scene-type ${scene.type.toLowerCase().replace('/', '-')}">${scene.type}</span>
                        <span class="scene-time">${scene.timeOfDay}</span>
                    </div>
                </div>
                <div class="scene-status ${statusClass}">
                    <span class="status-icon"></span>
                </div>
            </div>
        `;
    },

    /**
     * Filter scenes by search term
     */
    filterScenes(searchTerm) {
        const cards = document.querySelectorAll('#scene-list .scene-card');
        const term = searchTerm.toLowerCase().trim();
        let visibleCount = 0;

        cards.forEach(card => {
            const heading = card.querySelector('.scene-heading')?.textContent.toLowerCase() || '';
            const number = card.querySelector('.scene-number')?.textContent.toLowerCase() || '';

            const matches = !term || heading.includes(term) || number.includes(term);
            card.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        const countEl = document.getElementById('filtered-count');
        if (countEl) countEl.textContent = visibleCount;
    },

    /**
     * Filter scenes by status
     */
    filterScenesByStatus(status) {
        const cards = document.querySelectorAll('#scene-list .scene-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const cardStatus = card.dataset.status;
            let matches = false;

            switch (status) {
                case 'all':
                    matches = true;
                    break;
                case 'complete':
                    matches = cardStatus === 'complete';
                    break;
                case 'incomplete':
                    matches = cardStatus === 'pending' || cardStatus === 'partial';
                    break;
                default:
                    matches = true;
            }

            card.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        const countEl = document.getElementById('filtered-count');
        if (countEl) countEl.textContent = visibleCount;
    },

    /**
     * Open scene detail
     */
    openSceneDetail(sceneIndex) {
        const scene = this.scenes[sceneIndex];
        if (!scene) return;

        // Update scene detail UI
        const sceneNumberEl = document.getElementById('detail-scene-number');
        const sceneHeadingEl = document.getElementById('detail-scene-heading');
        const characterTabsEl = document.getElementById('character-tabs');

        if (sceneNumberEl) sceneNumberEl.textContent = scene.number;
        if (sceneHeadingEl) sceneHeadingEl.textContent = scene.heading;

        // Render character tabs
        if (characterTabsEl) {
            if (scene.characters.length === 0) {
                characterTabsEl.innerHTML = '<p style="padding: 0 16px; color: var(--text-tertiary);">No characters in this scene</p>';
            } else {
                characterTabsEl.innerHTML = scene.characters.map((charName, i) => `
                    <button class="character-tab ${i === 0 ? 'active' : ''}" data-character="${charName}">
                        ${charName}
                    </button>
                `).join('');

                // Bind tab clicks
                characterTabsEl.querySelectorAll('.character-tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        // Update active state
                        characterTabsEl.querySelectorAll('.character-tab').forEach(t => t.classList.remove('active'));
                        e.target.classList.add('active');

                        // Navigate to character profile
                        this.openCharacterProfile(e.target.dataset.character, sceneIndex);
                    });
                });
            }
        }

        // Store current scene index
        this.currentSceneIndex = sceneIndex;

        this.navigateTo('screen-scene-detail');
    },

    /**
     * Open character profile
     */
    openCharacterProfile(characterName, sceneIndex) {
        const character = this.characters.find(c => c.name === characterName);
        const scene = this.scenes[sceneIndex];

        if (!character || !scene) return;

        // Update profile UI
        const profileNameEl = document.getElementById('profile-character-name');
        const profileName = document.querySelector('.profile-name');
        const profileContext = document.querySelector('.profile-context');

        if (profileNameEl) profileNameEl.textContent = character.name;
        if (profileName) profileName.textContent = character.name;
        if (profileContext) profileContext.textContent = `Scene ${scene.number} | ${scene.heading.substring(0, 30)}...`;

        // Store current character
        this.currentCharacterName = characterName;

        this.navigateTo('screen-character-profile');
    },

    // ============================================
    // LOOKBOOKS RENDERING (Stage 2)
    // ============================================

    /**
     * Render lookbooks screen
     */
    renderLookbooks() {
        const container = document.getElementById('lookbook-list');
        const countEl = document.getElementById('character-count');

        if (!container) return;

        if (this.characters.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-icon">
                        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M24 12v24M12 24h24"/>
                        </svg>
                    </div>
                    <h3 class="empty-title">No Characters Yet</h3>
                    <p class="empty-text">Upload a script to see character lookbooks.</p>
                </div>
            `;
            if (countEl) countEl.textContent = '0';
            return;
        }

        container.innerHTML = this.characters.map(char => `
            <div class="lookbook-character" data-character="${char.name}">
                <h3 class="lookbook-character-name">${char.name}</h3>
                <div class="lookbook-looks">
                    <div class="lookbook-card">
                        <div class="lookbook-thumbnail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="M21 15l-5-5L5 21"/>
                            </svg>
                        </div>
                        <div class="lookbook-info">
                            <h4 class="lookbook-look-name">Default Look</h4>
                            <p class="lookbook-description">Character appearance for all scenes. Add specific looks in later stages.</p>
                            <span class="tag">Scenes ${this.formatSceneRange(char.sceneIndices)}</span>
                            <p class="lookbook-products">${char.sceneCount} scene${char.sceneCount !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        if (countEl) countEl.textContent = this.characters.length;
    },

    /**
     * Format scene indices as a range string
     */
    formatSceneRange(indices) {
        if (!indices || indices.length === 0) return 'None';
        if (indices.length === 1) return this.scenes[indices[0]]?.number || indices[0] + 1;

        // Get scene numbers
        const numbers = indices.map(i => this.scenes[i]?.number || i + 1);
        const first = numbers[0];
        const last = numbers[numbers.length - 1];

        return `${first}-${last}`;
    },

    /**
     * Filter lookbooks by character name
     */
    filterLookbooks(searchTerm) {
        const characters = document.querySelectorAll('#lookbook-list .lookbook-character');
        const term = searchTerm.toLowerCase().trim();

        characters.forEach(charEl => {
            const name = charEl.dataset.character?.toLowerCase() || '';
            const matches = !term || name.includes(term);
            charEl.style.display = matches ? '' : 'none';
        });
    },

    // ============================================
    // SETTINGS UPDATE (Stage 2)
    // ============================================

    /**
     * Update settings screen with current data
     */
    updateSettings() {
        const projectNameEl = document.getElementById('settings-project-name');
        const sceneCountEl = document.getElementById('settings-scene-count');
        const characterCountEl = document.getElementById('settings-character-count');

        if (projectNameEl) projectNameEl.textContent = this.project.name;
        if (sceneCountEl) sceneCountEl.textContent = this.scenes.length;
        if (characterCountEl) characterCountEl.textContent = this.characters.length;
    },

    // ============================================
    // LOCAL STORAGE (Stage 2)
    // ============================================

    /**
     * Save current data to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.PROJECT, JSON.stringify(this.project));
            localStorage.setItem(this.STORAGE_KEYS.SCENES, JSON.stringify(this.scenes));
            localStorage.setItem(this.STORAGE_KEYS.CHARACTERS, JSON.stringify(this.characters));
            console.log('Data saved to localStorage');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },

    /**
     * Load data from localStorage
     */
    loadFromStorage() {
        try {
            const projectData = localStorage.getItem(this.STORAGE_KEYS.PROJECT);
            const scenesData = localStorage.getItem(this.STORAGE_KEYS.SCENES);
            const charactersData = localStorage.getItem(this.STORAGE_KEYS.CHARACTERS);

            if (projectData) this.project = JSON.parse(projectData);
            if (scenesData) this.scenes = JSON.parse(scenesData);
            if (charactersData) this.characters = JSON.parse(charactersData);

            return this.scenes.length > 0;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return false;
        }
    },

    /**
     * Clear all stored data
     */
    clearStorage() {
        localStorage.removeItem(this.STORAGE_KEYS.PROJECT);
        localStorage.removeItem(this.STORAGE_KEYS.SCENES);
        localStorage.removeItem(this.STORAGE_KEYS.CHARACTERS);

        this.project = { name: 'Untitled Project', file: null, isDemo: false };
        this.scenes = [];
        this.characters = [];
        this.duplicates = [];

        console.log('Storage cleared');
    },

    // ============================================
    // TIMESHEET CALCULATION
    // ============================================

    /**
     * Bind timesheet calculation
     */
    bindTimesheetCalculation() {
        const callTime = document.getElementById('entry-call-time');
        const wrapTime = document.getElementById('entry-wrap-time');
        const mealBreak = document.getElementById('entry-meal-break');
        const totalEl = document.getElementById('calculated-total');
        const breakdownEl = document.getElementById('calc-breakdown');

        const calculateTotal = () => {
            if (!callTime || !wrapTime || !mealBreak) return;

            const call = callTime.value.split(':').map(Number);
            const wrap = wrapTime.value.split(':').map(Number);
            const breakMins = parseInt(mealBreak.value) || 0;

            const callMinutes = call[0] * 60 + call[1];
            const wrapMinutes = wrap[0] * 60 + wrap[1];

            let workedMinutes = wrapMinutes - callMinutes;
            if (workedMinutes < 0) workedMinutes += 24 * 60; // Handle overnight

            const totalMinutes = workedMinutes - breakMins;
            const totalHours = totalMinutes / 60;

            if (totalEl) {
                totalEl.textContent = totalHours.toFixed(1);
            }

            if (breakdownEl) {
                const workedHrs = Math.floor(workedMinutes / 60);
                const workedMins = workedMinutes % 60;
                const breakHrs = Math.floor(breakMins / 60);
                const breakMinsRem = breakMins % 60;

                breakdownEl.textContent = `${workedHrs}:${workedMins.toString().padStart(2, '0')} worked - ${breakHrs}:${breakMinsRem.toString().padStart(2, '0')} break`;
            }
        };

        if (callTime) callTime.addEventListener('change', calculateTotal);
        if (wrapTime) wrapTime.addEventListener('change', calculateTotal);
        if (mealBreak) mealBreak.addEventListener('input', calculateTotal);

        // Calculate initial value
        calculateTotal();
    },

    // ============================================
    // ROUTING
    // ============================================

    /**
     * Check initial route based on app state
     */
    checkInitialRoute() {
        // Check if we have existing data
        const hasExistingProject = this.loadFromStorage();

        if (hasExistingProject) {
            // Go directly to scene list
            this.navigateTo('screen-scene-list', { pushHistory: false });
        } else {
            // Start at home
            this.navigateTo('screen-home', { pushHistory: false });
        }
    }
};

// ============================================
// INITIALIZE APP
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for debugging
window.App = App;

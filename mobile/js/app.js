/**
 * Hair & Makeup Pro - Mobile PWA
 * Stage 1: Core Structure - Screen Navigation & Routing
 * Stage 2: Script Upload & Analysis
 * Stage 4: Photo Capture System
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

    // Photo capture state (Stage 4)
    currentSceneIndex: null,
    currentCharacterName: null,
    currentCaptureAngle: null,

    // Timesheet entries
    timesheetEntries: [],
    timesheetFilter: 'this-week',
    timesheetSelectedDate: null, // Currently selected date for quick entry

    // Rate card settings
    rateCard: {
        dailyRate: 0,
        baseDayHours: 11,
        otMultiplier: 1.5,
        sixthDayMultiplier: 1.5,
        kitRental: 0
    },

    // LocalStorage keys
    STORAGE_KEYS: {
        PROJECT: 'hmp_project',
        SCENES: 'hmp_scenes',
        CHARACTERS: 'hmp_characters',
        TIMESHEETS: 'hmp_timesheets',
        RATE_CARD: 'hmp_rate_card'
    },

    // Initialize the app
    async init() {
        // Initialize PhotoStorage (IndexedDB)
        await PhotoStorage.init();

        this.bindNavigationEvents();
        this.bindSearchToggle();
        this.bindFilterPills();
        this.bindUploadCard();
        this.bindSyncCodeInputs();
        this.bindModalEvents();
        this.bindTimesheetCalculation();
        this.bindTimesheetEvents();
        this.bindCharacterConfirmation();
        this.bindSceneSearch();
        this.bindPhotoCapture();
        this.bindSettingsEvents();
        this.bindDemoButton();
        this.bindRateCardEvents();
        this.loadRateCard();

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
                this.updateDemoBadge();
                // These are main tab screens - clear history to home
                this.screenHistory = ['screen-home'];
                break;
            case 'screen-lookbooks':
                this.renderLookbooks();
                this.screenHistory = ['screen-home'];
                break;
            case 'screen-timesheet':
                this.initQuickEntryTimesheet();
                this.screenHistory = ['screen-home'];
                break;
            case 'screen-timesheet-history':
                this.renderTimesheetHistory();
                break;
            case 'screen-settings':
                this.updateSettings();
                this.updateSyncStatusInSettings();
                this.screenHistory = ['screen-home'];
                break;
            case 'screen-photo-capture':
                this.initPhotoCapture();
                break;
            case 'screen-sync-login':
                this.initSyncLoginScreen();
                break;
            case 'screen-sync-status':
                if (typeof SyncUI !== 'undefined') {
                    SyncUI.renderSyncStatus();
                }
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
            'screen-timesheet-history': 'timesheet',
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

        // Lookbook export button
        const lookbookExportBtn = document.getElementById('btn-export-lookbook');
        if (lookbookExportBtn) {
            lookbookExportBtn.addEventListener('click', () => this.exportLookbook());
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
     * Bind sync code inputs (6 single-character inputs)
     */
    bindSyncCodeInputs() {
        // Initialize SyncUI if available
        if (typeof SyncUI !== 'undefined') {
            SyncUI.bindSyncCodeInputs();
        }
    },

    /**
     * Initialize the sync login screen
     */
    initSyncLoginScreen() {
        // Bind file import button
        const importFileBtn = document.getElementById('btn-import-file');
        const fileInput = document.getElementById('sync-file-input');

        if (importFileBtn && fileInput) {
            importFileBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => this.handleSyncFileImport(e);
        }

        // Bind sync code inputs
        if (typeof SyncUI !== 'undefined') {
            SyncUI.bindSyncCodeInputs();
        }

        // Bind connect button
        const connectBtn = document.getElementById('btn-connect-sync');
        if (connectBtn) {
            connectBtn.onclick = () => {
                if (typeof SyncUI !== 'undefined') {
                    SyncUI.handleSyncCodeConnect();
                }
            };
        }
    },

    /**
     * Handle sync file import
     */
    async handleSyncFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            alert('Please select a .json sync file');
            return;
        }

        try {
            if (typeof MobileSync !== 'undefined') {
                const result = await MobileSync.importProjectFromFile(file);

                if (result.success) {
                    // Update app state with imported data
                    this.project = result.project;
                    this.scenes = JSON.parse(localStorage.getItem('hmp_scenes') || '[]');
                    this.characters = JSON.parse(localStorage.getItem('hmp_characters') || '[]');

                    alert(`Project "${result.project.name}" imported successfully!\n\n${result.scenesCount} scenes, ${result.charactersCount} characters`);

                    // Navigate to scene list
                    this.navigateTo('screen-scene-list');
                } else {
                    alert('Import failed: ' + result.error);
                }
            } else {
                // Fallback without MobileSync module
                const text = await file.text();
                const payload = JSON.parse(text);

                if (payload.project) {
                    this.project = {
                        name: payload.project.name || 'Imported Project',
                        file: file.name,
                        isDemo: false
                    };
                    localStorage.setItem(this.STORAGE_KEYS.PROJECT, JSON.stringify(this.project));
                }

                if (payload.scenes) {
                    this.scenes = payload.scenes;
                    localStorage.setItem(this.STORAGE_KEYS.SCENES, JSON.stringify(this.scenes));
                }

                if (payload.characters) {
                    this.characters = payload.characters.map(c => c.name || c);
                    localStorage.setItem(this.STORAGE_KEYS.CHARACTERS, JSON.stringify(this.characters));
                }

                alert('Project imported successfully!');
                this.navigateTo('screen-scene-list');
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import file: ' + error.message);
        }

        // Clear file input
        event.target.value = '';
    },

    /**
     * Update sync status display in settings
     */
    updateSyncStatusInSettings() {
        const titleEl = document.getElementById('settings-sync-title');
        const detailEl = document.getElementById('settings-sync-detail');
        const indicatorEl = document.getElementById('settings-sync-indicator');
        const exportBtn = document.getElementById('btn-export-data');
        const syncCard = document.getElementById('settings-sync-card');

        if (!titleEl || !detailEl) return;

        if (typeof MobileSync !== 'undefined') {
            const status = MobileSync.getStatusSummary();

            if (status.connected) {
                titleEl.textContent = status.projectName || 'Connected';
                detailEl.textContent = `Last sync: ${status.lastSyncFormatted}`;
                indicatorEl.innerHTML = `<span class="status-dot ${status.statusClass}"></span>`;
                if (exportBtn) exportBtn.style.display = 'block';
                if (syncCard) syncCard.setAttribute('data-navigate', 'screen-sync-status');
            } else {
                titleEl.textContent = 'Not Connected';
                detailEl.textContent = 'Tap to connect to a desktop project';
                indicatorEl.innerHTML = '<span class="status-dot status-disconnected"></span>';
                if (exportBtn) exportBtn.style.display = 'none';
                if (syncCard) syncCard.setAttribute('data-navigate', 'screen-sync-login');
            }
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
    async renderSceneList() {
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

        // Update scene statuses from photo database
        await this.updateSceneStatuses();

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

        // Render synopsis
        this.renderSceneSynopsis(scene, sceneIndex);

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

        // Bind script button in header
        const scriptBtn = document.getElementById('btn-scene-script');
        if (scriptBtn) {
            scriptBtn.onclick = () => this.openScriptViewer();
        }

        this.navigateTo('screen-scene-detail');
    },

    // ============================================
    // SCENE SYNOPSIS
    // ============================================

    /**
     * Render the scene synopsis section
     */
    renderSceneSynopsis(scene, sceneIndex) {
        const synopsisTextEl = document.getElementById('synopsis-text');
        const expandBtnEl = document.getElementById('synopsis-expand-btn');
        const synopsisContentEl = document.getElementById('synopsis-content');

        if (!synopsisTextEl) return;

        // Get synopsis from scene data (priority: desktop sync, manual, none)
        const synopsis = scene.synopsis || null;
        const synopsisSource = scene.synopsisSource || null;

        if (synopsis) {
            // Has synopsis
            let sourceHtml = '';
            if (synopsisSource === 'desktop') {
                sourceHtml = `<span class="synopsis-source-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                    from desktop
                </span>`;
            }

            synopsisTextEl.innerHTML = this.escapeHtml(synopsis) + sourceHtml;
            synopsisTextEl.classList.remove('expanded');

            // Show expand button if text is long (roughly > 150 chars)
            if (synopsis.length > 150) {
                expandBtnEl.style.display = 'block';
                expandBtnEl.querySelector('.expand-text').textContent = 'more...';
            } else {
                expandBtnEl.style.display = 'none';
            }
        } else {
            // No synopsis - show placeholder
            synopsisTextEl.innerHTML = '<span class="synopsis-placeholder">No synopsis available. Sync from desktop or tap to add.</span>';
            synopsisTextEl.classList.remove('expanded');
            expandBtnEl.style.display = 'none';
        }

        // Bind click events
        synopsisContentEl.onclick = () => this.handleSynopsisClick(scene, sceneIndex);
        expandBtnEl.onclick = (e) => {
            e.stopPropagation();
            this.toggleSynopsisExpand();
        };

        // Bind view script button
        const viewScriptBtn = document.getElementById('btn-view-script');
        if (viewScriptBtn) {
            viewScriptBtn.onclick = () => this.viewFullScene(scene);
        }
    },

    /**
     * Handle click on synopsis content
     */
    handleSynopsisClick(scene, sceneIndex) {
        const synopsisTextEl = document.getElementById('synopsis-text');

        // If expanded, collapse first
        if (synopsisTextEl.classList.contains('expanded')) {
            this.toggleSynopsisExpand();
            return;
        }

        // Open edit modal
        this.openSynopsisEditor(scene, sceneIndex);
    },

    /**
     * Toggle synopsis expand/collapse
     */
    toggleSynopsisExpand() {
        const synopsisTextEl = document.getElementById('synopsis-text');
        const expandBtnEl = document.getElementById('synopsis-expand-btn');

        if (!synopsisTextEl || !expandBtnEl) return;

        const isExpanded = synopsisTextEl.classList.toggle('expanded');
        expandBtnEl.querySelector('.expand-text').textContent = isExpanded ? 'less' : 'more...';
    },

    /**
     * Open synopsis editor modal
     */
    openSynopsisEditor(scene, sceneIndex) {
        const modal = document.getElementById('modal-edit-synopsis');
        const textarea = document.getElementById('synopsis-textarea');
        const charCountEl = document.getElementById('synopsis-char-current');

        if (!modal || !textarea) return;

        // Set current value
        textarea.value = scene.synopsis || '';
        this.updateSynopsisCharCount();

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus textarea
        setTimeout(() => textarea.focus(), 100);

        // Bind events
        textarea.oninput = () => this.updateSynopsisCharCount();

        document.getElementById('btn-close-synopsis-modal').onclick = () => this.closeSynopsisEditor();
        document.getElementById('btn-cancel-synopsis').onclick = () => this.closeSynopsisEditor();
        document.getElementById('btn-save-synopsis').onclick = () => this.saveSynopsis(sceneIndex);

        // Close on overlay click
        modal.querySelector('.modal-overlay').onclick = () => this.closeSynopsisEditor();
    },

    /**
     * Update synopsis character count display
     */
    updateSynopsisCharCount() {
        const textarea = document.getElementById('synopsis-textarea');
        const charCountEl = document.getElementById('synopsis-char-current');
        const charCountContainer = document.querySelector('.synopsis-char-count');

        if (!textarea || !charCountEl) return;

        const count = textarea.value.length;
        charCountEl.textContent = count;

        // Update styling based on count
        charCountContainer.classList.remove('near-limit', 'at-limit');
        if (count >= 200) {
            charCountContainer.classList.add('at-limit');
        } else if (count >= 180) {
            charCountContainer.classList.add('near-limit');
        }
    },

    /**
     * Close synopsis editor modal
     */
    closeSynopsisEditor() {
        const modal = document.getElementById('modal-edit-synopsis');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * Save synopsis to scene data
     */
    saveSynopsis(sceneIndex) {
        const textarea = document.getElementById('synopsis-textarea');
        if (!textarea) return;

        const synopsis = textarea.value.trim();
        const scene = this.scenes[sceneIndex];

        if (!scene) return;

        // Update scene data
        scene.synopsis = synopsis || null;
        scene.synopsisSource = synopsis ? 'manual' : null;

        // Save to localStorage
        localStorage.setItem(this.STORAGE_KEYS.SCENES, JSON.stringify(this.scenes));

        // Close modal
        this.closeSynopsisEditor();

        // Re-render synopsis
        this.renderSceneSynopsis(scene, sceneIndex);
    },

    // ============================================
    // SCRIPT VIEWER
    // ============================================

    // Script viewer state
    scriptViewerState: {
        currentSceneIndex: 0,
        zoomLevel: 'normal', // small, normal, large, xlarge
        searchQuery: '',
        searchResults: [],
        searchCurrentIndex: 0,
        scrollPositions: {}, // Store scroll positions per scene
        jumpDropdownOpen: false
    },

    /**
     * View full scene script - opens the script viewer screen
     */
    viewFullScene(scene) {
        const sceneIndex = this.scenes.indexOf(scene);
        if (sceneIndex === -1) {
            this.scriptViewerState.currentSceneIndex = 0;
        } else {
            this.scriptViewerState.currentSceneIndex = sceneIndex;
        }

        this.navigateTo('screen-script-viewer');
        this.initScriptViewer();
    },

    /**
     * Open script viewer from header button
     */
    openScriptViewer() {
        if (this.currentSceneIndex !== null) {
            this.scriptViewerState.currentSceneIndex = this.currentSceneIndex;
        }
        this.navigateTo('screen-script-viewer');
        this.initScriptViewer();
    },

    /**
     * Initialize the script viewer
     */
    initScriptViewer() {
        const loadingEl = document.getElementById('script-loading');
        const notAvailableEl = document.getElementById('script-not-available');
        const containerEl = document.getElementById('script-scenes-container');
        const titleEl = document.getElementById('script-viewer-title');

        // Check if any scenes have content
        const hasAnyContent = this.scenes.some(scene => scene.content);

        if (!hasAnyContent) {
            // Show not available message
            if (loadingEl) loadingEl.style.display = 'none';
            if (notAvailableEl) notAvailableEl.classList.remove('hidden');
            if (containerEl) containerEl.style.display = 'none';
            return;
        }

        // Hide loading, show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (notAvailableEl) notAvailableEl.classList.add('hidden');
        if (containerEl) containerEl.style.display = 'block';

        // Update title
        const currentScene = this.scenes[this.scriptViewerState.currentSceneIndex];
        if (titleEl && currentScene) {
            titleEl.textContent = `Scene ${currentScene.number} Script`;
        }

        // Render scenes
        this.renderScriptScenes();

        // Bind script viewer events
        this.bindScriptViewerEvents();

        // Scroll to current scene after rendering
        setTimeout(() => {
            this.scrollToCurrentScene();
        }, 100);
    },

    /**
     * Render all scenes in the script viewer
     */
    renderScriptScenes() {
        const container = document.getElementById('script-scenes-container');
        if (!container) return;

        const currentSceneIndex = this.scriptViewerState.currentSceneIndex;

        container.innerHTML = this.scenes.map((scene, index) => {
            const isCurrentScene = index === currentSceneIndex;
            const hasPrevious = index > 0;
            const hasNext = index < this.scenes.length - 1;
            const prevScene = hasPrevious ? this.scenes[index - 1] : null;
            const nextScene = hasNext ? this.scenes[index + 1] : null;

            // Format scene content
            const formattedContent = scene.content
                ? this.formatScreenplayContent(scene.content, scene.heading)
                : `<p class="screenplay-action" style="color: var(--text-tertiary); font-style: italic;">Script content not available for this scene.</p>`;

            return `
                <div class="script-scene-block ${isCurrentScene ? 'current-scene' : ''}"
                     data-scene-index="${index}"
                     id="script-scene-${index}">
                    <div class="script-scene-divider">
                        <span>Scene ${scene.number}</span>
                    </div>
                    <div class="screenplay-content">
                        <div class="screenplay-scene-heading">${this.escapeHtml(scene.heading)}</div>
                        ${formattedContent}
                    </div>
                    <div class="script-scene-nav">
                        <button class="script-scene-nav-btn ${!hasPrevious ? 'disabled' : ''}"
                                ${hasPrevious ? `data-goto-scene="${index - 1}"` : ''}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                            ${hasPrevious ? `Scene ${prevScene.number}` : 'Start'}
                        </button>
                        <button class="script-scene-nav-btn ${!hasNext ? 'disabled' : ''}"
                                ${hasNext ? `data-goto-scene="${index + 1}"` : ''}>
                            ${hasNext ? `Scene ${nextScene.number}` : 'End'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Render scene jump dropdown
        this.renderSceneJumpDropdown();
    },

    /**
     * Format screenplay content with proper structure
     */
    formatScreenplayContent(content, heading) {
        if (!content) return '';

        // Split content into lines
        const lines = content.split('\n');
        let formattedHtml = '';
        let inDialogue = false;
        let currentCharacter = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                // Empty line - reset dialogue state if needed
                if (inDialogue) {
                    inDialogue = false;
                }
                continue;
            }

            // Skip scene heading if it matches the header
            if (this.isSceneHeading(line)) {
                // Only show if it's a different scene heading
                if (!heading || !line.toUpperCase().includes(heading.toUpperCase().slice(0, 20))) {
                    formattedHtml += `<div class="screenplay-scene-heading">${this.escapeHtml(line)}</div>`;
                }
                continue;
            }

            // Check for transition (CUT TO:, FADE OUT, etc.)
            if (this.isTransition(line)) {
                formattedHtml += `<div class="screenplay-transition">${this.escapeHtml(line)}</div>`;
                inDialogue = false;
                continue;
            }

            // Check for character name (all caps, centered positioning indicator)
            if (this.isCharacterName(line, lines[i + 1])) {
                formattedHtml += `<div class="screenplay-character">${this.escapeHtml(line)}</div>`;
                currentCharacter = line;
                inDialogue = true;
                continue;
            }

            // Check for parenthetical
            if (this.isParenthetical(line)) {
                formattedHtml += `<div class="screenplay-parenthetical">${this.escapeHtml(line)}</div>`;
                continue;
            }

            // Dialogue or action
            if (inDialogue) {
                formattedHtml += `<div class="screenplay-dialogue">${this.escapeHtml(line)}</div>`;
            } else {
                formattedHtml += `<div class="screenplay-action">${this.escapeHtml(line)}</div>`;
            }
        }

        return formattedHtml;
    },

    /**
     * Check if line is a scene heading
     */
    isSceneHeading(line) {
        const upperLine = line.toUpperCase();
        return upperLine.startsWith('INT.') ||
               upperLine.startsWith('EXT.') ||
               upperLine.startsWith('INT/EXT') ||
               upperLine.startsWith('I/E');
    },

    /**
     * Check if line is a transition
     */
    isTransition(line) {
        const upperLine = line.toUpperCase().trim();
        return upperLine.endsWith('CUT TO:') ||
               upperLine.endsWith('FADE OUT.') ||
               upperLine.endsWith('FADE IN:') ||
               upperLine.endsWith('DISSOLVE TO:') ||
               upperLine.endsWith('SMASH CUT TO:') ||
               upperLine === 'CUT TO BLACK.' ||
               upperLine === 'FADE TO BLACK.';
    },

    /**
     * Check if line is a character name
     */
    isCharacterName(line, nextLine) {
        if (!line) return false;

        // Character names are typically ALL CAPS
        const isAllCaps = line === line.toUpperCase();

        // Should not be too long
        const isShort = line.length < 40;

        // Should not start with action-like words
        const startsWithAction = /^(THE|A|AN|HE|SHE|IT|THEY|WE|I\s)/i.test(line);

        // Check for common character name patterns
        const hasParenthetical = line.includes('(') && line.includes(')');
        const nameOnly = hasParenthetical ? line.split('(')[0].trim() : line;
        const looksLikeName = isAllCaps && isShort && !startsWithAction;

        // Additional check: next line should exist and not be empty
        const hasFollowingContent = nextLine && nextLine.trim().length > 0;

        return looksLikeName && hasFollowingContent;
    },

    /**
     * Check if line is a parenthetical
     */
    isParenthetical(line) {
        const trimmed = line.trim();
        return trimmed.startsWith('(') && trimmed.endsWith(')');
    },

    /**
     * Render scene jump dropdown options
     */
    renderSceneJumpDropdown() {
        const listEl = document.getElementById('scene-jump-list');
        if (!listEl) return;

        const currentIndex = this.scriptViewerState.currentSceneIndex;

        listEl.innerHTML = this.scenes.map((scene, index) => `
            <div class="scene-jump-item ${index === currentIndex ? 'active' : ''}"
                 data-jump-to-scene="${index}">
                <span class="scene-jump-number">${scene.number}</span>
                <span class="scene-jump-heading">${this.escapeHtml(scene.heading)}</span>
            </div>
        `).join('');
    },

    /**
     * Scroll to the current scene
     */
    scrollToCurrentScene() {
        const currentIndex = this.scriptViewerState.currentSceneIndex;
        const sceneEl = document.getElementById(`script-scene-${currentIndex}`);
        const contentArea = document.getElementById('script-content-area');

        if (sceneEl && contentArea) {
            // Check for stored scroll position
            const storedPosition = this.scriptViewerState.scrollPositions[currentIndex];
            if (storedPosition !== undefined) {
                contentArea.scrollTop = storedPosition;
            } else {
                // Scroll scene into view
                sceneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    },

    /**
     * Jump to a specific scene
     */
    jumpToScene(sceneIndex) {
        if (sceneIndex < 0 || sceneIndex >= this.scenes.length) return;

        // Update current scene
        this.scriptViewerState.currentSceneIndex = sceneIndex;

        // Update title
        const titleEl = document.getElementById('script-viewer-title');
        const scene = this.scenes[sceneIndex];
        if (titleEl && scene) {
            titleEl.textContent = `Scene ${scene.number} Script`;
        }

        // Update current-scene class
        document.querySelectorAll('.script-scene-block').forEach((block, index) => {
            if (index === sceneIndex) {
                block.classList.add('current-scene');
            } else {
                block.classList.remove('current-scene');
            }
        });

        // Update dropdown active state
        document.querySelectorAll('.scene-jump-item').forEach((item, index) => {
            if (index === sceneIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Close dropdown
        this.closeSceneJumpDropdown();

        // Scroll to scene
        const sceneEl = document.getElementById(`script-scene-${sceneIndex}`);
        if (sceneEl) {
            sceneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    /**
     * Toggle scene jump dropdown
     */
    toggleSceneJumpDropdown() {
        const dropdown = document.getElementById('scene-jump-dropdown');
        if (!dropdown) return;

        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            this.scriptViewerState.jumpDropdownOpen = true;
        } else {
            dropdown.classList.add('hidden');
            this.scriptViewerState.jumpDropdownOpen = false;
        }
    },

    /**
     * Close scene jump dropdown
     */
    closeSceneJumpDropdown() {
        const dropdown = document.getElementById('scene-jump-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            this.scriptViewerState.jumpDropdownOpen = false;
        }
    },

    /**
     * Toggle script search bar
     */
    toggleScriptSearch() {
        const searchBar = document.getElementById('script-search-bar');
        const searchInput = document.getElementById('script-search-input');

        if (!searchBar) return;

        if (searchBar.classList.contains('hidden')) {
            searchBar.classList.remove('hidden');
            if (searchInput) {
                searchInput.focus();
            }
        } else {
            searchBar.classList.add('hidden');
            this.clearScriptSearch();
        }
    },

    /**
     * Perform script search
     */
    performScriptSearch(query) {
        this.scriptViewerState.searchQuery = query;
        this.scriptViewerState.searchResults = [];
        this.scriptViewerState.searchCurrentIndex = 0;

        if (!query || query.length < 2) {
            this.clearSearchHighlights();
            document.getElementById('script-search-count').textContent = '';
            return;
        }

        // Clear previous highlights
        this.clearSearchHighlights();

        // Find all matches
        const container = document.getElementById('script-scenes-container');
        if (!container) return;

        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');

        // Get all text nodes in screenplay content
        const screenplayElements = container.querySelectorAll('.screenplay-action, .screenplay-dialogue, .screenplay-character, .screenplay-parenthetical');

        screenplayElements.forEach(el => {
            const text = el.textContent;
            if (regex.test(text)) {
                // Replace with highlighted version
                el.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
            }
        });

        // Collect all highlights
        const highlights = container.querySelectorAll('.search-highlight');
        this.scriptViewerState.searchResults = Array.from(highlights);

        // Update count display
        const countEl = document.getElementById('script-search-count');
        if (countEl) {
            const count = this.scriptViewerState.searchResults.length;
            countEl.textContent = count > 0 ? `${1}/${count}` : '0 results';
        }

        // Scroll to first result
        if (this.scriptViewerState.searchResults.length > 0) {
            this.goToSearchResult(0);
        }
    },

    /**
     * Go to a specific search result
     */
    goToSearchResult(index) {
        const results = this.scriptViewerState.searchResults;
        if (results.length === 0) return;

        // Wrap around
        if (index < 0) index = results.length - 1;
        if (index >= results.length) index = 0;

        this.scriptViewerState.searchCurrentIndex = index;

        // Remove current class from all
        results.forEach(el => el.classList.remove('current'));

        // Add current class to target
        const target = results[index];
        target.classList.add('current');

        // Scroll into view
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update count
        const countEl = document.getElementById('script-search-count');
        if (countEl) {
            countEl.textContent = `${index + 1}/${results.length}`;
        }
    },

    /**
     * Go to next search result
     */
    nextSearchResult() {
        this.goToSearchResult(this.scriptViewerState.searchCurrentIndex + 1);
    },

    /**
     * Go to previous search result
     */
    prevSearchResult() {
        this.goToSearchResult(this.scriptViewerState.searchCurrentIndex - 1);
    },

    /**
     * Clear search highlights
     */
    clearSearchHighlights() {
        const container = document.getElementById('script-scenes-container');
        if (!container) return;

        // Replace highlighted content with original text
        const highlights = container.querySelectorAll('.search-highlight');
        highlights.forEach(el => {
            const text = el.textContent;
            el.parentNode.replaceChild(document.createTextNode(text), el);
        });

        // Normalize text nodes
        container.normalize();
    },

    /**
     * Clear script search
     */
    clearScriptSearch() {
        const searchInput = document.getElementById('script-search-input');
        const countEl = document.getElementById('script-search-count');

        if (searchInput) searchInput.value = '';
        if (countEl) countEl.textContent = '';

        this.scriptViewerState.searchQuery = '';
        this.scriptViewerState.searchResults = [];
        this.scriptViewerState.searchCurrentIndex = 0;

        this.clearSearchHighlights();
    },

    /**
     * Escape regex special characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Close script viewer
     */
    closeScriptViewer() {
        // Save scroll position
        const contentArea = document.getElementById('script-content-area');
        if (contentArea) {
            this.scriptViewerState.scrollPositions[this.scriptViewerState.currentSceneIndex] = contentArea.scrollTop;
        }

        // Clear search
        this.clearScriptSearch();

        // Close dropdown
        this.closeSceneJumpDropdown();

        // Hide search bar
        const searchBar = document.getElementById('script-search-bar');
        if (searchBar) searchBar.classList.add('hidden');

        // Navigate back
        this.goBack();
    },

    /**
     * Bind script viewer events
     */
    bindScriptViewerEvents() {
        // Back button
        const backBtn = document.getElementById('script-viewer-back');
        if (backBtn) {
            backBtn.onclick = () => this.closeScriptViewer();
        }

        // Done button
        const doneBtn = document.getElementById('script-viewer-done');
        if (doneBtn) {
            doneBtn.onclick = () => this.closeScriptViewer();
        }

        // Scene jump button
        const jumpBtn = document.getElementById('btn-scene-jump');
        if (jumpBtn) {
            jumpBtn.onclick = () => this.toggleSceneJumpDropdown();
        }

        // Scene jump list clicks
        const jumpList = document.getElementById('scene-jump-list');
        if (jumpList) {
            jumpList.onclick = (e) => {
                const item = e.target.closest('[data-jump-to-scene]');
                if (item) {
                    const sceneIndex = parseInt(item.dataset.jumpToScene, 10);
                    this.jumpToScene(sceneIndex);
                }
            };
        }

        // Scene navigation buttons within scenes
        const container = document.getElementById('script-scenes-container');
        if (container) {
            container.onclick = (e) => {
                const navBtn = e.target.closest('[data-goto-scene]');
                if (navBtn) {
                    const sceneIndex = parseInt(navBtn.dataset.gotoScene, 10);
                    this.jumpToScene(sceneIndex);
                }
            };
        }

        // Search toggle
        const searchBtn = document.getElementById('btn-script-search');
        if (searchBtn) {
            searchBtn.onclick = () => this.toggleScriptSearch();
        }

        // Search input
        const searchInput = document.getElementById('script-search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.oninput = (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.performScriptSearch(e.target.value);
                }, 300);
            };
        }

        // Search navigation
        const searchPrev = document.getElementById('script-search-prev');
        const searchNext = document.getElementById('script-search-next');
        const searchClear = document.getElementById('script-search-clear');

        if (searchPrev) searchPrev.onclick = () => this.prevSearchResult();
        if (searchNext) searchNext.onclick = () => this.nextSearchResult();
        if (searchClear) searchClear.onclick = () => {
            this.clearScriptSearch();
            const searchBar = document.getElementById('script-search-bar');
            if (searchBar) searchBar.classList.add('hidden');
        };

        // Back to scene button in not available message
        const backToSceneBtn = document.getElementById('btn-script-back-to-scene');
        if (backToSceneBtn) {
            backToSceneBtn.onclick = () => this.closeScriptViewer();
        }

        // Close dropdown when clicking outside
        const contentArea = document.getElementById('script-content-area');
        if (contentArea) {
            contentArea.onclick = () => {
                if (this.scriptViewerState.jumpDropdownOpen) {
                    this.closeSceneJumpDropdown();
                }
            };
        }

        // Pinch-to-zoom
        this.bindPinchToZoom();
    },

    /**
     * Bind pinch-to-zoom functionality
     */
    bindPinchToZoom() {
        const contentArea = document.getElementById('script-content-area');
        if (!contentArea) return;

        let initialDistance = 0;
        let currentZoom = this.scriptViewerState.zoomLevel;
        const zoomLevels = ['small', 'normal', 'large', 'xlarge'];

        contentArea.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: true });

        contentArea.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );

                const ratio = currentDistance / initialDistance;
                const currentIndex = zoomLevels.indexOf(currentZoom);

                if (ratio > 1.3 && currentIndex < zoomLevels.length - 1) {
                    currentZoom = zoomLevels[currentIndex + 1];
                    this.setZoomLevel(currentZoom);
                    initialDistance = currentDistance;
                } else if (ratio < 0.7 && currentIndex > 0) {
                    currentZoom = zoomLevels[currentIndex - 1];
                    this.setZoomLevel(currentZoom);
                    initialDistance = currentDistance;
                }
            }
        }, { passive: true });
    },

    /**
     * Set zoom level
     */
    setZoomLevel(level) {
        const contentArea = document.getElementById('script-content-area');
        if (!contentArea) return;

        // Remove all zoom classes
        contentArea.classList.remove('zoom-small', 'zoom-normal', 'zoom-large', 'zoom-xlarge');

        // Add new zoom class
        contentArea.classList.add(`zoom-${level}`);

        this.scriptViewerState.zoomLevel = level;

        // Show zoom hint briefly
        this.showZoomHint(level);
    },

    /**
     * Show zoom level hint
     */
    showZoomHint(level) {
        let hint = document.querySelector('.zoom-hint');

        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'zoom-hint';
            document.getElementById('screen-script-viewer').appendChild(hint);
        }

        const labels = {
            'small': 'Small Text',
            'normal': 'Normal Text',
            'large': 'Large Text',
            'xlarge': 'Extra Large Text'
        };

        hint.textContent = labels[level] || level;
        hint.classList.add('visible');

        setTimeout(() => {
            hint.classList.remove('visible');
        }, 1500);
    },

    /**
     * Helper: Escape HTML for safe rendering
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    async renderLookbooks() {
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

        // Build lookbook content for each character
        const lookbookHTML = [];

        for (const char of this.characters) {
            // Get all photos for this character
            const photos = await PhotoStorage.getPhotosForCharacter(char.name);

            // Group photos by scene
            const photosByScene = {};
            photos.forEach(photo => {
                if (!photosByScene[photo.sceneIndex]) {
                    photosByScene[photo.sceneIndex] = [];
                }
                photosByScene[photo.sceneIndex].push(photo);
            });

            const sceneCount = Object.keys(photosByScene).length;
            const photoCount = photos.length;

            lookbookHTML.push(`
                <div class="lookbook-character" data-character="${char.name}">
                    <div class="lookbook-character-header">
                        <h3 class="lookbook-character-name">${char.name}</h3>
                        <span class="lookbook-photo-count">${photoCount} photo${photoCount !== 1 ? 's' : ''}</span>
                    </div>
                    ${photoCount > 0 ? `
                        <div class="lookbook-photo-grid" data-character="${char.name}">
                            ${photos.map(photo => {
                                const scene = this.scenes.find(s => s.index === photo.sceneIndex);
                                return `
                                    <div class="lookbook-photo" data-photo-id="${photo.id}">
                                        <img src="${photo.data}" alt="${photo.angle} view">
                                        <div class="lookbook-photo-overlay">
                                            <span class="lookbook-photo-scene">Sc ${scene?.number || photo.sceneIndex + 1}</span>
                                            <span class="lookbook-photo-angle">${photo.angle.toUpperCase()}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <p class="lookbook-scenes-info">${sceneCount} scene${sceneCount !== 1 ? 's' : ''} captured</p>
                    ` : `
                        <div class="lookbook-empty">
                            <p>No photos captured yet</p>
                            <span class="tag">Scenes ${this.formatSceneRange(char.sceneIndices)}</span>
                        </div>
                    `}
                </div>
            `);
        }

        container.innerHTML = lookbookHTML.join('');
        if (countEl) countEl.textContent = this.characters.length;

        // Bind photo click events for full-screen viewing
        this.bindLookbookPhotos();
    },

    /**
     * Bind lookbook photo click events
     */
    bindLookbookPhotos() {
        const photos = document.querySelectorAll('.lookbook-photo');
        photos.forEach(photoEl => {
            photoEl.addEventListener('click', async () => {
                const photoId = parseInt(photoEl.dataset.photoId);
                const characterName = photoEl.closest('.lookbook-photo-grid')?.dataset.character;

                // Get photo data
                const allPhotos = await PhotoStorage.getPhotosForCharacter(characterName);
                const photo = allPhotos.find(p => p.id === photoId);

                if (photo) {
                    const scene = this.scenes.find(s => s.index === photo.sceneIndex);
                    this.openPhotoViewer(
                        photo.data,
                        `${characterName} - Scene ${scene?.number || photo.sceneIndex + 1}`,
                        `${photo.angle.toUpperCase()} view`
                    );
                }
            });
        });
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
    async updateSettings() {
        const projectNameEl = document.getElementById('settings-project-name');
        const sceneCountEl = document.getElementById('settings-scene-count');
        const characterCountEl = document.getElementById('settings-character-count');
        const photoCountEl = document.getElementById('photo-count');
        const storageUsedEl = document.getElementById('storage-used');
        const storageFillEl = document.getElementById('storage-fill');

        if (projectNameEl) projectNameEl.textContent = this.project.name;
        if (sceneCountEl) sceneCountEl.textContent = this.scenes.length;
        if (characterCountEl) characterCountEl.textContent = this.characters.length;

        // Update photo storage stats
        try {
            const photoCount = await PhotoStorage.getPhotoCount();
            if (photoCountEl) photoCountEl.textContent = photoCount;
            if (storageUsedEl) storageUsedEl.textContent = photoCount;

            // Update storage bar (100 photos = 100% for free tier)
            const percentage = Math.min((photoCount / 100) * 100, 100);
            if (storageFillEl) storageFillEl.style.width = `${percentage}%`;
        } catch (error) {
            console.error('Error getting photo stats:', error);
        }
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
    // TIMESHEET - QUICK ENTRY
    // ============================================

    /**
     * Bind timesheet calculation for quick entry
     */
    bindTimesheetCalculation() {
        const precall = document.getElementById('ts-precall');
        const unitcall = document.getElementById('ts-unitcall');
        const wrap = document.getElementById('ts-wrap');
        const totalEl = document.getElementById('ts-total-hours');
        const breakdownEl = document.getElementById('ts-hours-breakdown');

        const calculateTotal = () => {
            if (!precall || !unitcall || !wrap) return;

            const pre = precall.value.split(':').map(Number);
            const unit = unitcall.value.split(':').map(Number);
            const wrapTime = wrap.value.split(':').map(Number);

            const preMinutes = pre[0] * 60 + pre[1];
            const unitMinutes = unit[0] * 60 + unit[1];
            let wrapMinutes = wrapTime[0] * 60 + wrapTime[1];

            // Handle overnight wrap
            if (wrapMinutes < preMinutes) wrapMinutes += 24 * 60;

            // Pre-call time (before unit call)
            const precallDuration = Math.max(0, unitMinutes - preMinutes) / 60;

            // Total worked time from unit call to wrap
            const workedMinutes = wrapMinutes - unitMinutes;
            const workedHours = workedMinutes / 60;

            // Standard 30 min meal break (can be adjusted)
            const breakMinutes = 30;
            const breakHours = breakMinutes / 60;

            // Total hours including pre-call
            const totalHours = precallDuration + workedHours - breakHours;

            if (totalEl) {
                totalEl.textContent = totalHours.toFixed(1);
            }

            if (breakdownEl) {
                breakdownEl.textContent = `Pre-call: ${precallDuration.toFixed(1)} | Worked: ${workedHours.toFixed(1)} | Break: ${breakHours.toFixed(1)}`;
            }

            // Update earnings display if rate card is set
            this.updateDayEarningsDisplay();
        };

        if (precall) precall.addEventListener('change', calculateTotal);
        if (unitcall) unitcall.addEventListener('change', calculateTotal);
        if (wrap) wrap.addEventListener('change', calculateTotal);

        // Also listen to 6th day toggle for earnings
        const sixthDayBtn = document.getElementById('ts-sixth-day');
        if (sixthDayBtn) {
            sixthDayBtn.addEventListener('click', () => {
                setTimeout(() => this.updateDayEarningsDisplay(), 10);
            });
        }

        // Calculate initial value
        calculateTotal();
    },

    /**
     * Update the day earnings display
     */
    updateDayEarningsDisplay() {
        const earningsCard = document.getElementById('day-earnings');
        if (!earningsCard) return;

        // Only show if rate card is configured
        if (this.rateCard.dailyRate <= 0) {
            earningsCard.style.display = 'none';
            return;
        }

        // Build a temporary entry from current form values
        const precall = document.getElementById('ts-precall');
        const unitcall = document.getElementById('ts-unitcall');
        const wrap = document.getElementById('ts-wrap');
        const sixthDayBtn = document.getElementById('ts-sixth-day');
        const brokenLunchBtn = document.getElementById('ts-broken-lunch');

        const entry = {
            precall: precall?.value || '',
            unitcall: unitcall?.value || '',
            wrap: wrap?.value || '',
            sixthDay: sixthDayBtn?.classList.contains('active') || false,
            brokenLunch: brokenLunchBtn?.classList.contains('active') || false
        };

        // Calculate earnings
        const earnings = this.calculateEntryEarnings(entry);

        // Show or hide card based on whether times are entered
        if (!entry.unitcall || !entry.wrap) {
            earningsCard.style.display = 'none';
            return;
        }

        earningsCard.style.display = 'block';

        // Update display elements
        const basePay = document.getElementById('day-base-pay');
        const otPay = document.getElementById('day-ot-pay');
        const sixthPay = document.getElementById('day-sixth-pay');
        const kitPay = document.getElementById('day-kit-pay');
        const totalPay = document.getElementById('day-total-pay');

        if (basePay) basePay.textContent = `£${earnings.dailyEarnings.toFixed(2)}`;
        if (otPay) otPay.textContent = `£${earnings.otEarnings.toFixed(2)}`;
        if (sixthPay) sixthPay.textContent = `£${earnings.sixthDayBonus.toFixed(2)}`;
        if (kitPay) kitPay.textContent = `£${earnings.kitRental.toFixed(2)}`;
        if (totalPay) totalPay.textContent = `£${earnings.totalEarnings.toFixed(2)}`;
    },

    /**
     * Bind timesheet event handlers
     */
    bindTimesheetEvents() {
        // Save entry button (new quick entry)
        const saveBtn = document.getElementById('btn-save-timesheet');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveQuickTimesheetEntry());
        }

        // Toggle buttons
        const sixthDayBtn = document.getElementById('ts-sixth-day');
        const brokenLunchBtn = document.getElementById('ts-broken-lunch');

        if (sixthDayBtn) {
            sixthDayBtn.addEventListener('click', () => {
                sixthDayBtn.classList.toggle('active');
            });
        }

        if (brokenLunchBtn) {
            brokenLunchBtn.addEventListener('click', () => {
                brokenLunchBtn.classList.toggle('active');
            });
        }

        // Date navigation
        const prevDayBtn = document.getElementById('ts-prev-day');
        const nextDayBtn = document.getElementById('ts-next-day');
        const dateDisplay = document.querySelector('.date-display');
        const dateInput = document.getElementById('ts-date-input');

        if (prevDayBtn) {
            prevDayBtn.addEventListener('click', () => this.changeTimesheetDate(-1));
        }

        if (nextDayBtn) {
            nextDayBtn.addEventListener('click', () => this.changeTimesheetDate(1));
        }

        if (dateDisplay && dateInput) {
            dateDisplay.addEventListener('click', () => {
                dateInput.showPicker?.() || dateInput.click();
            });

            dateInput.addEventListener('change', (e) => {
                this.timesheetSelectedDate = new Date(e.target.value + 'T00:00:00');
                this.updateTimesheetDateDisplay();
                this.loadEntryForDate(this.timesheetSelectedDate);
            });
        }

        // Export button
        const exportBtn = document.getElementById('btn-export-timesheet');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.showExportSheet());
        }

        // Export action sheet handlers
        this.bindExportActions();

        // Load saved timesheets
        this.loadTimesheets();
    },

    /**
     * Initialize quick entry timesheet screen
     */
    initQuickEntryTimesheet() {
        // Set selected date to today if not set
        if (!this.timesheetSelectedDate) {
            this.timesheetSelectedDate = new Date();
            this.timesheetSelectedDate.setHours(0, 0, 0, 0);
        }

        // Update date display
        this.updateTimesheetDateDisplay();

        // Load entry for selected date if exists
        this.loadEntryForDate(this.timesheetSelectedDate);

        // Render week view
        this.renderWeekView();

        // Bind time input listeners
        this.bindTimesheetCalculation();

        // Reset toggle states
        const sixthDayBtn = document.getElementById('ts-sixth-day');
        const brokenLunchBtn = document.getElementById('ts-broken-lunch');
        if (sixthDayBtn) sixthDayBtn.classList.remove('active');
        if (brokenLunchBtn) brokenLunchBtn.classList.remove('active');
    },

    /**
     * Update timesheet date display
     */
    updateTimesheetDateDisplay() {
        const dayEl = document.getElementById('ts-date-day');
        const fullEl = document.getElementById('ts-date-full');
        const shootDayEl = document.getElementById('ts-shoot-day');
        const dateInput = document.getElementById('ts-date-input');

        if (!this.timesheetSelectedDate) return;

        const date = this.timesheetSelectedDate;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const fullDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        if (dayEl) dayEl.textContent = dayName;
        if (fullEl) fullEl.textContent = fullDate;
        if (dateInput) dateInput.value = date.toISOString().split('T')[0];

        // Calculate shoot day
        const shootDay = this.timesheetEntries.length + 1;
        if (shootDayEl) shootDayEl.textContent = `Day ${shootDay}`;
    },

    /**
     * Change timesheet date by offset
     */
    changeTimesheetDate(offset) {
        if (!this.timesheetSelectedDate) {
            this.timesheetSelectedDate = new Date();
        }

        this.timesheetSelectedDate.setDate(this.timesheetSelectedDate.getDate() + offset);
        this.updateTimesheetDateDisplay();
        this.loadEntryForDate(this.timesheetSelectedDate);
        this.renderWeekView();
    },

    /**
     * Load entry for a specific date
     */
    loadEntryForDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        const entry = this.timesheetEntries.find(e => e.date === dateStr);

        const precall = document.getElementById('ts-precall');
        const unitcall = document.getElementById('ts-unitcall');
        const wrap = document.getElementById('ts-wrap');
        const notes = document.getElementById('ts-notes');
        const sixthDayBtn = document.getElementById('ts-sixth-day');
        const brokenLunchBtn = document.getElementById('ts-broken-lunch');
        const shootDayEl = document.getElementById('ts-shoot-day');

        if (entry) {
            // Load existing entry
            if (precall) precall.value = entry.preCall || '05:30';
            if (unitcall) unitcall.value = entry.unitCall || entry.callTime || '06:00';
            if (wrap) wrap.value = entry.wrap || entry.wrapTime || '18:00';
            if (notes) notes.value = entry.notes || '';
            if (sixthDayBtn) sixthDayBtn.classList.toggle('active', entry.sixthDay || false);
            if (brokenLunchBtn) brokenLunchBtn.classList.toggle('active', entry.brokenLunch || false);
            if (shootDayEl) shootDayEl.textContent = entry.shootDay || `Day ${this.timesheetEntries.indexOf(entry) + 1}`;
        } else {
            // Reset to defaults
            if (precall) precall.value = '05:30';
            if (unitcall) unitcall.value = '06:00';
            if (wrap) wrap.value = '18:00';
            if (notes) notes.value = '';
            if (sixthDayBtn) sixthDayBtn.classList.remove('active');
            if (brokenLunchBtn) brokenLunchBtn.classList.remove('active');
            if (shootDayEl) shootDayEl.textContent = `Day ${this.timesheetEntries.length + 1}`;
        }

        // Recalculate
        this.bindTimesheetCalculation();
    },

    /**
     * Render week view grid
     */
    renderWeekView() {
        const container = document.getElementById('week-grid');
        const weekTotalEl = document.getElementById('week-total-hours');
        const weekEarningsContainer = document.getElementById('week-total-earnings');
        const weekEarningsValue = document.getElementById('week-earnings-value');
        if (!container) return;

        // Get start of current week (Sunday)
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        let weekTotal = 0;
        let weekEarnings = 0;

        container.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dateStr = dayDate.toISOString().split('T')[0];

            // Find entry for this day
            const entry = this.timesheetEntries.find(e => e.date === dateStr);
            const hours = entry?.totalHours || 0;
            if (hours) weekTotal += hours;

            // Calculate earnings for this entry
            if (entry && this.rateCard.dailyRate > 0) {
                const earnings = this.calculateEntryEarnings(entry);
                weekEarnings += earnings.totalEarnings;
            }

            const isToday = dayDate.toDateString() === today.toDateString();
            const isSelected = this.timesheetSelectedDate &&
                dayDate.toDateString() === this.timesheetSelectedDate.toDateString();

            const dayEl = document.createElement('div');
            dayEl.className = 'week-day';
            if (isToday) dayEl.classList.add('today');
            if (isSelected) dayEl.classList.add('selected');
            if (entry) dayEl.classList.add('has-entry');

            dayEl.innerHTML = `
                <span class="week-day-name">${dayNames[i]}</span>
                <span class="week-day-number">${dayDate.getDate()}</span>
                <span class="week-day-hours">${hours ? hours.toFixed(1) : '-'}</span>
            `;

            dayEl.addEventListener('click', () => {
                this.timesheetSelectedDate = dayDate;
                this.updateTimesheetDateDisplay();
                this.loadEntryForDate(dayDate);
                this.renderWeekView();
            });

            container.appendChild(dayEl);
        }

        if (weekTotalEl) {
            weekTotalEl.textContent = weekTotal.toFixed(1);
        }

        // Update week earnings display
        if (weekEarningsContainer && weekEarningsValue) {
            if (this.rateCard.dailyRate > 0 && weekEarnings > 0) {
                weekEarningsContainer.style.display = 'inline';
                weekEarningsValue.textContent = `£${weekEarnings.toFixed(2)}`;
            } else {
                weekEarningsContainer.style.display = 'none';
            }
        }
    },

    /**
     * Save quick entry timesheet
     */
    saveQuickTimesheetEntry() {
        const precall = document.getElementById('ts-precall');
        const unitcall = document.getElementById('ts-unitcall');
        const wrap = document.getElementById('ts-wrap');
        const notes = document.getElementById('ts-notes');
        const totalEl = document.getElementById('ts-total-hours');
        const sixthDayBtn = document.getElementById('ts-sixth-day');
        const brokenLunchBtn = document.getElementById('ts-broken-lunch');
        const shootDayEl = document.getElementById('ts-shoot-day');

        if (!this.timesheetSelectedDate) {
            this.showToast('Please select a date');
            return;
        }

        const dateStr = this.timesheetSelectedDate.toISOString().split('T')[0];

        const entry = {
            id: Date.now(),
            date: dateStr,
            shootDay: shootDayEl?.textContent || '',
            preCall: precall?.value || '05:30',
            unitCall: unitcall?.value || '06:00',
            callTime: unitcall?.value || '06:00', // For backwards compatibility
            wrap: wrap?.value || '18:00',
            wrapTime: wrap?.value || '18:00', // For backwards compatibility
            sixthDay: sixthDayBtn?.classList.contains('active') || false,
            brokenLunch: brokenLunchBtn?.classList.contains('active') || false,
            totalHours: parseFloat(totalEl?.textContent) || 0,
            notes: notes?.value || '',
            status: 'pending',
            synced: false
        };

        // Check for existing entry for this date
        const existingIndex = this.timesheetEntries.findIndex(e => e.date === dateStr);
        if (existingIndex >= 0) {
            // Update existing
            entry.id = this.timesheetEntries[existingIndex].id;
            this.timesheetEntries[existingIndex] = entry;
            this.showToast('Entry updated');
        } else {
            // Add new
            this.timesheetEntries.push(entry);
            this.showToast('Entry saved');
        }

        // Sort by date
        this.timesheetEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Save to storage
        this.saveTimesheets();

        // Re-render week view
        this.renderWeekView();
    },

    /**
     * Bind export action sheet events
     */
    bindExportActions() {
        const actionSheet = document.getElementById('export-action-sheet');
        const backdrop = actionSheet?.querySelector('.action-sheet-backdrop');
        const cancelBtn = document.getElementById('export-cancel');
        const csvBtn = document.getElementById('export-csv');
        const pdfBtn = document.getElementById('export-pdf');
        const shareBtn = document.getElementById('export-share');

        // Close on backdrop click
        if (backdrop) {
            backdrop.addEventListener('click', () => this.hideExportSheet());
        }

        // Close on cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideExportSheet());
        }

        // Export handlers
        if (csvBtn) {
            csvBtn.addEventListener('click', () => this.exportTimesheetCSV());
        }

        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.exportTimesheetPDF());
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareTimesheet());
        }
    },

    /**
     * Show export action sheet
     */
    showExportSheet() {
        if (this.timesheetEntries.length === 0) {
            this.showToast('No timesheet entries to export');
            return;
        }

        const actionSheet = document.getElementById('export-action-sheet');
        if (actionSheet) {
            actionSheet.classList.add('active');
        }
    },

    /**
     * Hide export action sheet
     */
    hideExportSheet() {
        const actionSheet = document.getElementById('export-action-sheet');
        if (actionSheet) {
            actionSheet.classList.remove('active');
        }
    },

    /**
     * Export timesheet as CSV
     */
    exportTimesheetCSV() {
        this.hideExportSheet();

        // Build CSV content
        const headers = ['Date', 'Shoot Day', 'Call Time', 'Wrap Time', 'Meal Break (min)', 'Total Hours', 'Status', 'Notes'];
        const rows = this.timesheetEntries.map(entry => {
            const date = new Date(entry.date + 'T00:00:00');
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            return [
                formattedDate,
                entry.shootDay || '',
                entry.callTime,
                entry.wrapTime,
                entry.mealBreak,
                entry.totalHours.toFixed(2),
                entry.status,
                (entry.notes || '').replace(/"/g, '""') // Escape quotes
            ];
        });

        // Add totals row
        const totalHours = this.timesheetEntries.reduce((sum, e) => sum + e.totalHours, 0);
        rows.push(['', '', '', '', 'TOTAL:', totalHours.toFixed(2), '', '']);

        // Create CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download file
        this.downloadFile(csvContent, `timesheet-${this.getDateString()}.csv`, 'text/csv');
        this.showToast('CSV exported successfully');
    },

    /**
     * Export timesheet as PDF (HTML-based printable format)
     */
    exportTimesheetPDF() {
        this.hideExportSheet();

        // Calculate totals
        const totalHours = this.timesheetEntries.reduce((sum, e) => sum + e.totalHours, 0);
        const totalDays = this.timesheetEntries.length;

        // Build HTML content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Timesheet Report - ${this.project.name}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { margin-bottom: 30px; border-bottom: 2px solid #C9A961; padding-bottom: 20px; }
        .header h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 5px; }
        .header p { font-size: 14px; color: #666; }
        .summary { display: flex; gap: 40px; margin-bottom: 30px; }
        .summary-item { }
        .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .summary-value { font-size: 28px; font-weight: 700; color: #C9A961; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background-color: #f5f5f5; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        .status.pending { background: #fff3cd; color: #856404; }
        .status.approved { background: #d4edda; color: #155724; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Timesheet Report</h1>
        <p>${this.project.name} | Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <p class="summary-label">Total Days</p>
            <p class="summary-value">${totalDays}</p>
        </div>
        <div class="summary-item">
            <p class="summary-label">Total Hours</p>
            <p class="summary-value">${totalHours.toFixed(1)}</p>
        </div>
        <div class="summary-item">
            <p class="summary-label">Avg Hours/Day</p>
            <p class="summary-value">${totalDays > 0 ? (totalHours / totalDays).toFixed(1) : '0'}</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Shoot Day</th>
                <th>Call Time</th>
                <th>Wrap Time</th>
                <th>Break</th>
                <th>Hours</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${this.timesheetEntries.map(entry => {
                const date = new Date(entry.date + 'T00:00:00');
                return `
                    <tr>
                        <td>${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                        <td>${entry.shootDay || '-'}</td>
                        <td>${entry.callTime}</td>
                        <td>${entry.wrapTime}</td>
                        <td>${entry.mealBreak} min</td>
                        <td><strong>${entry.totalHours.toFixed(1)}</strong></td>
                        <td><span class="status ${entry.status}">${entry.status}</span></td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>Hair & Makeup Pro | Timesheet Report</p>
    </div>

    <script class="no-print">
        window.onload = function() { window.print(); }
    </script>
</body>
</html>`;

        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            this.showToast('PDF report opened for printing');
        } else {
            this.showToast('Please allow popups to export PDF');
        }
    },

    /**
     * Share timesheet using Web Share API
     */
    async shareTimesheet() {
        this.hideExportSheet();

        // Build share text
        const totalHours = this.timesheetEntries.reduce((sum, e) => sum + e.totalHours, 0);
        const totalDays = this.timesheetEntries.length;

        let shareText = `Timesheet Summary - ${this.project.name}\n\n`;
        shareText += `Total Days: ${totalDays}\n`;
        shareText += `Total Hours: ${totalHours.toFixed(1)}\n\n`;
        shareText += `Daily Breakdown:\n`;

        this.timesheetEntries.forEach(entry => {
            const date = new Date(entry.date + 'T00:00:00');
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            shareText += `${dateStr} (${entry.shootDay || '-'}): ${entry.totalHours.toFixed(1)} hrs\n`;
        });

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Timesheet Report',
                    text: shareText
                });
                this.showToast('Shared successfully');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                    this.copyToClipboard(shareText);
                }
            }
        } else {
            // Fallback: copy to clipboard
            this.copyToClipboard(shareText);
        }
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('Could not copy to clipboard');
        }
    },

    /**
     * Download a file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    /**
     * Get current date as string for filenames
     */
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    /**
     * Export lookbook as HTML gallery
     */
    async exportLookbook() {
        if (this.characters.length === 0) {
            this.showToast('No characters to export');
            return;
        }

        this.showToast('Generating lookbook...');

        try {
            // Gather all photos for each character
            const characterPhotos = [];

            for (const character of this.characters) {
                const photos = await PhotoStorage.getPhotosForCharacter(character.name);
                if (photos.length > 0) {
                    characterPhotos.push({
                        name: character.name,
                        photos: photos
                    });
                }
            }

            if (characterPhotos.length === 0) {
                this.showToast('No photos to export');
                return;
            }

            // Build HTML gallery
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Lookbook - ${this.project.name}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; }
        .header { background: linear-gradient(135deg, #C9A961 0%, #B8994F 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 5px; }
        .header p { opacity: 0.9; }
        .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
        .character-section { background: white; border-radius: 12px; margin-bottom: 30px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .character-header { padding: 20px; border-bottom: 1px solid #eee; }
        .character-header h2 { font-size: 20px; color: #1a1a1a; }
        .character-header span { font-size: 14px; color: #666; }
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; padding: 20px; }
        .photo-card { border-radius: 8px; overflow: hidden; background: #f9f9f9; }
        .photo-card img { width: 100%; height: 200px; object-fit: cover; display: block; }
        .photo-info { padding: 10px; }
        .photo-info .angle { font-weight: 600; color: #1a1a1a; text-transform: capitalize; }
        .photo-info .scene { font-size: 12px; color: #666; }
        .footer { text-align: center; padding: 30px; color: #999; font-size: 12px; }
        @media print {
            .character-section { break-inside: avoid; }
            .photo-grid { grid-template-columns: repeat(3, 1fr); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.project.name}</h1>
        <p>Character Lookbook | Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>

    <div class="container">
        ${characterPhotos.map(char => `
            <div class="character-section">
                <div class="character-header">
                    <h2>${char.name}</h2>
                    <span>${char.photos.length} photo${char.photos.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="photo-grid">
                    ${char.photos.map(photo => `
                        <div class="photo-card">
                            <img src="${photo.imageData}" alt="${photo.angle}">
                            <div class="photo-info">
                                <p class="angle">${photo.angle}</p>
                                <p class="scene">Scene ${photo.sceneIndex + 1}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        <p>Hair & Makeup Pro | Character Lookbook</p>
    </div>
</body>
</html>`;

            // Open in new window
            const galleryWindow = window.open('', '_blank');
            if (galleryWindow) {
                galleryWindow.document.write(htmlContent);
                galleryWindow.document.close();
                this.showToast('Lookbook exported');
            } else {
                this.showToast('Please allow popups to export');
            }
        } catch (error) {
            console.error('Error exporting lookbook:', error);
            this.showToast('Error exporting lookbook');
        }
    },

    /**
     * Save timesheets to localStorage
     */
    saveTimesheets() {
        localStorage.setItem(this.STORAGE_KEYS.TIMESHEETS, JSON.stringify(this.timesheetEntries));
    },

    /**
     * Load timesheets from localStorage
     */
    loadTimesheets() {
        const saved = localStorage.getItem(this.STORAGE_KEYS.TIMESHEETS);
        if (saved) {
            try {
                this.timesheetEntries = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading timesheets:', e);
                this.timesheetEntries = [];
            }
        }
    },

    /**
     * Render the timesheet history list
     */
    renderTimesheetHistory() {
        const container = document.getElementById('timesheet-list');
        const weeklyHoursEl = document.getElementById('weekly-hours');

        if (!container) return;

        // Get filtered entries
        const filteredEntries = this.getFilteredTimesheets();

        // Calculate total hours for display
        const totalHours = filteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
        if (weeklyHoursEl) {
            weeklyHoursEl.textContent = totalHours.toFixed(1);
        }

        if (filteredEntries.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-icon">
                        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="24" cy="24" r="20"/>
                            <path d="M24 14v12l8 4"/>
                        </svg>
                    </div>
                    <h3 class="empty-title">No Entries Yet</h3>
                    <p class="empty-text">Add your first timesheet entry to track your hours.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredEntries.map(entry => {
            const date = new Date(entry.date + 'T00:00:00');
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Build badges for 6th day and broken lunch
            let badges = '';
            if (entry.sixthDay || entry.brokenLunch) {
                badges = '<div class="entry-badges">';
                if (entry.sixthDay) badges += '<span class="entry-badge sixth-day">6th Day</span>';
                if (entry.brokenLunch) badges += '<span class="entry-badge broken-lunch">Broken Lunch</span>';
                badges += '</div>';
            }

            const callTime = entry.unitCall || entry.callTime;
            const wrapTime = entry.wrap || entry.wrapTime;

            return `
                <div class="timesheet-entry" data-entry-id="${entry.id}">
                    <div class="entry-date">
                        <p class="entry-day">${dayName}</p>
                        <p class="entry-full-date">${fullDate}</p>
                        ${entry.shootDay ? `<span class="entry-shoot-day">${entry.shootDay}</span>` : ''}
                        ${badges}
                    </div>
                    <div class="entry-times">
                        <p class="entry-range">${callTime} - ${wrapTime}</p>
                        <p class="entry-hours">${entry.totalHours.toFixed(1)} hours</p>
                    </div>
                    <div class="entry-status ${entry.status}">${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</div>
                </div>
            `;
        }).join('');

        // Bind entry clicks for editing (navigates to quick entry with that date)
        container.querySelectorAll('.timesheet-entry').forEach(entryEl => {
            entryEl.addEventListener('click', () => {
                const entryId = parseInt(entryEl.dataset.entryId);
                this.editTimesheetEntry(entryId);
            });
        });

        // Bind filter pills
        this.bindTimesheetFilters();
    },

    /**
     * Get filtered timesheet entries
     */
    getFilteredTimesheets() {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfLastWeek = new Date(startOfWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return this.timesheetEntries.filter(entry => {
            const entryDate = new Date(entry.date + 'T00:00:00');

            switch (this.timesheetFilter) {
                case 'this-week':
                    return entryDate >= startOfWeek;
                case 'last-week':
                    return entryDate >= startOfLastWeek && entryDate < startOfWeek;
                case 'this-month':
                    return entryDate >= startOfMonth;
                default:
                    return true;
            }
        });
    },

    /**
     * Bind timesheet filter pills
     */
    bindTimesheetFilters() {
        const filterPills = document.querySelectorAll('#screen-timesheet-history .filter-pills .pill');
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                // Update active state
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                // Update filter and re-render
                this.timesheetFilter = pill.dataset.filter;
                this.renderTimesheetHistory();
            });
        });
    },

    /**
     * Edit an existing timesheet entry (go to quick entry screen with that date)
     */
    editTimesheetEntry(entryId) {
        const entry = this.timesheetEntries.find(e => e.id === entryId);
        if (!entry) return;

        // Set selected date and navigate to quick entry
        this.timesheetSelectedDate = new Date(entry.date + 'T00:00:00');
        this.navigateTo('screen-timesheet');
    },

    // ============================================
    // RATE CARD MANAGEMENT
    // ============================================

    /**
     * Bind rate card input events
     */
    bindRateCardEvents() {
        const dailyRateInput = document.getElementById('rate-daily-rate');
        const baseDaySelect = document.getElementById('rate-base-day');
        const kitRentalInput = document.getElementById('rate-kit-rental');

        if (dailyRateInput) {
            dailyRateInput.addEventListener('change', () => this.updateRateCard());
            dailyRateInput.addEventListener('input', () => this.updateRateSummary());
        }

        if (baseDaySelect) {
            baseDaySelect.addEventListener('change', () => this.updateRateCard());
        }

        if (kitRentalInput) {
            kitRentalInput.addEventListener('change', () => this.updateRateCard());
            kitRentalInput.addEventListener('input', () => this.updateRateSummary());
        }
    },

    /**
     * Load rate card from storage
     */
    loadRateCard() {
        const saved = localStorage.getItem(this.STORAGE_KEYS.RATE_CARD);
        if (saved) {
            try {
                this.rateCard = { ...this.rateCard, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Error loading rate card:', e);
            }
        }

        // Populate form fields
        const dailyRateInput = document.getElementById('rate-daily-rate');
        const baseDaySelect = document.getElementById('rate-base-day');
        const kitRentalInput = document.getElementById('rate-kit-rental');

        if (dailyRateInput && this.rateCard.dailyRate > 0) {
            dailyRateInput.value = this.rateCard.dailyRate;
        }
        if (baseDaySelect) {
            baseDaySelect.value = this.rateCard.baseDayHours;
        }
        if (kitRentalInput && this.rateCard.kitRental > 0) {
            kitRentalInput.value = this.rateCard.kitRental;
        }

        this.updateRateSummary();
    },

    /**
     * Update rate card from form inputs
     */
    updateRateCard() {
        const dailyRateInput = document.getElementById('rate-daily-rate');
        const baseDaySelect = document.getElementById('rate-base-day');
        const kitRentalInput = document.getElementById('rate-kit-rental');

        if (dailyRateInput) {
            this.rateCard.dailyRate = parseFloat(dailyRateInput.value) || 0;
        }
        if (baseDaySelect) {
            this.rateCard.baseDayHours = parseInt(baseDaySelect.value, 10) || 11;
        }
        if (kitRentalInput) {
            this.rateCard.kitRental = parseFloat(kitRentalInput.value) || 0;
        }

        // Save to localStorage
        localStorage.setItem(this.STORAGE_KEYS.RATE_CARD, JSON.stringify(this.rateCard));

        this.updateRateSummary();
    },

    /**
     * Update the rate summary display
     */
    updateRateSummary() {
        const summaryEl = document.getElementById('rate-summary');
        const hourlyEl = document.getElementById('rate-hourly');
        const otHourlyEl = document.getElementById('rate-ot-hourly');
        const maxDayEl = document.getElementById('rate-max-day');

        if (!summaryEl) return;

        if (this.rateCard.dailyRate > 0) {
            summaryEl.style.display = 'block';

            const hourlyRate = this.rateCard.dailyRate / this.rateCard.baseDayHours;
            const otRate = hourlyRate * this.rateCard.otMultiplier;
            const maxDay = this.rateCard.dailyRate + this.rateCard.kitRental;

            if (hourlyEl) hourlyEl.textContent = `£${hourlyRate.toFixed(2)}/hr`;
            if (otHourlyEl) otHourlyEl.textContent = `£${otRate.toFixed(2)}/hr`;
            if (maxDayEl) maxDayEl.textContent = `£${maxDay.toFixed(2)}`;
        } else {
            summaryEl.style.display = 'none';
        }
    },

    /**
     * Calculate earnings for a timesheet entry
     */
    calculateEntryEarnings(entry) {
        // Support both camelCase (saved data) and lowercase (legacy) property names
        const unitCall = entry.unitCall || entry.unitcall;
        const preCall = entry.preCall || entry.precall;

        if (!entry || !unitCall || !entry.wrap) {
            return {
                preCallHours: 0,
                workingHours: 0,
                baseHours: 0,
                otHours: 0,
                totalHours: 0,
                dailyEarnings: 0,
                otEarnings: 0,
                sixthDayBonus: 0,
                kitRental: 0,
                totalEarnings: 0
            };
        }

        const parseTime = (timeStr) => {
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours + (minutes / 60);
        };

        const getHoursDiff = (startTime, endTime) => {
            const start = parseTime(startTime);
            const end = parseTime(endTime);
            if (start === null || end === null) return 0;
            return end >= start ? end - start : (24 - start) + end;
        };

        // Calculate hours
        const preCallHours = preCall ? getHoursDiff(preCall, unitCall) : 0;
        const lunchDeduction = entry.brokenLunch ? 0.5 : 1;
        const rawWorkingHours = getHoursDiff(unitCall, entry.wrap);
        const workingHours = Math.max(0, rawWorkingHours - lunchDeduction);
        const totalHours = preCallHours + workingHours;

        // Calculate OT
        const baseHours = Math.min(workingHours, this.rateCard.baseDayHours);
        const otHours = Math.max(0, workingHours - this.rateCard.baseDayHours);

        // Calculate earnings
        const hourlyRate = this.rateCard.dailyRate / this.rateCard.baseDayHours;
        const dailyEarnings = this.rateCard.dailyRate;
        const otEarnings = otHours * hourlyRate * this.rateCard.otMultiplier;
        const kitRental = this.rateCard.kitRental;

        // 6th day bonus
        const sixthDayBonus = entry.sixthDay
            ? dailyEarnings * (this.rateCard.sixthDayMultiplier - 1)
            : 0;

        const totalEarnings = dailyEarnings + otEarnings + sixthDayBonus + kitRental;

        return {
            preCallHours,
            workingHours,
            baseHours,
            otHours,
            totalHours,
            dailyEarnings,
            otEarnings,
            sixthDayBonus,
            kitRental,
            totalEarnings
        };
    },

    // ============================================
    // PHOTO CAPTURE (Stage 4)
    // ============================================

    /**
     * Bind photo capture events
     */
    bindPhotoCapture() {
        // Camera input change handler
        const cameraInput = document.getElementById('camera-input');
        if (cameraInput) {
            cameraInput.addEventListener('change', (e) => this.handleCameraCapture(e));
        }

        // Mark complete button
        const markCompleteBtn = document.getElementById('btn-mark-complete');
        if (markCompleteBtn) {
            markCompleteBtn.addEventListener('click', () => this.markSceneComplete());
        }
    },

    /**
     * Initialize photo capture screen
     */
    async initPhotoCapture() {
        const scene = this.scenes[this.currentSceneIndex];
        const character = this.characters.find(c => c.name === this.currentCharacterName);

        if (!scene || !character) {
            console.error('Missing scene or character for photo capture');
            return;
        }

        // Update context banner
        const captureCharacter = document.querySelector('.capture-character');
        const captureScene = document.querySelector('.capture-scene');
        const captureLook = document.querySelector('.capture-look');

        if (captureCharacter) captureCharacter.textContent = character.name;
        if (captureScene) captureScene.textContent = `Scene ${scene.number}`;
        if (captureLook) captureLook.textContent = 'Default Look';

        // Load existing photos and render grid
        await this.renderPhotoGrid();

        // Bind photo slot clicks
        this.bindPhotoSlots();

        // Load reference photo from previous scenes
        await this.loadReferencePhoto();

        // Load existing notes
        const notesTextarea = document.getElementById('scene-notes');
        if (notesTextarea) {
            const existingNotes = this.loadSceneNotes(this.currentSceneIndex, this.currentCharacterName);
            notesTextarea.value = existingNotes;

            // Auto-save notes on blur
            notesTextarea.addEventListener('blur', () => {
                this.saveSceneNotes(this.currentSceneIndex, this.currentCharacterName, notesTextarea.value);
                this.showToast('Notes saved');
            });
        }
    },

    /**
     * Load reference photo from previous scenes
     */
    async loadReferencePhoto() {
        const referenceSection = document.getElementById('reference-section');
        const referenceCard = document.getElementById('reference-card');
        const referenceImg = document.getElementById('reference-photo-img');
        const referenceScene = document.getElementById('reference-scene');

        if (!referenceSection || !referenceImg) return;

        // Get the most recent photo for this character from earlier scenes
        const referencePhoto = await PhotoStorage.getMostRecentPhoto(
            this.currentCharacterName,
            this.currentSceneIndex
        );

        if (referencePhoto) {
            // Show the reference section
            referenceSection.style.display = 'block';
            referenceImg.src = referencePhoto.data;

            // Find the scene number for display
            const refScene = this.scenes.find(s => s.index === referencePhoto.sceneIndex);
            if (referenceScene) {
                referenceScene.textContent = `Scene ${refScene?.number || referencePhoto.sceneIndex + 1} - ${referencePhoto.angle.toUpperCase()}`;
            }

            // Bind click to open full viewer
            if (referenceCard) {
                referenceCard.onclick = () => {
                    const refScene = this.scenes.find(s => s.index === referencePhoto.sceneIndex);
                    this.openPhotoViewer(
                        referencePhoto.data,
                        `${this.currentCharacterName} - Scene ${refScene?.number || ''}`,
                        `${referencePhoto.angle.toUpperCase()} view from previous scene`
                    );
                };
            }
        } else {
            // Hide the reference section if no previous photos
            referenceSection.style.display = 'none';
        }
    },

    /**
     * Bind photo slot click events
     */
    bindPhotoSlots() {
        const photoSlots = document.querySelectorAll('.photo-slot');
        photoSlots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                // Don't trigger if clicking delete button
                if (e.target.closest('.photo-delete')) return;

                const angle = slot.dataset.angle;
                this.capturePhoto(angle);
            });
        });
    },

    /**
     * Render the photo grid with existing photos
     */
    async renderPhotoGrid() {
        const angles = ['front', 'left', 'right', 'back'];

        for (const angle of angles) {
            const slot = document.querySelector(`.photo-slot[data-angle="${angle}"]`);
            if (!slot) continue;

            // Get existing photo
            const photo = await PhotoStorage.getPhoto(
                this.currentSceneIndex,
                this.currentCharacterName,
                angle
            );

            if (photo) {
                this.showPhotoInSlot(slot, photo);
            } else {
                this.showEmptySlot(slot, angle);
            }
        }
    },

    /**
     * Show a captured photo in a slot
     */
    showPhotoInSlot(slot, photo) {
        slot.classList.add('has-photo');
        slot.innerHTML = `
            <img src="${photo.data}" alt="${photo.angle} view">
            <button class="photo-delete" data-angle="${photo.angle}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        `;

        // Bind delete button
        const deleteBtn = slot.querySelector('.photo-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePhoto(photo.angle);
            });
        }
    },

    /**
     * Show empty slot placeholder
     */
    showEmptySlot(slot, angle) {
        slot.classList.remove('has-photo');
        slot.innerHTML = `
            <div class="photo-placeholder">
                <div class="photo-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                </div>
                <p class="photo-label">${angle.toUpperCase()}</p>
                <p class="photo-hint">Tap to capture</p>
            </div>
        `;
    },

    /**
     * Capture a photo for the specified angle
     */
    capturePhoto(angle) {
        this.currentCaptureAngle = angle;

        const cameraInput = document.getElementById('camera-input');
        if (cameraInput) {
            // Reset input to allow capturing same image again
            cameraInput.value = '';
            cameraInput.click();
        }
    },

    /**
     * Handle camera capture result
     */
    async handleCameraCapture(event) {
        const file = event.target.files[0];
        if (!file || !this.currentCaptureAngle) return;

        try {
            // Convert to base64
            const base64Data = await this.fileToBase64(file);

            // Compress if needed
            const compressedData = await this.compressImage(base64Data);

            // Save to IndexedDB
            await PhotoStorage.savePhoto({
                sceneIndex: this.currentSceneIndex,
                characterName: this.currentCharacterName,
                angle: this.currentCaptureAngle,
                data: compressedData
            });

            // Update the photo grid
            await this.renderPhotoGrid();
            this.bindPhotoSlots();

            // Update scene status
            await this.updateSceneStatuses();

            console.log(`Photo captured for ${this.currentCharacterName} - ${this.currentCaptureAngle}`);
        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Failed to save photo. Please try again.');
        }
    },

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Compress image to reduce storage
     */
    compressImage(base64Data, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if too large
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed JPEG
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            };
            img.src = base64Data;
        });
    },

    /**
     * Delete a photo
     */
    async deletePhoto(angle) {
        const confirmed = confirm(`Delete ${angle} photo?`);
        if (!confirmed) return;

        try {
            await PhotoStorage.deletePhoto(
                this.currentSceneIndex,
                this.currentCharacterName,
                angle
            );

            // Update the photo grid
            await this.renderPhotoGrid();
            this.bindPhotoSlots();

            // Update scene status
            await this.updateSceneStatuses();

            console.log(`Photo deleted: ${angle}`);
        } catch (error) {
            console.error('Error deleting photo:', error);
            alert('Failed to delete photo.');
        }
    },

    /**
     * Mark scene as complete
     */
    async markSceneComplete() {
        // Check if all 4 photos are captured
        const status = await PhotoStorage.getCompletionStatus(
            this.currentSceneIndex,
            this.currentCharacterName
        );

        if (!status.isComplete) {
            const missing = status.missing.map(a => a.toUpperCase()).join(', ');
            const captured = status.captured;

            // Show which angles are complete and which are missing
            this.showToast(`Missing ${4 - captured} photo(s): ${missing}`, 3000);

            // Highlight the missing slots briefly
            missing.split(', ').forEach(angle => {
                const slot = document.querySelector(`.photo-slot[data-angle="${angle.toLowerCase()}"]`);
                if (slot) {
                    slot.classList.add('highlight-missing');
                    setTimeout(() => slot.classList.remove('highlight-missing'), 2000);
                }
            });
            return;
        }

        // Update scene status
        await this.updateSceneStatuses();

        // Save notes (auto-save should have already saved, but ensure final save)
        const notesTextarea = document.getElementById('scene-notes');
        if (notesTextarea) {
            this.saveSceneNotes(this.currentSceneIndex, this.currentCharacterName, notesTextarea.value);
        }

        // Show success feedback
        const character = this.characters.find(c => c.name === this.currentCharacterName);
        const scene = this.scenes[this.currentSceneIndex];
        this.showToast(`✓ ${character?.name || 'Character'} complete for Scene ${scene?.number || ''}`, 2500);

        // Navigate back to scene list after brief delay
        setTimeout(() => {
            this.navigateTo('screen-scene-list');
        }, 500);
    },

    /**
     * Save scene notes to localStorage
     */
    saveSceneNotes(sceneIndex, characterName, notes) {
        const key = `hmp_notes_${sceneIndex}_${characterName}`;
        localStorage.setItem(key, notes);
    },

    /**
     * Load scene notes from localStorage
     */
    loadSceneNotes(sceneIndex, characterName) {
        const key = `hmp_notes_${sceneIndex}_${characterName}`;
        return localStorage.getItem(key) || '';
    },

    /**
     * Update scene statuses based on photos
     */
    async updateSceneStatuses() {
        const statuses = await PhotoStorage.getAllSceneStatuses(this.scenes);

        // Update scenes array
        this.scenes.forEach(scene => {
            scene.status = statuses[scene.index] || 'pending';
        });

        // Save updated scenes
        this.saveToStorage();
    },

    // ============================================
    // UI UTILITIES
    // ============================================

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in ms (default 2000)
     */
    showToast(message, duration = 2000) {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Open the full-screen photo viewer
     * @param {string} imageSrc - Image source (base64 or URL)
     * @param {string} title - Title for the viewer
     * @param {string} caption - Caption text
     */
    openPhotoViewer(imageSrc, title = 'Photo', caption = '') {
        const viewer = document.getElementById('photo-viewer');
        const viewerImg = document.getElementById('photo-viewer-img');
        const viewerTitle = document.getElementById('photo-viewer-title');
        const viewerCaption = document.getElementById('photo-viewer-caption');
        const closeBtn = document.getElementById('photo-viewer-close');

        if (!viewer || !viewerImg) return;

        viewerImg.src = imageSrc;
        if (viewerTitle) viewerTitle.textContent = title;
        if (viewerCaption) viewerCaption.textContent = caption;

        viewer.classList.add('active');

        // Bind close button
        if (closeBtn) {
            closeBtn.onclick = () => this.closePhotoViewer();
        }

        // Close on background click
        viewer.onclick = (e) => {
            if (e.target === viewer || e.target.classList.contains('photo-viewer-content')) {
                this.closePhotoViewer();
            }
        };

        // Close on escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closePhotoViewer();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    /**
     * Close the photo viewer
     */
    closePhotoViewer() {
        const viewer = document.getElementById('photo-viewer');
        if (viewer) {
            viewer.classList.remove('active');
        }
    },

    // ============================================
    // SETTINGS & DATA MANAGEMENT
    // ============================================

    /**
     * Bind settings event handlers
     */
    bindSettingsEvents() {
        // New project button
        const newProjectBtn = document.getElementById('btn-new-project');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => this.startNewProject());
        }

        // Clear photos button
        const clearPhotosBtn = document.getElementById('btn-clear-photos');
        if (clearPhotosBtn) {
            clearPhotosBtn.addEventListener('click', () => this.clearAllPhotos());
        }

        // Clear timesheets button
        const clearTimesheetsBtn = document.getElementById('btn-clear-timesheets');
        if (clearTimesheetsBtn) {
            clearTimesheetsBtn.addEventListener('click', () => this.clearTimesheets());
        }

        // Delete all data button
        const deleteDataBtn = document.getElementById('btn-delete-data');
        if (deleteDataBtn) {
            deleteDataBtn.addEventListener('click', () => this.deleteAllData());
        }

        // Install app button
        const installBtn = document.getElementById('btn-install-app');
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installApp());
        }

        // Export data button (sync)
        const exportDataBtn = document.getElementById('btn-export-data');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', async () => {
                if (typeof MobileSync !== 'undefined') {
                    const result = await MobileSync.exportToFile({ includePhotos: true });
                    if (result.success) {
                        alert(`Exported ${result.filename}\n\nTransfer this file to your desktop to import timesheet entries and photos.`);
                    } else {
                        alert('Export failed: ' + result.error);
                    }
                } else {
                    alert('Sync module not loaded');
                }
            });
        }
    },

    /**
     * Update settings screen with current data
     */
    updateSettings() {
        // Update project info
        const projectName = document.getElementById('settings-project-name');
        const sceneCount = document.getElementById('settings-scene-count');
        const characterCount = document.getElementById('settings-character-count');

        if (projectName) projectName.textContent = this.project.name || 'No Project';
        if (sceneCount) sceneCount.textContent = this.scenes.length;
        if (characterCount) characterCount.textContent = this.characters.length;

        // Update storage stats
        this.updateStorageStats();

        // Check if PWA install is available
        this.checkInstallAvailability();
    },

    /**
     * Update storage statistics display
     */
    async updateStorageStats() {
        try {
            const stats = await PhotoStorage.getStorageStats();
            const photoCount = document.getElementById('photo-count');
            const storageUsed = document.getElementById('storage-used');
            const storageFill = document.getElementById('storage-fill');

            if (photoCount) photoCount.textContent = stats.count;
            if (storageUsed) storageUsed.textContent = stats.count;

            // Calculate fill percentage (100 photos = 100%)
            const fillPercent = Math.min((stats.count / 100) * 100, 100);
            if (storageFill) storageFill.style.width = `${fillPercent}%`;
        } catch (error) {
            console.error('Error updating storage stats:', error);
        }
    },

    /**
     * Start a new project (clears script data but keeps photos)
     */
    async startNewProject() {
        const confirmed = confirm(
            'Start a new project?\n\n' +
            'This will clear your current script, scenes, and characters.\n' +
            'Photos and timesheets will be preserved.\n\n' +
            'Are you sure?'
        );

        if (!confirmed) return;

        // Clear project data
        this.project = { name: 'Untitled Project', file: null, isDemo: false };
        this.scenes = [];
        this.characters = [];
        this.duplicates = [];

        // Clear localStorage
        localStorage.removeItem(this.STORAGE_KEYS.PROJECT);
        localStorage.removeItem(this.STORAGE_KEYS.SCENES);
        localStorage.removeItem(this.STORAGE_KEYS.CHARACTERS);

        // Clear notes
        const noteKeys = Object.keys(localStorage).filter(k => k.startsWith('hmp_notes_'));
        noteKeys.forEach(key => localStorage.removeItem(key));

        this.showToast('Project cleared. Ready for new script.');

        // Navigate to home
        this.navigateTo('screen-home');
    },

    /**
     * Clear all photos from IndexedDB
     */
    async clearAllPhotos() {
        const stats = await PhotoStorage.getStorageStats();

        if (stats.count === 0) {
            this.showToast('No photos to clear');
            return;
        }

        const confirmed = confirm(
            `Clear all ${stats.count} photos?\n\n` +
            'This action cannot be undone.\n\n' +
            'Are you sure?'
        );

        if (!confirmed) return;

        try {
            await PhotoStorage.clearAllPhotos();

            // Update scene statuses
            await this.updateSceneStatuses();

            // Update settings display
            this.updateStorageStats();

            this.showToast(`${stats.count} photos cleared`);
        } catch (error) {
            console.error('Error clearing photos:', error);
            this.showToast('Error clearing photos');
        }
    },

    /**
     * Clear all timesheet entries
     */
    clearTimesheets() {
        if (this.timesheetEntries.length === 0) {
            this.showToast('No timesheet entries to clear');
            return;
        }

        const count = this.timesheetEntries.length;
        const confirmed = confirm(
            `Clear all ${count} timesheet entries?\n\n` +
            'This action cannot be undone.\n\n' +
            'Are you sure?'
        );

        if (!confirmed) return;

        this.timesheetEntries = [];
        this.saveTimesheets();

        this.showToast(`${count} timesheet entries cleared`);
    },

    /**
     * Delete all app data (full reset)
     */
    async deleteAllData() {
        const confirmed = confirm(
            '⚠️ DELETE ALL DATA ⚠️\n\n' +
            'This will permanently delete:\n' +
            '• All scenes and characters\n' +
            '• All photos\n' +
            '• All timesheet entries\n' +
            '• All notes and settings\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you absolutely sure?'
        );

        if (!confirmed) return;

        // Double confirm for safety
        const doubleConfirm = confirm(
            'FINAL WARNING\n\n' +
            'Click OK to permanently delete everything.'
        );

        if (!doubleConfirm) return;

        try {
            // Clear IndexedDB photos
            await PhotoStorage.clearAllPhotos();

            // Clear all localStorage
            localStorage.removeItem(this.STORAGE_KEYS.PROJECT);
            localStorage.removeItem(this.STORAGE_KEYS.SCENES);
            localStorage.removeItem(this.STORAGE_KEYS.CHARACTERS);
            localStorage.removeItem(this.STORAGE_KEYS.TIMESHEETS);

            // Clear notes
            const noteKeys = Object.keys(localStorage).filter(k => k.startsWith('hmp_notes_'));
            noteKeys.forEach(key => localStorage.removeItem(key));

            // Reset app state
            this.project = { name: 'Untitled Project', file: null, isDemo: false };
            this.scenes = [];
            this.characters = [];
            this.duplicates = [];
            this.timesheetEntries = [];

            this.showToast('All data deleted');

            // Navigate to home
            this.navigateTo('screen-home');
        } catch (error) {
            console.error('Error deleting all data:', error);
            this.showToast('Error deleting data');
        }
    },

    /**
     * Install the PWA
     */
    async installApp() {
        if (!window.deferredPrompt) {
            this.showToast('App already installed or not available');
            return;
        }

        try {
            // Show the install prompt
            window.deferredPrompt.prompt();

            // Wait for the user's response
            const { outcome } = await window.deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                this.showToast('App installed successfully!');
                // Hide the install section
                const installSection = document.getElementById('install-section');
                if (installSection) {
                    installSection.style.display = 'none';
                }
            }

            // Clear the deferred prompt
            window.deferredPrompt = null;
        } catch (error) {
            console.error('Error installing app:', error);
            this.showToast('Installation failed');
        }
    },

    /**
     * Check if PWA install is available
     */
    checkInstallAvailability() {
        const installSection = document.getElementById('install-section');
        if (installSection) {
            // Show install section if prompt is available and app is not installed
            const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                               window.navigator.standalone === true;

            if (window.deferredPrompt && !isInstalled) {
                installSection.style.display = 'block';
            } else {
                installSection.style.display = 'none';
            }
        }
    },

    // ============================================
    // DEMO MODE
    // ============================================

    /**
     * Bind demo button event
     */
    bindDemoButton() {
        const demoBtn = document.getElementById('btn-try-demo');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => this.loadDemoProject());
        }
    },

    /**
     * Load demo project with sample data
     */
    async loadDemoProject() {
        this.showToast('Loading demo project...');

        // Demo project metadata
        this.project = {
            name: 'The Morning After',
            file: 'demo-script.pdf',
            isDemo: true
        };

        // Demo scenes - realistic film production scenarios
        this.scenes = [
            {
                index: 0,
                number: '1',
                heading: 'INT. SARAH\'S APARTMENT - MORNING',
                characters: ['SARAH CHEN', 'MIKE TORRES'],
                status: 'pending'
            },
            {
                index: 1,
                number: '2',
                heading: 'EXT. CITY STREET - DAY',
                characters: ['SARAH CHEN', 'DR. AMANDA COLE'],
                status: 'pending'
            },
            {
                index: 2,
                number: '3',
                heading: 'INT. COFFEE SHOP - DAY',
                characters: ['SARAH CHEN', 'MIKE TORRES', 'EMMA WRIGHT'],
                status: 'pending'
            },
            {
                index: 3,
                number: '4',
                heading: 'INT. HOSPITAL - NIGHT',
                characters: ['DR. AMANDA COLE', 'MIKE TORRES'],
                status: 'pending'
            },
            {
                index: 4,
                number: '5',
                heading: 'EXT. ROOFTOP - SUNSET',
                characters: ['SARAH CHEN', 'EMMA WRIGHT'],
                status: 'pending'
            },
            {
                index: 5,
                number: '6',
                heading: 'INT. SARAH\'S APARTMENT - NIGHT',
                characters: ['SARAH CHEN', 'MIKE TORRES', 'DR. AMANDA COLE'],
                status: 'pending'
            },
            {
                index: 6,
                number: '7',
                heading: 'EXT. PARK - MORNING',
                characters: ['EMMA WRIGHT'],
                status: 'pending'
            },
            {
                index: 7,
                number: '8',
                heading: 'INT. OFFICE BUILDING - DAY',
                characters: ['SARAH CHEN', 'MIKE TORRES'],
                status: 'pending'
            }
        ];

        // Demo characters with look descriptions
        this.characters = [
            {
                name: 'SARAH CHEN',
                sceneCount: 6,
                looks: [{
                    name: 'Day 1 - Professional',
                    description: 'Clean, polished professional look. Natural makeup with subtle contouring, well-groomed hair in a neat low bun.'
                }]
            },
            {
                name: 'MIKE TORRES',
                sceneCount: 4,
                looks: [{
                    name: 'Casual Weekend',
                    description: 'Natural, minimal styling. Light stubble, textured hair with product for casual tousled look.'
                }]
            },
            {
                name: 'DR. AMANDA COLE',
                sceneCount: 3,
                looks: [{
                    name: 'Hospital Professional',
                    description: 'Minimal makeup, hair pulled back in professional ponytail. Clean, clinical appearance.'
                }]
            },
            {
                name: 'EMMA WRIGHT',
                sceneCount: 3,
                looks: [{
                    name: 'Artistic Bohemian',
                    description: 'Creative, expressive style. Bold eye makeup, loose wavy hair, artistic accessories.'
                }]
            }
        ];

        // Demo timesheet entries (with new quick entry fields)
        this.timesheetEntries = [
            {
                id: Date.now() - 86400000 * 3,
                date: this.getRelativeDate(-3),
                shootDay: 'Day 1',
                preCall: '05:00',
                unitCall: '05:30',
                callTime: '05:30',
                wrap: '18:00',
                wrapTime: '18:00',
                sixthDay: false,
                brokenLunch: false,
                totalHours: 12,
                notes: 'First day of production. Main cast looks established.',
                status: 'approved',
                synced: true
            },
            {
                id: Date.now() - 86400000 * 2,
                date: this.getRelativeDate(-2),
                shootDay: 'Day 2',
                preCall: '05:30',
                unitCall: '06:00',
                callTime: '06:00',
                wrap: '19:30',
                wrapTime: '19:30',
                sixthDay: false,
                brokenLunch: true,
                totalHours: 12.75,
                notes: 'Hospital scenes. Quick turnaround for Dr. Cole.',
                status: 'approved',
                synced: true
            },
            {
                id: Date.now() - 86400000,
                date: this.getRelativeDate(-1),
                shootDay: 'Day 3',
                preCall: '06:30',
                unitCall: '07:00',
                callTime: '07:00',
                wrap: '17:00',
                wrapTime: '17:00',
                sixthDay: true,
                brokenLunch: false,
                totalHours: 9.5,
                notes: 'Exterior scenes. Weather delays.',
                status: 'pending',
                synced: false
            }
        ];

        // Save to storage
        this.saveToStorage();
        this.saveTimesheets();

        // Generate some sample placeholder photos
        await this.generateDemoPhotos();

        // Update scene statuses
        await this.updateSceneStatuses();

        // Navigate to scene list
        this.navigateTo('screen-scene-list');

        this.showToast('Demo project loaded!');
    },

    /**
     * Get date relative to today
     */
    getRelativeDate(daysOffset) {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        return date.toISOString().split('T')[0];
    },

    /**
     * Generate demo placeholder photos
     */
    async generateDemoPhotos() {
        // Generate SVG placeholder photos for first scene/character
        const angles = ['front', 'left', 'right', 'back'];
        const colors = {
            front: '#C9A961',
            left: '#667eea',
            right: '#764ba2',
            back: '#48bb78'
        };

        for (const angle of angles) {
            const svg = this.createPlaceholderSVG(angle, colors[angle], 'SARAH CHEN', 'Scene 1');
            const imageData = 'data:image/svg+xml;base64,' + btoa(svg);

            await PhotoStorage.savePhoto({
                sceneIndex: 0,
                characterName: 'SARAH CHEN',
                angle: angle,
                imageData: imageData,
                timestamp: Date.now(),
                isDemo: true
            });
        }

        // Add a couple more photos for variety
        const svg2 = this.createPlaceholderSVG('front', '#C9A961', 'MIKE TORRES', 'Scene 1');
        await PhotoStorage.savePhoto({
            sceneIndex: 0,
            characterName: 'MIKE TORRES',
            angle: 'front',
            imageData: 'data:image/svg+xml;base64,' + btoa(svg2),
            timestamp: Date.now(),
            isDemo: true
        });
    },

    /**
     * Create placeholder SVG image
     */
    createPlaceholderSVG(angle, color, character, scene) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <rect width="400" height="400" fill="${color}"/>
            <circle cx="200" cy="150" r="60" fill="white" opacity="0.3"/>
            <rect x="140" y="220" width="120" height="80" rx="10" fill="white" opacity="0.3"/>
            <text x="200" y="320" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="bold">${angle.toUpperCase()}</text>
            <text x="200" y="350" text-anchor="middle" fill="white" font-family="system-ui" font-size="14" opacity="0.8">${character}</text>
            <text x="200" y="375" text-anchor="middle" fill="white" font-family="system-ui" font-size="12" opacity="0.6">${scene}</text>
        </svg>`;
    },

    /**
     * Check if currently in demo mode
     */
    isDemoMode() {
        return this.project.isDemo === true;
    },

    /**
     * Update demo badge visibility
     */
    updateDemoBadge() {
        // Remove existing badges
        document.querySelectorAll('.demo-badge').forEach(b => b.remove());

        if (this.isDemoMode()) {
            // Add badge to scene list title
            const sceneListTitle = document.querySelector('#screen-scene-list .top-bar-title');
            if (sceneListTitle && !sceneListTitle.querySelector('.demo-badge')) {
                const badge = document.createElement('span');
                badge.className = 'demo-badge';
                badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Demo`;
                sceneListTitle.appendChild(badge);
            }
        }
    },

    // ============================================
    // ROUTING
    // ============================================

    /**
     * Check initial route based on app state
     */
    async checkInitialRoute() {
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

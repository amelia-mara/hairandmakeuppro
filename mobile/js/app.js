/**
 * Hair & Makeup Pro - Mobile PWA
 * Stage 1: Core Structure - Screen Navigation & Routing
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

    // Initialize the app
    init() {
        this.bindNavigationEvents();
        this.bindSearchToggle();
        this.bindFilterPills();
        this.bindUploadCard();
        this.bindSyncCodeInputs();
        this.bindModalEvents();
        this.bindTimesheetCalculation();

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
                this.startAnalysisAnimation();
                break;
            case 'screen-scene-list':
            case 'screen-lookbooks':
            case 'screen-timesheet':
            case 'screen-settings':
                // These are main tab screens - clear history to home
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
                console.log(`Filter selected: ${filter}`);

                // In Stage 1, we just update the UI
                // Actual filtering will be implemented in later stages
            });
        });
    },

    /**
     * Bind upload card click
     */
    bindUploadCard() {
        const uploadCard = document.getElementById('upload-card');
        const fileInput = document.getElementById('script-file-input');
        const filePreview = document.getElementById('file-preview');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const fileRemove = document.getElementById('file-remove');
        const continueBtn = document.getElementById('btn-continue-upload');
        const demoBtn = document.getElementById('btn-use-demo');

        if (uploadCard && fileInput) {
            uploadCard.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileSelected(file);
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
                // Simulate demo file selection
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
    // ANALYSIS ANIMATION
    // ============================================

    /**
     * Start the analysis animation
     */
    startAnalysisAnimation() {
        const progressFill = document.getElementById('analysis-progress');
        const statusText = document.getElementById('analysis-status');
        const steps = [
            { id: 'step-scenes', text: 'Scanning for scene headings...' },
            { id: 'step-characters', text: 'Extracting character names...' },
            { id: 'step-duplicates', text: 'Checking for duplicates...' }
        ];

        let currentStep = 0;

        const advanceStep = () => {
            if (currentStep >= steps.length) {
                // Analysis complete - show confirmation modal
                setTimeout(() => {
                    if (this.currentScreen === 'screen-analyzing') {
                        this.showModal('modal-character-confirmation');
                    }
                }, 500);
                return;
            }

            // Mark current step as active
            steps.forEach((step, index) => {
                const el = document.getElementById(step.id);
                if (el) {
                    el.classList.remove('active', 'complete');
                    if (index < currentStep) {
                        el.classList.add('complete');
                    } else if (index === currentStep) {
                        el.classList.add('active');
                    }
                }
            });

            // Update status text
            if (statusText) {
                statusText.textContent = steps[currentStep].text;
            }

            currentStep++;

            // Schedule next step
            setTimeout(advanceStep, 1000);
        };

        // Reset and start
        currentStep = 0;
        if (progressFill) {
            progressFill.style.animation = 'none';
            progressFill.offsetHeight; // Trigger reflow
            progressFill.style.animation = 'progress-animation 3s ease-in-out forwards';
        }

        advanceStep();
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
        // In Stage 1, always start at home
        // In later stages, this will check localStorage for existing projects
        this.navigateTo('screen-home', { pushHistory: false });
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

/**
 * Mobile Sync UI Module
 * Handles sync-related UI rendering and interactions
 */

const SyncUI = {
    /**
     * Initialize sync UI components
     */
    init() {
        this.bindEvents();
        this.renderSyncIndicator();
        console.log('[SyncUI] Initialized');
    },

    /**
     * Bind event listeners for sync UI
     */
    bindEvents() {
        // Connect project file input
        const fileInput = document.getElementById('sync-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Sync code input
        this.bindSyncCodeInputs();

        // Export buttons
        document.querySelectorAll('[data-action="export-today"]').forEach(btn => {
            btn.addEventListener('click', () => this.exportToday());
        });

        document.querySelectorAll('[data-action="export-week"]').forEach(btn => {
            btn.addEventListener('click', () => this.exportWeek());
        });

        document.querySelectorAll('[data-action="export-all"]').forEach(btn => {
            btn.addEventListener('click', () => this.exportAll());
        });

        // Disconnect button
        document.querySelectorAll('[data-action="disconnect"]').forEach(btn => {
            btn.addEventListener('click', () => this.handleDisconnect());
        });
    },

    /**
     * Bind sync code input fields (for 6-character code entry)
     */
    bindSyncCodeInputs() {
        const inputs = document.querySelectorAll('.sync-code-input');
        if (inputs.length === 0) return;

        inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                // Move to next input on character entry
                const value = e.target.value.toUpperCase();
                e.target.value = value;

                if (value.length === 1 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }

                // Check if all inputs filled
                this.checkSyncCodeComplete();
            });

            input.addEventListener('keydown', (e) => {
                // Move to previous input on backspace
                if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                    inputs[index - 1].focus();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

                // Distribute pasted characters across inputs
                for (let i = 0; i < Math.min(pastedText.length, inputs.length); i++) {
                    inputs[i].value = pastedText[i];
                }

                // Focus last filled input or next empty
                const lastIndex = Math.min(pastedText.length - 1, inputs.length - 1);
                inputs[lastIndex].focus();

                this.checkSyncCodeComplete();
            });
        });
    },

    /**
     * Check if sync code is complete and valid
     */
    checkSyncCodeComplete() {
        const inputs = document.querySelectorAll('.sync-code-input');
        const code = Array.from(inputs).map(i => i.value).join('');

        const connectBtn = document.getElementById('btn-connect-sync');
        if (connectBtn) {
            connectBtn.disabled = code.length !== 6;
        }

        return code.length === 6 ? code : null;
    },

    /**
     * Handle file selection for project import
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            this.showNotification('Please select a .json sync file', 'error');
            return;
        }

        this.showLoading('Importing project...');

        const result = await MobileSync.importProjectFromFile(file);

        this.hideLoading();

        if (result.success) {
            this.showNotification(`Project "${result.project.name}" imported successfully!`, 'success');
            this.renderSyncStatus();

            // Navigate to home screen
            if (typeof App !== 'undefined') {
                App.project = result.project;
                App.scenes = JSON.parse(localStorage.getItem('hmp_scenes') || '[]');
                App.characters = JSON.parse(localStorage.getItem('hmp_characters') || '[]');
                App.navigateTo('screen-home');
            }
        } else {
            this.showNotification(`Import failed: ${result.error}`, 'error');
        }

        // Clear file input
        event.target.value = '';
    },

    /**
     * Handle sync code connection (for future cloud sync)
     */
    async handleSyncCodeConnect() {
        const code = this.checkSyncCodeComplete();
        if (!code) {
            this.showNotification('Please enter a complete sync code', 'error');
            return;
        }

        this.showLoading('Connecting...');

        // For MVP, sync codes aren't validated against cloud
        // Just show message to use file import instead
        this.hideLoading();
        this.showNotification(
            'Cloud sync coming soon! For now, use "Import from File" to sync your project.',
            'info'
        );
    },

    /**
     * Export today's data
     */
    async exportToday() {
        this.showLoading('Preparing export...');
        const result = await MobileSync.exportTodayData();
        this.hideLoading();

        if (result.success) {
            this.showNotification(`Exported ${result.filename}`, 'success');
            MobileSync.clearSyncQueue();
            this.renderSyncStatus();
        } else {
            this.showNotification(`Export failed: ${result.error}`, 'error');
        }
    },

    /**
     * Export this week's data
     */
    async exportWeek() {
        this.showLoading('Preparing export...');
        const result = await MobileSync.exportWeekData();
        this.hideLoading();

        if (result.success) {
            this.showNotification(`Exported ${result.filename}`, 'success');
            MobileSync.clearSyncQueue();
            this.renderSyncStatus();
        } else {
            this.showNotification(`Export failed: ${result.error}`, 'error');
        }
    },

    /**
     * Export all data
     */
    async exportAll() {
        this.showLoading('Preparing export...');
        const result = await MobileSync.exportToFile({ includePhotos: true });
        this.hideLoading();

        if (result.success) {
            this.showNotification(`Exported ${result.filename}`, 'success');
            MobileSync.clearSyncQueue();
            this.renderSyncStatus();
        } else {
            this.showNotification(`Export failed: ${result.error}`, 'error');
        }
    },

    /**
     * Handle disconnect from project
     */
    handleDisconnect() {
        if (confirm('Disconnect from this project? Your local data will be cleared.')) {
            MobileSync.disconnect();
            this.renderSyncStatus();
            this.showNotification('Disconnected from project', 'info');

            if (typeof App !== 'undefined') {
                App.project = null;
                App.scenes = [];
                App.characters = [];
                App.navigateTo('screen-home');
            }
        }
    },

    /**
     * Render sync status indicator (header/footer)
     */
    renderSyncIndicator() {
        const indicator = document.getElementById('sync-indicator');
        if (!indicator) return;

        const status = MobileSync.getStatusSummary();

        indicator.className = `sync-indicator ${status.statusClass}`;
        indicator.innerHTML = `
            <span class="sync-dot"></span>
            <span class="sync-text">${status.statusText}</span>
        `;

        indicator.onclick = () => {
            if (typeof App !== 'undefined') {
                App.navigateTo('screen-sync-status');
            }
        };
    },

    /**
     * Render full sync status screen
     */
    renderSyncStatus() {
        const container = document.getElementById('sync-status-content');
        if (!container) return;

        const status = MobileSync.getStatusSummary();

        if (!status.connected) {
            container.innerHTML = `
                <div class="sync-not-connected">
                    <div class="sync-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                    </div>
                    <h3>Not Connected</h3>
                    <p>Import a project from desktop to get started</p>
                    <button class="btn btn-primary btn-full" onclick="document.getElementById('sync-file-input').click()">
                        Import from File
                    </button>
                    <input type="file" id="sync-file-input" accept=".json" style="display: none;">
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="sync-connected">
                <div class="sync-project-card">
                    <div class="sync-project-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <div class="sync-project-info">
                        <div class="sync-project-name">${this.escapeHtml(status.projectName)}</div>
                        <div class="sync-project-sync">Last sync: ${status.lastSyncFormatted}</div>
                    </div>
                    <span class="sync-status-badge ${status.statusClass}">
                        ${status.isOnline ? (status.pendingItems > 0 ? status.pendingItems + ' pending' : 'Synced') : 'Offline'}
                    </span>
                </div>

                <div class="sync-section">
                    <h4>Export to Desktop</h4>
                    <p class="sync-section-hint">Transfer your timesheet and photos to the desktop app</p>

                    <div class="sync-export-buttons">
                        <button class="btn btn-secondary" data-action="export-today">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            Today
                        </button>
                        <button class="btn btn-secondary" data-action="export-week">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            This Week
                        </button>
                        <button class="btn btn-primary btn-full" data-action="export-all">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Export All Data
                        </button>
                    </div>
                </div>

                <div class="sync-section">
                    <h4>Update Project</h4>
                    <p class="sync-section-hint">Import updated project data from desktop</p>
                    <button class="btn btn-secondary btn-full" onclick="document.getElementById('sync-file-input').click()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Import from File
                    </button>
                    <input type="file" id="sync-file-input" accept=".json" style="display: none;">
                </div>

                <div class="sync-section sync-danger">
                    <button class="btn btn-outline-danger btn-full" data-action="disconnect">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                            <line x1="12" y1="2" x2="12" y2="12"/>
                        </svg>
                        Disconnect from Project
                    </button>
                </div>
            </div>
        `;

        // Re-bind events for dynamically added elements
        this.bindEvents();
    },

    /**
     * Render connect project screen
     */
    renderConnectScreen() {
        const container = document.getElementById('connect-project-content');
        if (!container) return;

        container.innerHTML = `
            <div class="connect-options">
                <div class="connect-option">
                    <div class="connect-option-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                    </div>
                    <h3>Import from File</h3>
                    <p>Select a sync file exported from the desktop app</p>
                    <button class="btn btn-primary btn-full" onclick="document.getElementById('connect-file-input').click()">
                        Choose File
                    </button>
                    <input type="file" id="connect-file-input" accept=".json" style="display: none;">
                </div>

                <div class="connect-divider">
                    <span>or</span>
                </div>

                <div class="connect-option">
                    <div class="connect-option-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                        </svg>
                    </div>
                    <h3>Enter Sync Code</h3>
                    <p>Enter the 6-character code shown on desktop</p>

                    <div class="sync-code-inputs">
                        <input type="text" class="sync-code-input" maxlength="1" pattern="[A-Z0-9]">
                        <input type="text" class="sync-code-input" maxlength="1" pattern="[A-Z0-9]">
                        <input type="text" class="sync-code-input" maxlength="1" pattern="[A-Z0-9]">
                        <span class="sync-code-dash">-</span>
                        <input type="text" class="sync-code-input" maxlength="1" pattern="[A-Z0-9]">
                        <input type="text" class="sync-code-input" maxlength="1" pattern="[A-Z0-9]">
                        <input type="text" class="sync-code-input" maxlength="1" pattern="[A-Z0-9]">
                    </div>

                    <button class="btn btn-secondary btn-full" id="btn-connect-sync" disabled onclick="SyncUI.handleSyncCodeConnect()">
                        Connect
                    </button>
                    <p class="connect-hint">Cloud sync coming soon</p>
                </div>
            </div>
        `;

        // Bind file input and sync code inputs
        const fileInput = document.getElementById('connect-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        this.bindSyncCodeInputs();
    },

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        let overlay = document.getElementById('sync-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sync-loading-overlay';
            overlay.className = 'loading-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        overlay.classList.add('active');
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('sync-loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    },

    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.sync-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `sync-notification sync-notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span class="notification-message">${this.escapeHtml(message)}</span>
        `;

        document.body.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('active');
        });

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('active');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },

    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.SyncUI = SyncUI;
}

/**
 * export-core.js
 * Core utilities for export functionality
 *
 * Responsibilities:
 * - Progress modal display and updates
 * - Top loading bar (non-blocking progress indicator)
 * - Toast notifications
 * - File download helper
 */

// ============================================================================
// PROGRESS MODAL FUNCTIONS
// ============================================================================

/**
 * Show progress modal for long operations
 * @param {string} title - Modal title
 * @param {string} message - Progress message
 */
export function showProgressModal(title, message) {
    const modal = document.getElementById('progress-modal');
    if (!modal) return;

    const titleEl = document.getElementById('progress-title');
    const messageEl = document.getElementById('progress-message');
    const progressFill = document.getElementById('progress-fill');
    const progressLabel = document.getElementById('progress-label');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (progressFill) progressFill.style.width = '0%';
    if (progressLabel) progressLabel.textContent = '0%';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (doneBtn) doneBtn.style.display = 'none';

    modal.style.display = 'flex';
}

/**
 * Update progress modal
 * @param {number} current - Current progress value
 * @param {number} total - Total progress value
 * @param {string} message - Progress message
 * @param {boolean} isDone - Whether operation is complete
 */
export function updateProgressModal(current, total, message, isDone) {
    const messageEl = document.getElementById('progress-message');
    const labelEl = document.getElementById('progress-label');
    const fillEl = document.getElementById('progress-fill');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (messageEl) messageEl.textContent = message;
    if (labelEl) labelEl.textContent = `${current} / ${total}`;
    if (fillEl) {
        const percentage = (current / total) * 100;
        fillEl.style.width = `${percentage}%`;
    }

    if (isDone) {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (doneBtn) doneBtn.style.display = 'inline-block';
    }
}

/**
 * Close progress modal
 */
export function closeProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) {
        // Small delay so user can see completion
        setTimeout(() => {
            modal.style.display = 'none';
        }, 1000);
    }
}

// ============================================================================
// TOP LOADING BAR (Non-blocking progress indicator)
// ============================================================================

/**
 * Show top loading bar
 * @param {string} message - Main message to display
 * @param {string} details - Optional details text
 * @param {number} progress - Optional progress percentage (0-100), omit for indeterminate
 */
export function showTopLoadingBar(message, details = '', progress = null) {
    const loadingBar = document.getElementById('top-loading-bar');
    const loadingMessage = document.getElementById('top-loading-message');
    const loadingDetails = document.getElementById('top-loading-details');
    const loadingProgress = document.getElementById('top-loading-progress');

    if (!loadingBar) return;

    // Set message and details
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingDetails) loadingDetails.textContent = details;

    // Set progress bar
    if (loadingProgress) {
        if (progress === null) {
            // Indeterminate progress
            loadingProgress.classList.add('indeterminate');
            loadingProgress.style.width = '100%';
        } else {
            // Determinate progress
            loadingProgress.classList.remove('indeterminate');
            loadingProgress.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }

    // Show loading bar
    loadingBar.classList.remove('closing');
    loadingBar.style.display = 'block';
}

/**
 * Update top loading bar
 * @param {string} message - Main message
 * @param {string} details - Optional details text
 * @param {number} progress - Progress percentage (0-100), omit for indeterminate
 */
export function updateTopLoadingBar(message, details = '', progress = null) {
    const loadingMessage = document.getElementById('top-loading-message');
    const loadingDetails = document.getElementById('top-loading-details');
    const loadingProgress = document.getElementById('top-loading-progress');

    if (loadingMessage && message) loadingMessage.textContent = message;
    if (loadingDetails) loadingDetails.textContent = details || '';

    if (loadingProgress && progress !== null) {
        loadingProgress.classList.remove('indeterminate');
        loadingProgress.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
}

/**
 * Close top loading bar
 * @param {number} delay - Optional delay in ms before closing (default 500)
 */
export function closeTopLoadingBar(delay = 500) {
    const loadingBar = document.getElementById('top-loading-bar');
    if (!loadingBar) return;

    setTimeout(() => {
        loadingBar.classList.add('closing');
        setTimeout(() => {
            loadingBar.style.display = 'none';
            loadingBar.classList.remove('closing');

            // Reset progress bar
            const loadingProgress = document.getElementById('top-loading-progress');
            if (loadingProgress) {
                loadingProgress.classList.remove('indeterminate');
                loadingProgress.style.width = '0%';
            }
        }, 300); // Match CSS animation duration
    }, delay);
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type (success, warning, error, info)
 */
export function showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// FILE DOWNLOAD HELPER
// ============================================================================

/**
 * Helper function to download file
 * @param {string} filename - Name for downloaded file
 * @param {string} content - File content
 * @param {string} mimeType - MIME type (default: text/plain)
 */
export function downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.showProgressModal = showProgressModal;
window.updateProgressModal = updateProgressModal;
window.closeProgressModal = closeProgressModal;
window.showTopLoadingBar = showTopLoadingBar;
window.updateTopLoadingBar = updateTopLoadingBar;
window.closeTopLoadingBar = closeTopLoadingBar;
window.showToast = showToast;

export default {
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    showTopLoadingBar,
    updateTopLoadingBar,
    closeTopLoadingBar,
    showToast,
    downloadFile
};

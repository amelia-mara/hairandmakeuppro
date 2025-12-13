/**
 * Cast Info Tab - Character Design
 * Hair & Makeup Pro
 */

// ═══════════════════════════════════════════════════════════════
// RENDER CAST INFO TAB
// ═══════════════════════════════════════════════════════════════

function renderCastInfoTab() {
    const container = document.getElementById('cast-info-tab');
    if (!container) return;

    const castEntry = window.currentCastEntry;
    const characterName = window.currentCharacter;

    container.innerHTML = `
        <div class="cast-info-layout">

            <!-- Left Column: Photo -->
            <div class="cast-photo-section">
                <div class="headshot-container" onclick="triggerHeadshotUpload()">
                    <img src="${castEntry?.headshot || ''}" alt="Headshot" class="headshot-image ${castEntry?.headshot ? 'visible' : ''}" id="cast-headshot">
                    <div class="headshot-placeholder" id="headshot-placeholder" style="${castEntry?.headshot ? 'display: none;' : ''}">
                        <span class="placeholder-icon">+</span>
                        <span class="placeholder-text">Upload Headshot</span>
                    </div>
                </div>
                <input type="file" id="headshot-upload" accept="image/*" onchange="handleHeadshotUpload(event)" hidden>
                <button class="upload-btn" onclick="triggerHeadshotUpload()">
                    ${castEntry?.headshot ? 'Change Photo' : 'Upload Photo'}
                </button>
            </div>

            <!-- Right Column: Info -->
            <div class="cast-details-section">

                <!-- Basic Info -->
                <div class="info-group">
                    <h3>ACTOR DETAILS</h3>
                    <div class="form-row">
                        <div class="form-field">
                            <label>Actor Name</label>
                            <input type="text" id="actor-name" placeholder="Full name"
                                   value="${escapeHtml(castEntry?.actorName || '')}"
                                   onchange="saveCastField('actorName', this.value)">
                        </div>
                        <div class="form-field">
                            <label>Agency</label>
                            <input type="text" id="actor-agency" placeholder="Agency name"
                                   value="${escapeHtml(castEntry?.agency || '')}"
                                   onchange="saveCastField('agency', this.value)">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-field">
                            <label>Contact Email</label>
                            <input type="email" id="actor-email" placeholder="agent@agency.com"
                                   value="${escapeHtml(castEntry?.contactEmail || '')}"
                                   onchange="saveCastField('contactEmail', this.value)">
                        </div>
                        <div class="form-field">
                            <label>Contact Phone</label>
                            <input type="tel" id="actor-phone" placeholder="+44..."
                                   value="${escapeHtml(castEntry?.contactPhone || '')}"
                                   onchange="saveCastField('contactPhone', this.value)">
                        </div>
                    </div>
                </div>

                <!-- Skin & Allergies -->
                <div class="info-group">
                    <h3>SKIN & ALLERGIES</h3>
                    <div class="form-row">
                        <div class="form-field">
                            <label>Skin Type</label>
                            <input type="text" id="skin-type" placeholder="e.g., Combination, sensitive"
                                   value="${escapeHtml(castEntry?.skinType || '')}"
                                   onchange="saveCastField('skinType', this.value)">
                        </div>
                        <div class="form-field">
                            <label>Skin Tone</label>
                            <input type="text" id="skin-tone" placeholder="e.g., Medium warm, Fitzpatrick III"
                                   value="${escapeHtml(castEntry?.skinTone || '')}"
                                   onchange="saveCastField('skinTone', this.value)">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-field full-width">
                            <label>Allergies</label>
                            <input type="text" id="allergies" placeholder="e.g., Latex, certain adhesives"
                                   value="${escapeHtml(castEntry?.allergies || '')}"
                                   onchange="saveCastField('allergies', this.value)">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-field full-width">
                            <label>Sensitivities</label>
                            <input type="text" id="sensitivities" placeholder="e.g., Fragrance, alcohol-based products"
                                   value="${escapeHtml(castEntry?.sensitivities || '')}"
                                   onchange="saveCastField('sensitivities', this.value)">
                        </div>
                    </div>
                </div>

                <!-- Measurements -->
                <div class="info-group">
                    <h3>MEASUREMENTS</h3>
                    <p class="info-hint">For prosthetics, wigs, and special pieces</p>
                    <div class="form-row">
                        <div class="form-field">
                            <label>Head Circumference</label>
                            <input type="text" id="head-circ" placeholder="e.g., 22 inches"
                                   value="${escapeHtml(castEntry?.measurements?.headCircumference || '')}"
                                   onchange="saveCastField('measurements.headCircumference', this.value)">
                        </div>
                        <div class="form-field">
                            <label>Face Width</label>
                            <input type="text" id="face-width" placeholder=""
                                   value="${escapeHtml(castEntry?.measurements?.faceWidth || '')}"
                                   onchange="saveCastField('measurements.faceWidth', this.value)">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-field">
                            <label>Forehead to Chin</label>
                            <input type="text" id="forehead-chin" placeholder=""
                                   value="${escapeHtml(castEntry?.measurements?.foreheadToChin || '')}"
                                   onchange="saveCastField('measurements.foreheadToChin', this.value)">
                        </div>
                        <div class="form-field">
                            <label>Temple to Temple</label>
                            <input type="text" id="temple-temple" placeholder=""
                                   value="${escapeHtml(castEntry?.measurements?.templeToTemple || '')}"
                                   onchange="saveCastField('measurements.templeToTemple', this.value)">
                        </div>
                    </div>
                </div>

                <!-- Notes -->
                <div class="info-group">
                    <h3>NOTES</h3>
                    <textarea id="cast-notes" rows="4"
                              placeholder="Any additional notes about working with this actor..."
                              onchange="saveCastField('notes', this.value)">${escapeHtml(castEntry?.notes || '')}</textarea>
                </div>

            </div>

        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// FORM HANDLERS
// ═══════════════════════════════════════════════════════════════

function saveCastField(field, value) {
    if (!window.currentCastEntry?.id) return;

    updateCastEntry(window.currentCastEntry.id, field, value);

    // Update local reference
    if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (!window.currentCastEntry[parent]) {
            window.currentCastEntry[parent] = {};
        }
        window.currentCastEntry[parent][child] = value;
    } else {
        window.currentCastEntry[field] = value;
    }

    // Update header if actor name changed
    if (field === 'actorName') {
        renderDetailHeader(window.currentCharacter, window.currentCastEntry);
    }

    console.log(`Saved ${field}: ${value}`);
}

// ═══════════════════════════════════════════════════════════════
// HEADSHOT UPLOAD
// ═══════════════════════════════════════════════════════════════

function triggerHeadshotUpload() {
    document.getElementById('headshot-upload')?.click();
}

function handleHeadshotUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;

        // Update UI
        const headshotImg = document.getElementById('cast-headshot');
        const placeholder = document.getElementById('headshot-placeholder');

        if (headshotImg) {
            headshotImg.src = dataUrl;
            headshotImg.classList.add('visible');
        }
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // Update upload button text
        const uploadBtn = document.querySelector('.upload-btn');
        if (uploadBtn) {
            uploadBtn.textContent = 'Change Photo';
        }

        // Save to cast entry
        saveCastField('headshot', dataUrl);
    };

    reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.renderCastInfoTab = renderCastInfoTab;
window.saveCastField = saveCastField;
window.triggerHeadshotUpload = triggerHeadshotUpload;
window.handleHeadshotUpload = handleHeadshotUpload;

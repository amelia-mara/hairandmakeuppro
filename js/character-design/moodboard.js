/**
 * Moodboard Tab - Character Design
 * Hair & Makeup Pro
 *
 * Basic structure for freeform moodboard canvas
 */

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let moodboardState = {
    zoom: 100,
    elements: [],
    selectedElement: null
};

// ═══════════════════════════════════════════════════════════════
// RENDER MOODBOARD TAB
// ═══════════════════════════════════════════════════════════════

function initMoodboard() {
    const container = document.getElementById('moodboard-tab');
    if (!container) return;

    const characterName = window.currentCharacter;
    const looks = generateLooksFromBreakdown(characterName);
    const currentLookId = window.currentLookId || (looks[0]?.id || 'all');

    // Load saved moodboard state for this look
    loadMoodboardState(currentLookId);

    container.innerHTML = `
        <!-- Toolbar -->
        <div class="moodboard-toolbar">
            <div class="toolbar-left">
                <label>Look:</label>
                <select id="moodboard-look-select" onchange="changeMoodboardLook(this.value)">
                    <option value="all" ${currentLookId === 'all' ? 'selected' : ''}>All Looks</option>
                    ${looks.map(look => `
                        <option value="${look.id}" ${currentLookId === look.id ? 'selected' : ''}>
                            ${escapeHtml(look.name)}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="toolbar-right">
                <button class="toolbar-btn" onclick="addImageToMoodboard()">+ Add Image</button>
                <button class="toolbar-btn" onclick="addNoteToMoodboard()">+ Add Note</button>
                <button class="toolbar-btn" onclick="addSwatchToMoodboard()">+ Add Colour</button>
                <button class="toolbar-btn danger" onclick="clearMoodboard()">Clear All</button>
            </div>
        </div>

        <!-- Canvas Container -->
        <div class="moodboard-canvas-container">
            <div class="moodboard-canvas" id="moodboard-canvas"
                 ondragover="handleCanvasDragOver(event)"
                 ondrop="handleCanvasDrop(event)">
                ${moodboardState.elements.length === 0 ? `
                    <div class="canvas-placeholder" id="canvas-placeholder">
                        <p>Drag and drop images here or use the toolbar to add elements</p>
                        <p class="hint">This is your creative space - arrange freely</p>
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Canvas Controls -->
        <div class="canvas-controls">
            <span class="control-hint">Drag to move | Double-click to edit | Click to select</span>
            <div class="zoom-controls">
                <button onclick="zoomMoodboard('out')">-</button>
                <span id="zoom-level">${moodboardState.zoom}%</span>
                <button onclick="zoomMoodboard('in')">+</button>
                <button onclick="resetMoodboardZoom()">Reset</button>
            </div>
        </div>

        <!-- Hidden file input -->
        <input type="file" id="moodboard-image-upload" accept="image/*" onchange="handleMoodboardImageUpload(event)" hidden>
    `;

    // Render existing elements
    renderMoodboardElements();
}

// ═══════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function loadMoodboardState(lookId) {
    const castEntry = window.currentCastEntry;
    if (!castEntry) return;

    const design = castEntry.lookDesigns?.[lookId];
    if (design?.moodboard) {
        moodboardState.elements = design.moodboard.elements || [];
        moodboardState.zoom = design.moodboard.zoom || 100;
    } else {
        moodboardState.elements = [];
        moodboardState.zoom = 100;
    }
}

function saveMoodboardState() {
    const castEntry = window.currentCastEntry;
    const lookId = document.getElementById('moodboard-look-select')?.value || 'all';

    if (!castEntry?.id) return;

    if (!castEntry.lookDesigns) {
        castEntry.lookDesigns = {};
    }

    if (!castEntry.lookDesigns[lookId]) {
        castEntry.lookDesigns[lookId] = {};
    }

    castEntry.lookDesigns[lookId].moodboard = {
        elements: moodboardState.elements,
        zoom: moodboardState.zoom
    };

    updateCastEntry(castEntry.id, 'lookDesigns', castEntry.lookDesigns);
}

function changeMoodboardLook(lookId) {
    window.currentLookId = lookId;
    loadMoodboardState(lookId);
    renderMoodboardElements();
}

// ═══════════════════════════════════════════════════════════════
// ELEMENT RENDERING
// ═══════════════════════════════════════════════════════════════

function renderMoodboardElements() {
    const canvas = document.getElementById('moodboard-canvas');
    if (!canvas) return;

    // Clear existing elements (but keep placeholder structure)
    canvas.innerHTML = '';

    if (moodboardState.elements.length === 0) {
        canvas.innerHTML = `
            <div class="canvas-placeholder" id="canvas-placeholder">
                <p>Drag and drop images here or use the toolbar to add elements</p>
                <p class="hint">This is your creative space - arrange freely</p>
            </div>
        `;
        return;
    }

    moodboardState.elements.forEach((element, index) => {
        const el = createMoodboardElement(element, index);
        canvas.appendChild(el);
    });

    // Apply zoom
    canvas.style.transform = `scale(${moodboardState.zoom / 100})`;
    canvas.style.transformOrigin = 'top left';
}

function createMoodboardElement(element, index) {
    const wrapper = document.createElement('div');
    wrapper.className = `moodboard-element moodboard-${element.type}`;
    wrapper.dataset.index = index;
    wrapper.style.cssText = `
        position: absolute;
        left: ${element.x || 50}px;
        top: ${element.y || 50}px;
        cursor: move;
        user-select: none;
    `;

    switch (element.type) {
        case 'image':
            wrapper.innerHTML = `
                <img src="${element.src}" alt="Moodboard image"
                     style="max-width: ${element.width || 200}px; max-height: ${element.height || 200}px;
                            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            `;
            break;

        case 'note':
            wrapper.innerHTML = `
                <div style="background: rgba(255, 255, 200, 0.95); padding: 12px 16px;
                            border-radius: 4px; min-width: 150px; max-width: 250px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.2); color: #333;
                            font-size: 0.9em; line-height: 1.4;">
                    ${escapeHtml(element.text || 'Note')}
                </div>
            `;
            break;

        case 'swatch':
            wrapper.innerHTML = `
                <div style="width: 60px; height: 60px; background: ${element.color || '#c9a961'};
                            border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                            border: 2px solid rgba(255,255,255,0.2);">
                </div>
                <span style="display: block; text-align: center; margin-top: 4px;
                             font-size: 0.7em; color: var(--text-muted);">
                    ${element.color || '#c9a961'}
                </span>
            `;
            break;
    }

    // Make draggable
    makeDraggable(wrapper);

    // Delete on right-click
    wrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm('Delete this element?')) {
            deleteElement(index);
        }
    });

    return wrapper;
}

// ═══════════════════════════════════════════════════════════════
// DRAG AND DROP
// ═══════════════════════════════════════════════════════════════

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(element.style.left) || 0;
        initialTop = parseInt(element.style.top) || 0;

        element.style.zIndex = '1000';
        document.body.style.cursor = 'grabbing';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        element.style.left = (initialLeft + deltaX) + 'px';
        element.style.top = (initialTop + deltaY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.zIndex = '';
            document.body.style.cursor = '';

            // Save new position
            const index = parseInt(element.dataset.index);
            if (!isNaN(index) && moodboardState.elements[index]) {
                moodboardState.elements[index].x = parseInt(element.style.left);
                moodboardState.elements[index].y = parseInt(element.style.top);
                saveMoodboardState();
            }
        }
    });
}

function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleCanvasDrop(e) {
    e.preventDefault();

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        handleImageFile(files[0], x, y);
    }
}

// ═══════════════════════════════════════════════════════════════
// ADD ELEMENTS
// ═══════════════════════════════════════════════════════════════

function addImageToMoodboard() {
    document.getElementById('moodboard-image-upload')?.click();
}

function handleMoodboardImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    handleImageFile(file, 100, 100);
}

function handleImageFile(file, x, y) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const element = {
            type: 'image',
            src: e.target.result,
            x: x,
            y: y,
            width: 200,
            height: 200
        };

        moodboardState.elements.push(element);
        saveMoodboardState();
        renderMoodboardElements();
    };
    reader.readAsDataURL(file);
}

function addNoteToMoodboard() {
    const text = prompt('Enter note text:');
    if (!text) return;

    const element = {
        type: 'note',
        text: text,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200
    };

    moodboardState.elements.push(element);
    saveMoodboardState();
    renderMoodboardElements();
}

function addSwatchToMoodboard() {
    const color = prompt('Enter colour (hex code):', '#c9a961');
    if (!color) return;

    const element = {
        type: 'swatch',
        color: color,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200
    };

    moodboardState.elements.push(element);
    saveMoodboardState();
    renderMoodboardElements();
}

function deleteElement(index) {
    moodboardState.elements.splice(index, 1);
    saveMoodboardState();
    renderMoodboardElements();
}

function clearMoodboard() {
    if (!confirm('Clear all elements from this moodboard?')) return;

    moodboardState.elements = [];
    saveMoodboardState();
    renderMoodboardElements();
}

// ═══════════════════════════════════════════════════════════════
// ZOOM CONTROLS
// ═══════════════════════════════════════════════════════════════

function zoomMoodboard(direction) {
    if (direction === 'in') {
        moodboardState.zoom = Math.min(200, moodboardState.zoom + 10);
    } else {
        moodboardState.zoom = Math.max(50, moodboardState.zoom - 10);
    }

    updateZoom();
}

function resetMoodboardZoom() {
    moodboardState.zoom = 100;
    updateZoom();
}

function updateZoom() {
    const canvas = document.getElementById('moodboard-canvas');
    const zoomLabel = document.getElementById('zoom-level');

    if (canvas) {
        canvas.style.transform = `scale(${moodboardState.zoom / 100})`;
        canvas.style.transformOrigin = 'top left';
    }

    if (zoomLabel) {
        zoomLabel.textContent = `${moodboardState.zoom}%`;
    }

    saveMoodboardState();
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.initMoodboard = initMoodboard;
window.addImageToMoodboard = addImageToMoodboard;
window.addNoteToMoodboard = addNoteToMoodboard;
window.addSwatchToMoodboard = addSwatchToMoodboard;
window.clearMoodboard = clearMoodboard;
window.zoomMoodboard = zoomMoodboard;
window.resetMoodboardZoom = resetMoodboardZoom;
window.changeMoodboardLook = changeMoodboardLook;
window.handleMoodboardImageUpload = handleMoodboardImageUpload;
window.handleCanvasDragOver = handleCanvasDragOver;
window.handleCanvasDrop = handleCanvasDrop;

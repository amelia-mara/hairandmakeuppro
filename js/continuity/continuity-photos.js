/**
 * Live Continuity - Photos Module
 * Handles photo upload, collage generation, and image processing
 */

import { continuityState, showNotification } from './continuity-main.js';
import { showPhotoInSlot, hidePhotoInSlot, renderAdditionalPhotos } from './continuity-card.js';

// Current upload state
let currentUploadSlot = null;

// ============================================
// PHOTO UPLOAD
// ============================================

export function uploadToSlot(viewType) {
  currentUploadSlot = viewType;
  const input = document.getElementById('photo-upload-input');
  if (input) {
    input.accept = 'image/*';
    input.multiple = false;
    input.click();
  }
}

export function uploadAdditionalPhoto() {
  currentUploadSlot = 'additional';
  const input = document.getElementById('photo-upload-input');
  if (input) {
    input.accept = 'image/*';
    input.multiple = true;
    input.click();
  }
}

export function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  if (currentUploadSlot === 'additional') {
    // Handle multiple files for additional photos
    files.forEach(file => addAdditionalPhoto(file));
  } else if (currentUploadSlot) {
    // Handle single file for slot
    addPhotoToSlot(currentUploadSlot, files[0]);
  }

  // Reset input
  event.target.value = '';
  currentUploadSlot = null;
}

async function addPhotoToSlot(slot, file) {
  try {
    const dataUrl = await processImage(file);

    // Update UI
    showPhotoInSlot(slot, dataUrl);

    // Store in current card data
    if (!continuityState.currentCard.photos) {
      continuityState.currentCard.photos = {};
    }
    continuityState.currentCard.photos[slot] = dataUrl;

    // Regenerate collage
    await updateCollagePreview();

  } catch (error) {
    console.error('Error processing photo:', error);
    showNotification('Error processing photo', 'error');
  }
}

async function addAdditionalPhoto(file) {
  try {
    const dataUrl = await processImage(file);

    if (!continuityState.currentCard.additionalPhotos) {
      continuityState.currentCard.additionalPhotos = [];
    }

    const photoId = `additional-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    continuityState.currentCard.additionalPhotos.push({
      id: photoId,
      url: dataUrl,
      label: '',
      uploadedAt: new Date().toISOString()
    });

    renderAdditionalPhotos();

  } catch (error) {
    console.error('Error processing additional photo:', error);
    showNotification('Error processing photo', 'error');
  }
}

export function removeFromSlot(event, slot) {
  event.stopPropagation();

  hidePhotoInSlot(slot);

  if (continuityState.currentCard?.photos) {
    delete continuityState.currentCard.photos[slot];
  }

  updateCollagePreview();
}

// ============================================
// IMAGE PROCESSING
// ============================================

async function processImage(file, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Resize if too large
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG for smaller file size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ============================================
// COLLAGE GENERATION
// ============================================

export async function updateCollagePreview() {
  if (!continuityState.currentCard) return;

  const photos = continuityState.currentCard.photos || {};
  const hasAnyPhoto = Object.values(photos).some(p => p);

  const previewContainer = document.getElementById('collage-preview');

  if (!hasAnyPhoto) {
    if (previewContainer) previewContainer.classList.add('hidden');
    continuityState.currentCard.collage = null;
    return;
  }

  try {
    const collageDataUrl = await generateCollage(
      photos,
      continuityState.currentCard.sceneNumber
    );

    continuityState.currentCard.collage = collageDataUrl;

    if (previewContainer) {
      previewContainer.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Error generating collage:', error);
  }
}

export async function generateCollage(photos, sceneNumber) {
  const canvas = document.getElementById('collage-canvas');
  if (!canvas) {
    // Create offscreen canvas if not in DOM
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 800;
    offscreenCanvas.height = 800;
    return await renderCollageToCanvas(offscreenCanvas, photos, sceneNumber);
  }

  return await renderCollageToCanvas(canvas, photos, sceneNumber);
}

async function renderCollageToCanvas(canvas, photos, sceneNumber) {
  const ctx = canvas.getContext('2d');

  const width = 800;
  const height = 800;
  const panelWidth = width / 2;
  const panelHeight = height / 2;

  canvas.width = width;
  canvas.height = height;

  // Clear canvas with dark background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Panel positions: [x, y, label]
  const panels = [
    { key: 'front', x: 0, y: 0, label: 'FRONT' },
    { key: 'left', x: panelWidth, y: 0, label: 'LEFT' },
    { key: 'right', x: 0, y: panelHeight, label: 'RIGHT' },
    { key: 'back', x: panelWidth, y: panelHeight, label: 'BACK' }
  ];

  // Draw each panel
  for (const panel of panels) {
    const { key, x, y, label } = panel;

    if (photos[key]) {
      try {
        const img = await loadImage(photos[key]);

        // Calculate aspect-fit dimensions
        const scale = Math.min(panelWidth / img.width, panelHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = x + (panelWidth - drawWidth) / 2;
        const offsetY = y + (panelHeight - drawHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      } catch (error) {
        console.error(`Failed to load ${key} image:`, error);
        // Draw placeholder for failed image
        drawEmptyPanel(ctx, x, y, panelWidth, panelHeight, label);
      }
    } else {
      // Draw empty panel
      drawEmptyPanel(ctx, x, y, panelWidth, panelHeight, label);
    }

    // Add view label at bottom of panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y + panelHeight - 28, panelWidth, 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + panelWidth / 2, y + panelHeight - 14);
  }

  // Draw grid lines
  ctx.strokeStyle = 'rgba(201, 169, 97, 0.5)';
  ctx.lineWidth = 2;

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Draw scene number badge in center
  if (sceneNumber) {
    const centerX = width / 2;
    const centerY = height / 2;
    const badgeRadius = 35;

    // Badge background
    ctx.fillStyle = '#c9a961';
    ctx.beginPath();
    ctx.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Badge border
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Scene number text
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SC ${sceneNumber}`, centerX, centerY);
  }

  // Return as data URL
  return canvas.toDataURL('image/jpeg', 0.9);
}

function drawEmptyPanel(ctx, x, y, width, height, label) {
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);

  ctx.fillStyle = '#555';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// ============================================
// CLIPBOARD PASTE SUPPORT
// ============================================

document.addEventListener('paste', async (event) => {
  // Only handle paste if continuity card modal is open
  const modal = document.getElementById('continuity-card-modal');
  if (!modal || modal.style.display === 'none') return;

  const items = Array.from(event.clipboardData?.items || []);
  const imageItems = items.filter(item => item.type.startsWith('image/'));

  if (imageItems.length === 0) return;

  event.preventDefault();

  // Find first empty slot
  const slots = ['front', 'left', 'right', 'back'];
  const photos = continuityState.currentCard?.photos || {};

  let targetSlot = null;
  for (const slot of slots) {
    if (!photos[slot]) {
      targetSlot = slot;
      break;
    }
  }

  if (!targetSlot) {
    // All slots filled, add as additional photo
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        await addAdditionalPhoto(file);
      }
    }
  } else {
    // Add to first empty slot
    const file = imageItems[0].getAsFile();
    if (file) {
      await addPhotoToSlot(targetSlot, file);
    }
  }
});

// ============================================
// DRAG AND DROP SUPPORT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const captureArea = document.getElementById('photo-capture-area');
  if (!captureArea) return;

  captureArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    captureArea.classList.add('drag-over');
  });

  captureArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    captureArea.classList.remove('drag-over');
  });

  captureArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    captureArea.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    // Determine drop target
    const target = e.target.closest('.panel-slot');
    if (target) {
      const slot = target.dataset.view;
      if (slot && files[0]) {
        await addPhotoToSlot(slot, files[0]);
      }
    } else {
      // Add to empty slots or as additional
      const slots = ['front', 'left', 'right', 'back'];
      const photos = continuityState.currentCard?.photos || {};

      let fileIndex = 0;
      for (const slot of slots) {
        if (!photos[slot] && fileIndex < files.length) {
          await addPhotoToSlot(slot, files[fileIndex]);
          fileIndex++;
        }
      }

      // Remaining files as additional photos
      for (let i = fileIndex; i < files.length; i++) {
        await addAdditionalPhoto(files[i]);
      }
    }
  });
});

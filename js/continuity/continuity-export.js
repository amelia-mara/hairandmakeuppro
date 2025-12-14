/**
 * Live Continuity - Export Module
 * Handles PDF lookbook export and printing
 */

import {
  continuityState,
  getCastForCharacter,
  getShootDayForScene,
  showLoadingState,
  hideLoadingState,
  showNotification
} from './continuity-main.js';

import { renderLookbookView } from './continuity-views.js';

// ============================================
// FILTER LOOKBOOK
// ============================================

export function filterLookbook() {
  renderLookbookView();
}

// ============================================
// PRINT LOOKBOOK
// ============================================

export function printLookbook() {
  // Get the lookbook preview content
  const preview = document.getElementById('lookbook-preview');
  if (!preview || preview.children.length === 0) {
    showNotification('No lookbook content to print', 'warning');
    return;
  }

  // Create print window
  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${continuityState.projectName} - Lookbook</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', sans-serif;
          color: #1a1a1a;
          background: white;
        }

        .lookbook-page {
          padding: 40px;
          page-break-after: always;
          min-height: 100vh;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 2px solid #1a1a1a;
        }

        .project-info {
          font-size: 12px;
          color: #666;
        }

        .project-title {
          display: block;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .character-info h1 {
          font-size: 28px;
          font-weight: 700;
          text-align: right;
        }

        .character-info .actor {
          font-size: 14px;
          color: #666;
          text-align: right;
          display: block;
        }

        .lookbook-look-section {
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid #ddd;
        }

        .look-title-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .look-title-bar h2 {
          font-size: 16px;
          font-weight: 600;
          color: #b8860b;
        }

        .look-title-bar span {
          font-size: 12px;
          color: #666;
        }

        .look-content {
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
        }

        .master-display {
          flex-shrink: 0;
        }

        .master-collage {
          width: 180px;
          height: 180px;
          background: #f0f0f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .master-collage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .master-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
          margin-top: 8px;
        }

        .look-details {
          flex: 1;
        }

        .detail-section {
          margin-bottom: 12px;
        }

        .detail-section h4 {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .detail-section p {
          font-size: 11px;
          color: #444;
          line-height: 1.5;
        }

        .scene-strip {
          margin-bottom: 16px;
        }

        .strip-title {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 8px;
        }

        .strip-thumbnails {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .strip-thumb {
          text-align: center;
        }

        .strip-thumb img {
          width: 45px;
          height: 45px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #ddd;
        }

        .strip-thumb span {
          display: block;
          font-size: 8px;
          color: #666;
          margin-top: 2px;
        }

        .look-notes h4 {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .look-notes p {
          font-size: 11px;
          color: #666;
          font-style: italic;
        }

        .lookbook-events-section {
          background: #f9f9f9;
          border-radius: 8px;
          padding: 16px;
          margin-top: 20px;
        }

        .lookbook-events-section h3 {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .event-entry {
          padding: 8px 0;
        }

        .event-name {
          font-weight: 600;
          color: #b8860b;
          font-size: 11px;
        }

        .event-timeline {
          font-size: 10px;
          color: #666;
        }

        .page-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #ddd;
          font-size: 10px;
          color: #999;
        }

        @media print {
          .lookbook-page {
            padding: 20mm;
          }
        }
      </style>
    </head>
    <body>
      ${preview.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for images to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

// ============================================
// EXPORT PDF
// ============================================

export async function exportLookbookPDF() {
  const characters = continuityState.confirmedCharacters;

  if (characters.length === 0) {
    showNotification('No characters to export', 'warning');
    return;
  }

  showLoadingState('Generating lookbook PDF...');

  try {
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
      throw new Error('jsPDF library not loaded');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let isFirstPage = true;

    for (const charName of characters) {
      const character = continuityState.continuityData.characters[charName];
      if (!character) continue;

      const looks = Object.values(character.looks || {});
      if (looks.length === 0) continue;

      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      await renderCharacterPagePDF(doc, charName, character, {
        pageWidth,
        pageHeight,
        margin,
        contentWidth
      });
    }

    hideLoadingState();

    // Download PDF
    const fileName = `${continuityState.projectName.replace(/[^a-z0-9]/gi, '_')}_Lookbook.pdf`;
    doc.save(fileName);

    showNotification('Lookbook PDF exported successfully', 'success');

  } catch (error) {
    hideLoadingState();
    console.error('PDF export error:', error);
    showNotification('Error exporting PDF: ' + error.message, 'error');
  }
}

async function renderCharacterPagePDF(doc, characterName, characterData, dims) {
  const { pageWidth, pageHeight, margin, contentWidth } = dims;
  const castEntry = getCastForCharacter(characterName);

  let y = margin;

  // Header
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(continuityState.projectName.toUpperCase(), margin, y);
  doc.text('Hair & Makeup Continuity', pageWidth - margin, y, { align: 'right' });

  y += 12;

  // Character name
  doc.setFontSize(24);
  doc.setTextColor(0);
  doc.text(characterName, margin, y);

  y += 8;

  // Actor name
  if (characterData.actorName || castEntry?.actorName) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(characterData.actorName || castEntry.actorName, margin, y);
    y += 8;
  }

  y += 8;

  // Divider line
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;

  // Each look
  for (const look of Object.values(characterData.looks || {})) {
    // Check if we need a new page
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    // Look title
    doc.setFontSize(14);
    doc.setTextColor(184, 134, 11); // Gold color
    doc.text(`LOOK ${look.lookId.replace('look-', '').toUpperCase()}: ${look.lookName.toUpperCase()}`, margin, y);

    y += 6;

    // Scenes range
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Scenes: ${look.scenes.join(', ')}`, margin, y);

    y += 10;

    // Master collage
    if (look.master?.collage) {
      try {
        // Add master image
        const imgData = look.master.collage;
        const imgWidth = 50;
        const imgHeight = 50;

        doc.addImage(imgData, 'JPEG', margin, y, imgWidth, imgHeight);

        // Products and details next to image
        const textX = margin + imgWidth + 10;

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text('Hair:', textX, y + 8);
        doc.setFontSize(9);
        doc.setTextColor(60);
        const hairProducts = formatProductsForPDF(look.products?.hair);
        doc.text(hairProducts || 'Not specified', textX + 15, y + 8);

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text('Makeup:', textX, y + 18);
        doc.setFontSize(9);
        doc.setTextColor(60);
        const makeupProducts = [
          formatProductsForPDF(look.products?.face),
          formatProductsForPDF(look.products?.eyes),
          formatProductsForPDF(look.products?.lips)
        ].filter(Boolean).join(', ');
        doc.text(makeupProducts || 'Not specified', textX + 20, y + 18, { maxWidth: contentWidth - imgWidth - 30 });

        // Master label
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`MASTER (Scene ${look.master.sceneNumber})`, margin, y + imgHeight + 5);

        y += imgHeight + 15;

      } catch (e) {
        console.warn('Failed to add master image:', e);
        y += 10;
      }
    } else {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('No master captured yet', margin, y);
      y += 10;
    }

    // Scene thumbnails (text only in PDF for simplicity)
    const capturedScenes = look.scenes.filter(s => look.sceneRecords[s]?.status === 'complete');
    if (capturedScenes.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Captured scenes: ${capturedScenes.join(', ')}`, margin, y);
      y += 8;
    }

    y += 15;
  }

  // Continuity events
  const events = characterData.continuityEvents || [];
  if (events.length > 0 && y < pageHeight - 40) {
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Continuity Events:', margin, y);
    y += 6;

    for (const event of events.slice(0, 3)) {
      doc.setFontSize(9);
      doc.setTextColor(184, 134, 11);
      doc.text(`• ${event.description || event.type}`, margin + 5, y);
      y += 5;

      if (event.progression) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        const timeline = event.progression.map(p => `Sc ${p.sceneIndex}: ${p.stage}`).join(' → ');
        doc.text(timeline, margin + 10, y, { maxWidth: contentWidth - 20 });
        y += 5;
      }
    }
  }

  // Page footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Generated by Hair & Makeup Pro', margin, pageHeight - 10);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
}

function formatProductsForPDF(products) {
  if (!products) return '';
  if (Array.isArray(products)) {
    return products.join(', ');
  }
  return products;
}

// ============================================
// EXPORT DATA
// ============================================

export function exportContinuityData() {
  const data = {
    projectName: continuityState.projectName,
    exportDate: new Date().toISOString(),
    continuityData: continuityState.continuityData
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${continuityState.projectName.replace(/[^a-z0-9]/gi, '_')}_continuity_data.json`;
  a.click();

  URL.revokeObjectURL(url);

  showNotification('Continuity data exported', 'success');
}

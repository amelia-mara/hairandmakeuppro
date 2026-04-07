import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Extract text content from a PDF file with improved line structure preservation
 * Groups text items by Y position to reconstruct lines properly
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by Y position (line-by-line reconstruction)
    const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as TextItem[]) {
      if (!item.str || item.str.trim() === '') continue;

      // Round Y position to group items on the same line (allow 2px tolerance)
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    // Sort lines by Y position (top to bottom, so descending Y)
    const sortedYPositions = Array.from(lines.keys()).sort((a, b) => b - a);

    for (const y of sortedYPositions) {
      const lineItems = lines.get(y)!;
      // Sort items within line by X position (left to right)
      lineItems.sort((a, b) => a.x - b.x);

      // Reconstruct line with proper spacing
      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of lineItems) {
        // Calculate gap between items
        const gap = item.x - (lastX + lastWidth);

        // Add spaces for significant gaps (indicates word separation)
        if (lastX > 0 && gap > 3) {
          // Large gap might indicate tab/column separation
          if (gap > 20) {
            lineText += '    '; // Tab-like spacing
          } else {
            lineText += ' ';
          }
        }

        lineText += item.text;
        lastX = item.x;
        lastWidth = item.width;
      }

      fullText += lineText.trimEnd() + '\n';
    }

    fullText += '\n'; // Page break
  }

  // Normalize the text for better script parsing
  return normalizeScriptText(fullText);
}

/**
 * Normalize script text to fix common PDF extraction issues
 */
/**
 * Map of written-out number words to digits for scene heading normalization.
 * Handles formats like "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 */
const WORD_TO_NUMBER_MAP: Record<string, string> = {
  'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4', 'FIVE': '5',
  'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9', 'TEN': '10',
  'ELEVEN': '11', 'TWELVE': '12', 'THIRTEEN': '13', 'FOURTEEN': '14',
  'FIFTEEN': '15', 'SIXTEEN': '16', 'SEVENTEEN': '17', 'EIGHTEEN': '18',
  'NINETEEN': '19', 'TWENTY': '20', 'TWENTY-ONE': '21', 'TWENTY-TWO': '22',
  'TWENTY-THREE': '23', 'TWENTY-FOUR': '24', 'TWENTY-FIVE': '25',
  'TWENTY-SIX': '26', 'TWENTY-SEVEN': '27', 'TWENTY-EIGHT': '28',
  'TWENTY-NINE': '29', 'THIRTY': '30', 'THIRTY-ONE': '31', 'THIRTY-TWO': '32',
  'THIRTY-THREE': '33', 'THIRTY-FOUR': '34', 'THIRTY-FIVE': '35',
  'THIRTY-SIX': '36', 'THIRTY-SEVEN': '37', 'THIRTY-EIGHT': '38',
  'THIRTY-NINE': '39', 'FORTY': '40', 'FORTY-ONE': '41', 'FORTY-TWO': '42',
  'FORTY-THREE': '43', 'FORTY-FOUR': '44', 'FORTY-FIVE': '45',
  'FORTY-SIX': '46', 'FORTY-SEVEN': '47', 'FORTY-EIGHT': '48',
  'FORTY-NINE': '49', 'FIFTY': '50',
};

const SCENE_WORD_KEYS_SORTED = Object.keys(WORD_TO_NUMBER_MAP).sort((a, b) => b.length - a.length).join('|');
const SCENE_WORD_PREFIX_RE = new RegExp(
  `^\\s*SCENE\\s+(${SCENE_WORD_KEYS_SORTED})\\s*[:\\-–—]?\\s*`,
  'i'
);

/**
 * Normalize "SCENE WORD:" prefixes to numeric scene numbers.
 * e.g. "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 */
export function normalizeSceneWordPrefix(line: string): string {
  const match = line.match(SCENE_WORD_PREFIX_RE);
  if (match) {
    const num = WORD_TO_NUMBER_MAP[match[1].toUpperCase()];
    if (num) return num + ' ' + line.slice(match[0].length);
  }
  // Also handle "SCENE 2:" with numeric digit
  const numMatch = line.match(/^\s*SCENE\s+(\d+[A-Z]?)\s*[:\-–—]?\s*/i);
  if (numMatch) {
    return numMatch[1] + ' ' + line.slice(numMatch[0].length);
  }
  return line;
}

export function normalizeScriptText(text: string): string {
  let normalized = text
    // Fix split INT/EXT headings (e.g., "INT" on one line, ". LOCATION" on next)
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    // Fix split CONTINUOUS
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT['']?D/gi, "CONT'D")
    // Fix split character names with (V.O.) or (O.S.)
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Normalize multiple newlines (but keep paragraph breaks)
    .replace(/\n{4,}/g, '\n\n\n')
    // Clean up scene number patterns like "1 ." -> "1."
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();

  // Join character introductions split across line breaks (PDF word-wrap artifact).
  // When a line has content ending with an ALL CAPS word and the next line starts
  // with ALL CAPS word(s) followed by comma + age or comma + lowercase description,
  // join them into a single line.
  // e.g. "...on foot. JASPER\nMONTGOMERY, 70, he looks..." → single line
  normalized = normalized.replace(
    /([^\n]+\s[A-Z][A-Z'-]{2,})\s*\n\s*([A-Z][A-Z'-]{2,}(?:\s+[A-Z][A-Z'-]+){0,2}\s*,\s*(?:\d{1,3}\b|[a-z]))/g,
    '$1 $2',
  );

  // Normalize "SCENE WORD:" prefixes to numeric scene numbers
  normalized = normalized.split('\n').map(line => normalizeSceneWordPrefix(line)).join('\n');

  return normalized;
}

/**
 * Extract text from Final Draft XML (FDX) format
 */
export function extractTextFromFDX(xmlContent: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const paragraphs = doc.querySelectorAll('Paragraph');

    let text = '';
    paragraphs.forEach((para) => {
      const type = para.getAttribute('Type');
      const textElements = para.querySelectorAll('Text');
      let paraText = '';

      textElements.forEach((textEl) => {
        paraText += textEl.textContent || '';
      });

      // Format based on type
      if (type === 'Scene Heading') {
        text += '\n' + paraText.trim() + '\n';
      } else if (type === 'Character') {
        text += '\n' + paraText.trim().toUpperCase() + '\n';
      } else if (type === 'Dialogue') {
        text += paraText.trim() + '\n';
      } else if (type === 'Action') {
        text += '\n' + paraText.trim() + '\n';
      } else {
        text += paraText.trim() + '\n';
      }
    });

    return text;
  } catch (e) {
    console.error('Error parsing FDX:', e);
    return xmlContent;
  }
}

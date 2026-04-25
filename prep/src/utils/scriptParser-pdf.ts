import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker — use the local bundled worker (v5 uses .mjs)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ━━━ PDF text extraction ━━━ */

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  let totalItemsSeen = 0;
  let totalItemsKept = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    // `includeMarkedContent: true` makes PDF.js emit text from inside
    // marked-content tags (tagged / accessibility-flagged PDFs that
    // wrap dialogue or action text). Without it, some scripts had
    // entire chunks of dialogue silently dropped because every line
    // inside a tagged span was filtered out.
    // `disableNormalization: true` keeps the original whitespace and
    // ligatures so we don't have characters squashed together.
    const textContent = await page.getTextContent({
      includeMarkedContent: true,
      disableNormalization: true,
    });

    const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as TextItem[]) {
      totalItemsSeen++;
      // includeMarkedContent emits non-text "marked" events (no `str`,
      // no `transform`). Skip those; they're metadata, not content.
      if (!item.str || !item.transform) continue;
      if (item.str.trim() === '') continue;
      totalItemsKept++;

      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    const sortedYPositions = Array.from(lines.keys()).sort((a, b) => b - a);

    for (const y of sortedYPositions) {
      const lineItems = lines.get(y)!;
      lineItems.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of lineItems) {
        const gap = item.x - (lastX + lastWidth);

        if (lastX > 0 && gap > 3) {
          if (gap > 20) {
            lineText += '    ';
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

    fullText += '\n';
  }

  // Visibility while debugging missing-content reports — logs are
  // small and only fire on upload, not at runtime.
  console.log(
    `[scriptParser] PDF text extracted: ${pdf.numPages} pages, ` +
    `${totalItemsKept}/${totalItemsSeen} items kept, ` +
    `${fullText.length} characters of raw text.`,
  );

  return normalizeScriptText(fullText);
}

/* ━━━ Text normalization ━━━ */

/** Written-out number words → digits for scene heading normalization */
const WORD_TO_NUMBER: Record<string, string> = {
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

const SCENE_WORD_KEYS = Object.keys(WORD_TO_NUMBER).sort((a, b) => b.length - a.length).join('|');
const SCENE_WORD_PREFIX_RE = new RegExp(
  `^\\s*(?:\\d+[A-Z]{0,4}\\s+)?SCENE\\s+(${SCENE_WORD_KEYS})\\s*[:\\-–—]?\\s*`, 'i',
);

/**
 * Normalize "SCENE WORD:" prefixes to numeric scene numbers.
 * e.g. "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 * e.g. "4 SCENE THREE: EXT. STREET - DAY 4" → "3 EXT. STREET - DAY 4"
 * A leading scene number before "SCENE" is discarded in favour of the word number.
 */
export function normalizeSceneWordPrefix(line: string): string {
  const match = line.match(SCENE_WORD_PREFIX_RE);
  if (match) {
    const num = WORD_TO_NUMBER[match[1].toUpperCase()];
    if (num) return num + ' ' + line.slice(match[0].length);
  }
  // Also handle "SCENE 2:" or "4 SCENE 2:" with numeric digit
  const numMatch = line.match(/^\s*(?:\d+[A-Z]{0,4}\s+)?SCENE\s+(\d+[A-Z]?)\s*[:\-–—]?\s*/i);
  if (numMatch) {
    return numMatch[1] + ' ' + line.slice(numMatch[0].length);
  }
  return line;
}

export function normalizeScriptText(text: string): string {
  let normalized = text
    // Normalize Unicode whitespace (non-breaking spaces, etc.) from PDF extraction
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT['']?D/gi, "CONT'D")
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();

  // Join character introductions split across line breaks (PDF word-wrap artifact).
  // When a line has content ending with an ALL CAPS word and the next line starts
  // with ALL CAPS word(s) followed by comma + age or comma + lowercase description,
  // join them into a single line.
  // e.g. "...on foot. JASPER\nMONTGOMERY, 70, he looks..." → single line
  // e.g. "...on foot. JASPER\nMONTGOMERY 70, he looks..." → single line (space before age)
  normalized = normalized.replace(
    /([^\n]+\s[A-Z][A-Z'-]{2,})\s*\n\s*([A-Z][A-Z'-]{2,}(?:\s+[A-Z][A-Z'-]+){0,2}\s*(?:[,(]\s*(?:\d{1,3}\b|[a-z])|\d{1,3}\s*,))/g,
    '$1 $2',
  );

  // Normalize "SCENE WORD:" prefixes to numeric scene numbers BEFORE splitting
  // so that "4 SCENE THREE: EXT. STREET - DAY" becomes "3 EXT. STREET - DAY"
  normalized = normalized.split('\n').map(l => normalizeSceneWordPrefix(l)).join('\n');

  // Split lines where a scene heading (INT./EXT. + LOCATION – TIME) is followed
  // by additional action text on the same line. PDF extraction sometimes merges
  // the heading and the first action line when they're vertically close.
  // e.g. "1 EXT. FARM LAND – DAY LENNON BOWIE, 28, IS A COWBOY..."
  //    → "1 EXT. FARM LAND – DAY\nLENNON BOWIE, 28, IS A COWBOY..."
  normalized = normalized.split('\n').map(line => {
    // Case 1: heading at START of line, followed by action text after the TOD
    if (/^(\d+[A-Z]?\s+)?(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s/i.test(line)) {
      const timeSplitRe = /(\s+[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME)\b)([\s].+)/i;
      const m = line.match(timeSplitRe);
      if (m && m.index != null) {
        const headingEnd = m.index + m[1].length;
        const overflow = line.slice(headingEnd);
        const trimmedOverflow = overflow.trim();
        if (trimmedOverflow.length > 3 &&
            !/^\(?(?:FLASHBACK|PRESENT|CONT'?D?|STOCK|ESTABLISHING)\)?$/i.test(trimmedOverflow) &&
            !/^\d+[A-Z]?\s*$/.test(trimmedOverflow)) {
          return line.slice(0, headingEnd) + '\n' + trimmedOverflow;
        }
      }
      return line;
    }

    // Case 2: action text from previous scene merged with a heading in the MIDDLE.
    // PDF extraction can merge adjacent lines when y-coordinates are close.
    // e.g. "He walks away. 6 EXT. GARDEN TERRACE - DAY 6"
    //    → "He walks away.\n6 EXT. GARDEN TERRACE - DAY 6"
    const midHeadingRe = /(.+?)\s+(\d+[A-Z]?\s+(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s.+[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME)\b.*)/i;
    const mid = line.match(midHeadingRe);
    if (mid) {
      return mid[1] + '\n' + mid[2];
    }

    return line;
  }).join('\n');

  return normalized;
}

/* ━━━ FDX extraction ━━━ */

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

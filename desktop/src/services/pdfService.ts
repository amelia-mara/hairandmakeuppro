import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
  };
}

export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: number) => void
): Promise<PDFExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const lineMap = new Map<number, { x: number; text: string }[]>();

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const y = Math.round((item as any).transform[5]);
      const x = (item as any).transform[4];
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, text: (item as any).str });
    }

    // Sort by Y descending (top to bottom), then X ascending
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];

    for (const y of sortedYs) {
      const items = lineMap.get(y)!;
      items.sort((a, b) => a.x - b.x);
      const lineText = items.map((it) => it.text).join('');
      pageLines.push(lineText);
    }

    pages.push(pageLines.join('\n'));
    onProgress?.((i / pageCount) * 100);
  }

  let metadata: PDFExtractionResult['metadata'];
  try {
    const meta = await pdf.getMetadata();
    metadata = {
      title: (meta.info as any)?.Title || undefined,
      author: (meta.info as any)?.Author || undefined,
    };
  } catch {
    // metadata extraction is optional
  }

  return {
    text: pages.join('\n\n'),
    pageCount,
    metadata,
  };
}

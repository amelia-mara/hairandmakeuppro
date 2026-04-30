import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Row-aware extraction: groups items by y, sorts by x within each row, and
// emits tabs between large horizontal gaps so column structure survives. This
// is the same approach the schedule parser uses.
export async function extractTextFromPDF(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const rows = new Map<number, { x: number; text: string; w: number }[]>();
    for (const it of content.items as Array<{
      str: string;
      transform: number[];
      width?: number;
    }>) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      const x = it.transform[4];
      const list = rows.get(y) ?? [];
      list.push({ x, text: it.str, w: it.width || 0 });
      rows.set(y, list);
    }

    const ys = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x);
      let line = '';
      let lastX = 0;
      let lastW = 0;
      for (const it of items) {
        const gap = it.x - (lastX + lastW);
        if (lastX > 0 && gap > 15) line += '\t';
        else if (lastX > 0 && gap > 3) line += ' ';
        line += it.text;
        lastX = it.x;
        lastW = it.w;
      }
      out += line.trimEnd() + '\n';
    }
    out += `\n=== PAGE ${i} ===\n\n`;
  }
  return out;
}

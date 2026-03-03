import { parseScriptPDF } from '@/utils/scriptParser';
import type { ParsedScript } from '@/types';

export type UploadStage = 'idle' | 'reading' | 'extracting' | 'parsing' | 'detecting' | 'complete' | 'error';

export interface UploadProgress {
  stage: UploadStage;
  message: string;
}

/**
 * Process a PDF script file through the full pipeline
 */
export async function processScriptPDF(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<ParsedScript> {
  try {
    onProgress({ stage: 'reading', message: 'Reading PDF file...' });

    const result = await parseScriptPDF(file, (status) => {
      if (status.includes('Reading')) {
        onProgress({ stage: 'reading', message: status });
      } else if (status.includes('Extracting')) {
        onProgress({ stage: 'extracting', message: status });
      } else if (status.includes('scene')) {
        onProgress({ stage: 'parsing', message: status });
      } else if (status.includes('character') || status.includes('Detecting')) {
        onProgress({ stage: 'detecting', message: status });
      } else if (status.includes('Complete')) {
        onProgress({ stage: 'complete', message: `Found ${result?.scenes?.length || 0} scenes` });
      }
    });

    onProgress({
      stage: 'complete',
      message: `Found ${result.scenes.length} scenes and ${result.characters.length} characters`,
    });

    return result;
  } catch (error) {
    onProgress({
      stage: 'error',
      message: error instanceof Error ? error.message : 'Failed to process PDF',
    });
    throw error;
  }
}

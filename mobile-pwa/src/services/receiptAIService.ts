/**
 * Receipt AI Service - Extract data from receipt images using Claude Vision
 */

import { ensureSupportedImageFormat } from '@/utils/imageUtils';

interface ExtractedReceiptData {
  vendor: string;
  amount: number | null;
  vat: number | null;
  date: string | null;
  items: Array<{ name: string; price: number }>;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ReceiptExtractionResult {
  success: boolean;
  data: ExtractedReceiptData | null;
  error?: string;
}

/**
 * Extract receipt data from an image using Claude Vision API
 * @param imageDataUrl - Base64 data URL of the receipt image (e.g., "data:image/jpeg;base64,...")
 */
export async function extractReceiptData(imageDataUrl: string): Promise<ReceiptExtractionResult> {
  try {
    // Convert HEIC/HEIF or other unsupported formats to JPEG before sending to API
    const supportedDataUrl = await ensureSupportedImageFormat(imageDataUrl);

    // Parse the data URL to get base64 data and media type
    const matches = supportedDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return { success: false, data: null, error: 'Invalid image data format' };
    }

    const [, mediaType, base64Data] = matches;

    // Build the vision message with image and text
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Analyze this receipt image and extract the following information in JSON format:

{
  "vendor": "Store or supplier name",
  "amount": 123.45,
  "vat": 20.58,
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "Item description", "price": 12.34 }
  ],
  "currency": "GBP",
  "confidence": "high"
}

IMPORTANT INSTRUCTIONS:
1. "vendor" - Extract the store/supplier name (e.g., "Amazon", "Catwalk Hair & Cosmetics", "Boots")
2. "amount" - The TOTAL amount paid (as a number, not string). Look for "Total", "Grand Total", "Amount Due", etc. This should be the final amount INCLUDING VAT.
3. "vat" - The VAT amount (as a number, not string). Look for "VAT", "Tax", "Sales Tax", "GST", or similar. If multiple VAT lines, sum them. If the receipt shows a VAT rate but no amount, calculate it from the subtotal. Set to null if no VAT information is visible.
4. "date" - The receipt date in YYYY-MM-DD format. Convert from any format you see (e.g., "23 November 2025" → "2025-11-23")
5. "items" - List individual items with their prices. Include product names and individual prices.
6. "currency" - Detect currency from symbols (£=GBP, $=USD, €=EUR) or text. Default to "GBP" if unclear.
7. "confidence" - Set to "high" if all fields are clearly visible, "medium" if some are unclear, "low" if the image is hard to read.

If a field cannot be determined, use null for that field (except items which should be an empty array).
Return ONLY the JSON object, no markdown or explanation.`,
          },
        ],
      },
    ];

    const systemPrompt = `You are an expert receipt parser. Extract structured data from receipt images accurately.
Always return valid JSON. Be precise with numbers - do not include currency symbols in numeric fields.
For dates, always convert to YYYY-MM-DD format regardless of the source format.`;

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        system: systemPrompt,
        maxTokens: 2000,
        model: 'claude-sonnet-4-20250514',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content || data.content.length === 0) {
      throw new Error('Empty response from AI');
    }

    const responseText = data.content[0].text;

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse receipt data from AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clean up the extracted data
    const extractedData: ExtractedReceiptData = {
      vendor: typeof parsed.vendor === 'string' ? parsed.vendor.trim() : '',
      amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || null,
      vat: typeof parsed.vat === 'number' ? parsed.vat : parseFloat(parsed.vat) || null,
      date: validateDate(parsed.date),
      items: Array.isArray(parsed.items)
        ? parsed.items
            .filter((item: any) => item && typeof item.name === 'string')
            .map((item: any) => ({
              name: item.name.trim(),
              price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
            }))
        : [],
      currency: typeof parsed.currency === 'string' ? parsed.currency.toUpperCase() : 'GBP',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    };


    return { success: true, data: extractedData };
  } catch (error) {
    console.error('[ReceiptAI] Extraction failed:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to extract receipt data',
    };
  }
}

/**
 * Validate and format date string to YYYY-MM-DD
 */
function validateDate(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return dateStr;
    }
  }

  // Try parsing various formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Build a description string from extracted items
 */
export function buildDescriptionFromItems(items: Array<{ name: string; price: number }>): string {
  if (!items || items.length === 0) {
    return '';
  }

  // Take first 3 items to create a summary
  const itemNames = items.slice(0, 3).map((item) => item.name);
  let description = itemNames.join(', ');

  if (items.length > 3) {
    description += ` +${items.length - 3} more`;
  }

  return description;
}

/**
 * Receipt AI Service — Vision-based receipt extraction for prep.
 *
 * Ports the mobile-pwa flow but adds category mapping: instead of
 * returning a free-form `category` string, the AI receives the
 * project's own budget categories (Makeup / Hair / SFX / etc.)
 * and is asked to pick the closest matching id. That way the
 * Add Receipt modal can pre-select a category pill rather than
 * relying on the user to map "skincare aisle" → "Makeup" by hand.
 */

import { ensureSupportedImageFormat } from '@/utils/imageUtils';

interface CategoryOption {
  id: string;
  name: string;
}

export interface ExtractedReceiptData {
  vendor: string;
  amount: number | null;
  vat: number | null;
  date: string | null;
  items: Array<{ name: string; price: number }>;
  /** id from the supplied category list, or null if no good match. */
  categoryId: string | null;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ReceiptExtractionResult {
  success: boolean;
  data: ExtractedReceiptData | null;
  error?: string;
}

export async function extractReceiptData(
  imageDataUrl: string,
  categories: CategoryOption[] = [],
): Promise<ReceiptExtractionResult> {
  try {
    // Convert HEIC/HEIF → JPEG before sending (Vision only accepts
    // jpeg/png/gif/webp).
    const supportedDataUrl = await ensureSupportedImageFormat(imageDataUrl);

    const matches = supportedDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return { success: false, data: null, error: 'Invalid image data format' };
    }
    const [, mediaType, base64Data] = matches;

    const categoryList = categories.length > 0
      ? categories.map((c) => `  - "${c.id}" (${c.name})`).join('\n')
      : '  (none provided — return null for categoryId)';

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
            text: `Analyze this receipt image and extract structured information.

Return ONLY a single JSON object with this shape:

{
  "vendor": "Store or supplier name",
  "amount": 123.45,
  "vat": 20.58,
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "Item description", "price": 12.34 }
  ],
  "categoryId": "makeup",
  "currency": "GBP",
  "confidence": "high"
}

EXTRACTION RULES:
1. "vendor" — Store/supplier name (e.g. "Boots", "Camera Ready Cosmetics", "Amazon")
2. "amount" — TOTAL paid INCLUDING VAT, as a number. Look for "Total", "Grand Total", "Amount Due"
3. "vat" — VAT/tax amount paid, as a number. Look for "VAT", "Tax", "GST". Sum if multiple lines. Set null if not visible.
4. "date" — Receipt date, ALWAYS in YYYY-MM-DD format ("23 Nov 2025" → "2025-11-23")
5. "items" — Individual line items with prices, name + price each
6. "categoryId" — Pick the SINGLE best-fit id from this list, based on what was bought:
${categoryList}
   Use null only if nothing fits at all.
7. "currency" — From symbols (£→GBP, $→USD, €→EUR) or text. Default "GBP"
8. "confidence" — "high" if all key fields were clearly visible, "medium" if some are guessed, "low" if hard to read

Numbers must be plain numbers, no currency symbols. Use null for any field you can't determine (except items which is []).
Return ONLY the JSON object, no markdown fences or explanation.`,
          },
        ],
      },
    ];

    const systemPrompt = `You are an expert receipt parser for a hair and makeup department's budget tracker. Extract structured data accurately. Always return valid JSON. Be precise with numbers — never include currency symbols in numeric fields. Always return dates in YYYY-MM-DD format. When picking a categoryId, choose the most specific reasonable match from the provided list.`;

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse receipt data from AI response');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse receipt data — AI response contained invalid JSON');
    }

    // Validate the categoryId actually maps to one we sent — guards
    // against hallucinated ids.
    const validIds = new Set(categories.map((c) => c.id));
    const rawCategoryId = typeof parsed.categoryId === 'string' ? parsed.categoryId : null;
    const categoryId = rawCategoryId && validIds.has(rawCategoryId) ? rawCategoryId : null;

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((item: unknown): item is { name: unknown; price: unknown } =>
            typeof item === 'object' && item !== null && 'name' in item)
          .map((item) => ({
            name: typeof item.name === 'string' ? item.name.trim() : '',
            price: typeof item.price === 'number'
              ? item.price
              : parseFloat(String(item.price)) || 0,
          }))
          .filter((item) => item.name.length > 0)
      : [];

    const extractedData: ExtractedReceiptData = {
      vendor: typeof parsed.vendor === 'string' ? parsed.vendor.trim() : '',
      amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(String(parsed.amount)) || null,
      vat: typeof parsed.vat === 'number' ? parsed.vat : parseFloat(String(parsed.vat)) || null,
      date: validateDate(parsed.date),
      items,
      categoryId,
      currency: typeof parsed.currency === 'string' ? parsed.currency.toUpperCase() : 'GBP',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence as string)
        ? (parsed.confidence as 'high' | 'medium' | 'low')
        : 'medium',
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

function validateDate(dateStr: unknown): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return dateStr;
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  return null;
}

/** Build a short description from extracted line items for the
 *  Notes field. "Foundation, Brushes +5 more" style. */
export function buildDescriptionFromItems(items: Array<{ name: string; price: number }>): string {
  if (!items || items.length === 0) return '';
  const itemNames = items.slice(0, 3).map((i) => i.name);
  let description = itemNames.join(', ');
  if (items.length > 3) description += ` +${items.length - 3} more`;
  return description;
}

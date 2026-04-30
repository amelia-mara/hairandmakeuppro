/**
 * Image utilities — minimal subset of the mobile-pwa version,
 * used by the receipt-extraction flow to ensure HEIC images are
 * re-encoded as JPEG before being sent to the Claude Vision API
 * (Vision only accepts jpeg/png/gif/webp).
 */

const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_QUALITY = 0.8;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function isSupportedImageType(mediaType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mediaType.toLowerCase());
}

/**
 * Convert an image data URL to a JPEG if it's in a format the
 * Vision API doesn't accept (most commonly HEIC from iOS photos).
 * Returns the original data URL if it's already supported.
 */
export async function ensureSupportedImageFormat(dataUrl: string): Promise<string> {
  const matches = dataUrl.match(/^data:([^;]+);base64,/);
  if (!matches) return dataUrl;

  const mediaType = matches[1].toLowerCase();
  if (isSupportedImageType(mediaType)) return dataUrl;

  const blob = base64ToBlob(dataUrl);
  const converted = await compressImage(blob, MAX_IMAGE_DIMENSION, IMAGE_QUALITY);
  return blobToBase64(converted);
}

export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const byteString = atob(data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  return new Blob([uint8Array], { type: mime });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(
  blob: Blob,
  maxDimension: number = MAX_IMAGE_DIMENSION,
  quality: number = IMAGE_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (resultBlob) => {
          if (resultBlob) resolve(resultBlob);
          else reject(new Error('Failed to compress image'));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

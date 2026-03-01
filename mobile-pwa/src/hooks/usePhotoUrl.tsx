import { useState, useEffect } from 'react';
import { getPhotoBlob } from '@/db';
import type { Photo } from '@/types';

/**
 * Resolves a displayable URL for a Photo object.
 *
 * Priority:
 *  1. photo.thumbnail or photo.uri if already populated (base64 data URIs)
 *  2. IndexedDB blob → creates an object URL (cleaned up on unmount)
 *  3. Falls back to '' (shows nothing / placeholder)
 */
export function usePhotoUrl(photo: Photo | undefined): string {
  // Fast path: use inline data if available
  const inlineUrl = photo?.thumbnail || photo?.uri || '';

  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    // If we already have a usable inline URL, skip IndexedDB lookup
    if (!photo?.id || inlineUrl) {
      setBlobUrl('');
      return;
    }

    let revoked = false;
    let objectUrl = '';

    getPhotoBlob(photo.id).then((entry) => {
      if (revoked || !entry) return;
      objectUrl = URL.createObjectURL(entry.blob);
      setBlobUrl(objectUrl);
    });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo?.id, inlineUrl]);

  return inlineUrl || blobUrl;
}

/**
 * Drop-in <img> replacement that resolves the Photo's display URL
 * from inline data or IndexedDB blobs. Safe to use inside .map() loops
 * since each instance is its own component with its own hook call.
 */
export function PhotoImg({
  photo,
  alt,
  className,
}: {
  photo: Photo;
  alt: string;
  className?: string;
}) {
  const src = usePhotoUrl(photo);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}

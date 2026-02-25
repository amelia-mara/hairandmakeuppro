import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'continuity-photos';
const DOCUMENTS_BUCKET = 'project-documents';

export interface UploadResult {
  path: string;
  url: string;
}

// Upload a photo to Supabase Storage
export async function uploadPhoto(
  projectId: string,
  characterId: string,
  file: File | Blob,
  _fileName?: string // Unused but kept for API compatibility
): Promise<{ result: UploadResult | null; error: Error | null }> {
  try {
    // Generate unique filename
    const extension = file instanceof File ? file.name.split('.').pop() : 'jpg';
    const photoId = uuidv4();
    const path = `${projectId}/${characterId}/${photoId}.${extension}`;

    // Upload file
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return {
      result: {
        path: data.path,
        url: urlData.publicUrl,
      },
      error: null,
    };
  } catch (error) {
    return { result: null, error: error as Error };
  }
}

// Upload a base64 image
export async function uploadBase64Photo(
  projectId: string,
  characterId: string,
  base64Data: string,
  _mimeType: string = 'image/jpeg' // Unused but kept for API compatibility
): Promise<{ result: UploadResult | null; error: Error | null }> {
  try {
    // Convert base64 to blob
    const base64Response = await fetch(base64Data);
    const blob = await base64Response.blob();

    return uploadPhoto(projectId, characterId, blob);
  } catch (error) {
    return { result: null, error: error as Error };
  }
}

// Get a signed URL for a private photo (expires in 1 hour)
export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;

    return { url: data.signedUrl, error: null };
  } catch (error) {
    return { url: null, error: error as Error };
  }
}

// Get multiple signed URLs
export async function getSignedUrls(
  paths: string[],
  expiresIn: number = 3600
): Promise<{ urls: Record<string, string>; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(paths, expiresIn);

    if (error) throw error;

    const urls: Record<string, string> = {};
    data?.forEach((item) => {
      if (item.signedUrl && item.path) {
        urls[item.path] = item.signedUrl;
      }
    });

    return { urls, error: null };
  } catch (error) {
    return { urls: {}, error: error as Error };
  }
}

// Delete a photo
export async function deletePhoto(
  path: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Delete multiple photos
export async function deletePhotos(
  paths: string[]
): Promise<{ error: Error | null }> {
  try {
    if (paths.length === 0) return { error: null };

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// List photos in a project
export async function listProjectPhotos(
  projectId: string
): Promise<{ files: { name: string; path: string }[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(projectId, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) throw error;

    const files = (data || []).map((file) => ({
      name: file.name,
      path: `${projectId}/${file.name}`,
    }));

    return { files, error: null };
  } catch (error) {
    return { files: [], error: error as Error };
  }
}

// Download a photo as blob
export async function downloadPhoto(
  path: string
): Promise<{ blob: Blob | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error) throw error;

    return { blob: data, error: null };
  } catch (error) {
    return { blob: null, error: error as Error };
  }
}

// ============================================================================
// Project Documents (call sheets, scripts, schedules)
// ============================================================================

// Upload a document (PDF) to the project-documents bucket
export async function uploadDocument(
  projectId: string,
  folder: 'call-sheets' | 'scripts' | 'schedules',
  file: File | Blob,
  fileName?: string
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const ext = fileName?.split('.').pop() || 'pdf';
    const docId = uuidv4();
    const path = `${projectId}/${folder}/${docId}.${ext}`;

    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, {
        contentType: file instanceof File ? file.type : 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;
    return { path, error: null };
  } catch (error) {
    return { path: null, error: error as Error };
  }
}

// Upload a base64 data URI as a document
export async function uploadBase64Document(
  projectId: string,
  folder: 'call-sheets' | 'scripts' | 'schedules',
  base64DataUri: string
): Promise<{ path: string | null; error: Error | null }> {
  try {
    const response = await fetch(base64DataUri);
    const blob = await response.blob();
    return uploadDocument(projectId, folder, blob, 'document.pdf');
  } catch (error) {
    return { path: null, error: error as Error };
  }
}

// Download a document and return as base64 data URI
export async function downloadDocumentAsDataUri(
  path: string
): Promise<{ dataUri: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(path);

    if (error) throw error;
    if (!data) throw new Error('No data returned');

    const dataUri = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(data);
    });

    return { dataUri, error: null };
  } catch (error) {
    return { dataUri: null, error: error as Error };
  }
}

// Get a signed URL for a document
export async function getDocumentSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return { url: data.signedUrl, error: null };
  } catch (error) {
    return { url: null, error: error as Error };
  }
}

import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { createPhotoFromBlob } from '@/utils/imageUtils';
import { Textarea } from '../ui';
import { AdditionalPhotosGrid, PhotoCapture, PhotoViewer } from '../photos';
import type { Photo, SceneCapture } from '@/types';

/**
 * Floor-team deviation card for a single SceneCapture.
 *
 * Owns its own photo-capture modal, photo-viewer modal, and a debounced
 * textarea wired to setDeviationNote. Self-contained so the parent
 * (CharacterProfile) only needs to mount it with a captureId.
 *
 * Renders:
 *   - A free-text note describing what differs from the lookbook
 *   - A photo grid for deviation evidence (separate from the hero
 *     continuity photo grid above)
 *   - A "Clear deviation" link once anything has been logged
 *
 * The presence of any non-empty note OR any deviation photo causes the
 * scene to be flagged in the scene list (see hasSceneDeviation).
 */
interface SceneDeviationSectionProps {
  capture: SceneCapture;
  characterName: string;
  sceneNumber: string;
}

export function SceneDeviationSection({
  capture,
  characterName,
  sceneNumber,
}: SceneDeviationSectionProps) {
  const { setDeviationNote, addDeviationPhoto, removeDeviationPhoto, clearDeviation } =
    useProjectStore();

  const [noteDraft, setNoteDraft] = useState(capture.deviation?.note ?? '');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const photos = capture.deviation?.photos ?? [];
  const note = capture.deviation?.note ?? '';
  const hasDeviation = note.trim().length > 0 || photos.length > 0;

  const handleNoteBlur = () => {
    if (noteDraft !== note) {
      setDeviationNote(capture.id, noteDraft);
    }
  };

  const handleCapture = async (blob: Blob) => {
    const photo = await createPhotoFromBlob(blob);
    addDeviationPhoto(capture.id, photo);
  };

  const handleView = (_p: Photo, index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleDeleteFromViewer = (photoId: string) => {
    removeDeviationPhoto(capture.id, photoId);
  };

  const handleClear = () => {
    setNoteDraft('');
    clearDeviation(capture.id);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-header">DEVIATION FROM LOOKBOOK</h3>
        {hasDeviation && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-warning text-white">
            LOGGED
          </span>
        )}
      </div>

      <p className="text-[11px] text-text-muted mb-2 leading-snug">
        Log anything that differs from the prep lookbook today. Self-contained,
        no Designer sign-off required. Marks the scene as flagged in the list.
      </p>

      <Textarea
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={handleNoteBlur}
        placeholder="Describe what changed (e.g. 'wig swapped to lace front', 'lipstick darker than reference')…"
        rows={3}
        className="resize-none"
      />

      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="field-label">DEVIATION PHOTOS</h4>
          <span className="text-[11px] text-text-light">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <AdditionalPhotosGrid
          photos={photos}
          onCapture={() => setCaptureOpen(true)}
          onView={handleView}
        />
      </div>

      {hasDeviation && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 text-[11px] font-semibold text-text-muted hover:text-text-primary touch-manipulation"
        >
          Clear deviation
        </button>
      )}

      <PhotoCapture
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={handleCapture}
        angle="additional"
        characterName={characterName}
        sceneNumber={sceneNumber}
        lookName="Deviation"
      />

      <PhotoViewer
        isOpen={viewerOpen}
        photos={photos}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
        onDelete={handleDeleteFromViewer}
      />
    </div>
  );
}

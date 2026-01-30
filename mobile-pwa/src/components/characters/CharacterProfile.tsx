import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { createPhotoFromBlob } from '@/utils/imageUtils';
import { formatEstimatedTime, formatSceneRange, getCaptureStatus } from '@/utils/helpers';
import type { Photo, PhotoAngle, ContinuityEvent, SFXDetails } from '@/types';
import { countFilledFields, countHairFields, countSFXFields } from '@/types';
import { Button, Accordion } from '../ui';
import { CharacterAvatar } from './CharacterAvatar';
import { PhotoGrid, AdditionalPhotosGrid, MasterReference, PhotoCapture, SceneThumbnailSlot, PhotoViewer } from '../photos';
import { QuickFlags } from '../continuity/QuickFlags';
import { ContinuityEvents } from '../continuity/ContinuityEvents';
import { AddEventModal } from '../continuity/AddEventModal';
import { MakeupForm } from '../forms/MakeupForm';
import { HairForm } from '../forms/HairForm';
import { SFXForm } from '../forms/SFXForm';
import { NotesForm } from '../forms/NotesForm';

interface CharacterProfileProps {
  sceneId: string;
  characterId: string;
}

export function CharacterProfile({ sceneId, characterId }: CharacterProfileProps) {
  const {
    currentProject,
    getCharacter,
    getScene,
    getLookForCharacterInScene,
    getOrCreateSceneCapture,
    getSceneCapture,
    updateSceneCapture,
    addPhotoToCapture,
    removePhotoFromCapture,
    toggleContinuityFlag,
    addContinuityEvent,
    removeContinuityEvent,
    updateSFXDetails,
    addSFXPhoto,
    removeSFXPhoto,
    markSceneComplete,
    copyToNextScene,
    setCurrentScene,
    sceneCaptures,
    updateLook,
  } = useProjectStore();

  const character = getCharacter(characterId);
  const scene = getScene(sceneId);
  const look = scene ? getLookForCharacterInScene(characterId, scene.sceneNumber) : undefined;

  // Get or create scene capture for this character/scene
  const capture = getSceneCapture(sceneId, characterId) || getOrCreateSceneCapture(sceneId, characterId);

  // Photo capture state
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureAngle, setCaptureAngle] = useState<PhotoAngle>('front');
  const [captureMaster, setCaptureMaster] = useState(false);
  const [captureSFX, setCaptureSFX] = useState(false);

  // Add event modal state
  const [addEventOpen, setAddEventOpen] = useState(false);

  // Photo viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSource, setViewerSource] = useState<'scene' | 'additional' | 'sfx'>('scene');

  if (!character || !scene || !currentProject) {
    return null;
  }

  const captureId = capture.id;

  // Handle photo capture
  const handleOpenCapture = (angle: PhotoAngle, isMaster: boolean = false, isSFX: boolean = false) => {
    setCaptureAngle(angle);
    setCaptureMaster(isMaster);
    setCaptureSFX(isSFX);
    setCaptureOpen(true);
  };

  const handlePhotoCapture = async (blob: Blob) => {
    const photo = await createPhotoFromBlob(blob, captureMaster || captureSFX ? undefined : captureAngle);

    if (captureSFX) {
      // Add to SFX reference photos
      addSFXPhoto(captureId, photo);
    } else if (captureMaster && look) {
      // Update look's master reference (would need store update)
      // For now, store as first additional photo or use separate logic
      addPhotoToCapture(captureId, photo, 'additional');
    } else {
      addPhotoToCapture(captureId, photo, captureAngle === 'additional' ? 'additional' : captureAngle);
    }
  };

  // Handle SFX details change
  const handleSFXChange = (sfx: SFXDetails) => {
    updateSFXDetails(captureId, sfx);
  };

  // Handle mark complete
  const handleMarkComplete = () => {
    markSceneComplete(sceneId);
  };

  // Handle copy to next scene
  const handleCopyToNext = () => {
    const nextSceneId = copyToNextScene(sceneId, characterId);
    if (nextSceneId) {
      setCurrentScene(nextSceneId);
    }
  };

  // Handle add continuity event
  const handleAddEvent = (event: Omit<ContinuityEvent, 'id'>) => {
    const newEvent: ContinuityEvent = {
      ...event,
      id: `event-${Date.now()}`,
    };
    addContinuityEvent(captureId, newEvent);
    setAddEventOpen(false);
  };

  // Handle viewing scene photos (front, left, right, back)
  const handleViewScenePhoto = (_photo: Photo, angle: PhotoAngle) => {
    // Build array of all scene photos that exist
    const scenePhotos: Photo[] = [];
    const angles: PhotoAngle[] = ['front', 'left', 'right', 'back'];
    let initialIndex = 0;

    angles.forEach((a) => {
      const p = capture.photos[a as keyof typeof capture.photos];
      if (p) {
        if (a === angle) {
          initialIndex = scenePhotos.length;
        }
        scenePhotos.push(p);
      }
    });

    setViewerPhotos(scenePhotos);
    setViewerInitialIndex(initialIndex);
    setViewerSource('scene');
    setViewerOpen(true);
  };

  // Handle viewing additional photos
  const handleViewAdditionalPhoto = (_photo: Photo, index: number) => {
    setViewerPhotos(capture.additionalPhotos);
    setViewerInitialIndex(index);
    setViewerSource('additional');
    setViewerOpen(true);
  };

  // Handle deleting photo from viewer
  const handleDeleteFromViewer = (photoId: string) => {
    if (viewerSource === 'scene') {
      // Find which angle this photo belongs to
      const angles: PhotoAngle[] = ['front', 'left', 'right', 'back'];
      for (const angle of angles) {
        const p = capture.photos[angle as keyof typeof capture.photos];
        if (p?.id === photoId) {
          removePhotoFromCapture(captureId, angle);
          break;
        }
      }
      // Update viewer photos
      setViewerPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else if (viewerSource === 'additional') {
      removePhotoFromCapture(captureId, 'additional', photoId);
      setViewerPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else if (viewerSource === 'sfx') {
      removeSFXPhoto(captureId, photoId);
      setViewerPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  // Get scenes in this look for thumbnail strip
  const lookScenes = look
    ? currentProject.scenes.filter(s => look.scenes.includes(s.sceneNumber))
    : [];

  return (
    <div className="mobile-container">
      <div className="px-4 py-4 space-y-2.5 pb-32">
        {/* Character header section */}
        <div className="flex items-start gap-3.5">
          <CharacterAvatar character={character} size="xl" />
          <div className="flex-1 min-w-0">
            <h2 className="text-character-name text-gold font-bold truncate">
              {character.name}
            </h2>
            <p className="text-[13px] text-text-muted mt-0.5">
              Scene {scene.sceneNumber} | {formatSluglineShort(scene.slugline)}
            </p>
          </div>
        </div>

        {/* Current look badge */}
        {look && (
          <div className="bg-input-bg rounded-[10px] px-4 py-3 flex justify-between items-center">
            <div>
              <span className="text-sm font-bold text-gold">{look.name}</span>
              <span className="text-xs text-text-muted ml-2.5">
                Scenes {formatSceneRange(look.scenes)}
              </span>
            </div>
            <span className="text-xs text-text-muted font-medium">
              ~{formatEstimatedTime(look.estimatedTime)}
            </span>
          </div>
        )}

        {/* Scene Photos Section */}
        <div className="card">
          <h3 className="section-header mb-3">SCENE PHOTOS</h3>
          <PhotoGrid
            photos={capture.photos}
            onCapture={(angle) => handleOpenCapture(angle)}
            onView={handleViewScenePhoto}
          />
        </div>

        {/* Master Reference Section */}
        <div className="card">
          <h3 className="section-header mb-3">MASTER REFERENCE</h3>
          <MasterReference
            photo={look?.masterReference}
            onCapture={() => handleOpenCapture('front', true)}
          />
        </div>

        {/* Scenes in This Look */}
        {lookScenes.length > 1 && (
          <div className="card">
            <h3 className="section-header mb-3">SCENES IN THIS LOOK</h3>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
              {lookScenes.map((lookScene) => {
                const sceneCapture = sceneCaptures[`${lookScene.id}-${characterId}`];
                const hasCaptured = sceneCapture ? getCaptureStatus(sceneCapture) !== 'not-started' : false;

                // Get the first available thumbnail (front > left > right > back > additional)
                let thumbnailUrl: string | undefined;
                if (sceneCapture) {
                  const { photos, additionalPhotos } = sceneCapture;
                  const firstPhoto = photos.front || photos.left || photos.right || photos.back || additionalPhotos[0];
                  thumbnailUrl = firstPhoto?.thumbnail || firstPhoto?.uri;
                }

                return (
                  <SceneThumbnailSlot
                    key={lookScene.id}
                    sceneNumber={lookScene.sceneNumber}
                    hasCaptured={hasCaptured}
                    isActive={lookScene.id === sceneId}
                    onClick={() => setCurrentScene(lookScene.id)}
                    thumbnailUrl={thumbnailUrl}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Photos Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-header">ADDITIONAL PHOTOS</h3>
            <span className="text-[11px] text-text-light">
              {capture.additionalPhotos.length} photos
            </span>
          </div>
          <AdditionalPhotosGrid
            photos={capture.additionalPhotos}
            onCapture={() => handleOpenCapture('additional')}
            onView={handleViewAdditionalPhoto}
          />
        </div>

        {/* Quick Flags Section */}
        <div className="card">
          <h3 className="section-header mb-3">QUICK FLAGS</h3>
          <QuickFlags
            flags={capture.continuityFlags}
            onToggle={(flag) => toggleContinuityFlag(captureId, flag)}
          />
        </div>

        {/* Continuity Events Section */}
        <div className="card">
          <ContinuityEvents
            events={capture.continuityEvents}
            onAddEvent={() => setAddEventOpen(true)}
            onRemoveEvent={(eventId) => removeContinuityEvent(captureId, eventId)}
          />
        </div>

        {/* Accordion sections for Makeup, Hair, Notes */}
        <Accordion
          title="MAKEUP"
          count={look ? countFilledFields(look.makeup) : 0}
        >
          <MakeupForm
            makeup={look?.makeup}
            onChange={look ? (makeup) => updateLook(look.id, { makeup }) : undefined}
          />
        </Accordion>

        <Accordion
          title="HAIR"
          count={look ? countHairFields(look.hair) : 0}
        >
          <HairForm
            hair={look?.hair}
            onChange={look ? (hair) => updateLook(look.id, { hair }) : undefined}
          />
        </Accordion>

        <Accordion
          title="SPECIAL EFFECTS"
          count={countSFXFields(capture.sfxDetails)}
          badge={!capture.sfxDetails.sfxRequired ? 'None' : undefined}
        >
          <SFXForm
            sfx={capture.sfxDetails}
            onChange={handleSFXChange}
            onCapturePhoto={() => handleOpenCapture('additional', false, true)}
            onRemovePhoto={(photoId) => removeSFXPhoto(captureId, photoId)}
          />
        </Accordion>

        <Accordion title="SCENE NOTES">
          <NotesForm
            notes={capture.notes}
            onChange={(notes) => updateSceneCapture(captureId, { notes })}
          />
        </Accordion>

        {/* Application Time */}
        <div className="card flex items-center gap-3.5">
          <label className="field-label whitespace-nowrap">APPLICATION TIME</label>
          <input
            type="number"
            value={capture.applicationTime ?? look?.estimatedTime ?? ''}
            onChange={(e) => updateSceneCapture(captureId, {
              applicationTime: e.target.value ? parseInt(e.target.value, 10) : undefined
            })}
            className="input-field w-16 text-center font-semibold"
            placeholder="--"
            min="0"
          />
          <span className="text-sm text-text-muted">minutes</span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleMarkComplete}
            disabled={scene.isComplete}
          >
            {scene.isComplete ? 'Scene Completed' : 'Mark Scene Complete'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={handleCopyToNext}
          >
            Copy to Next Scene
          </Button>
        </div>
      </div>

      {/* Photo Capture Modal */}
      <PhotoCapture
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={handlePhotoCapture}
        angle={captureAngle}
        characterName={character.name}
        sceneNumber={scene.sceneNumber}
        lookName={look?.name}
      />

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        onAdd={handleAddEvent}
      />

      {/* Photo Viewer Modal */}
      <PhotoViewer
        isOpen={viewerOpen}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerOpen(false)}
        onDelete={handleDeleteFromViewer}
      />
    </div>
  );
}

// Helper function
function formatSluglineShort(slugline: string): string {
  return slugline
    .replace(/^(INT\.|EXT\.)\s*/i, '')
    .replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)\s*$/i, '')
    .split(' - ')[0];
}

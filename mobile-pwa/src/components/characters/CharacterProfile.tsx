import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { createPhotoFromBlob } from '@/utils/imageUtils';
import { formatEstimatedTime, formatSceneRange, getCaptureStatus } from '@/utils/helpers';
import type { PhotoAngle, ContinuityEvent, MakeupDetails, HairDetails } from '@/types';
import { Button, Accordion, AccordionGroup } from '../ui';
import { CharacterAvatar } from './CharacterAvatar';
import { PhotoGrid, AdditionalPhotosGrid, MasterReference, PhotoCapture, SceneThumbnailSlot } from '../photos';
import { QuickFlags } from '../continuity/QuickFlags';
import { ContinuityEvents } from '../continuity/ContinuityEvents';
import { AddEventModal } from '../continuity/AddEventModal';
import { MakeupForm } from '../forms/MakeupForm';
import { HairForm } from '../forms/HairForm';
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
    markSceneComplete,
    copyToNextScene,
    setCurrentScene,
    sceneCaptures,
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

  // Add event modal state
  const [addEventOpen, setAddEventOpen] = useState(false);

  if (!character || !scene || !currentProject) {
    return null;
  }

  const captureId = capture.id;

  // Handle photo capture
  const handleOpenCapture = (angle: PhotoAngle, isMaster: boolean = false) => {
    setCaptureAngle(angle);
    setCaptureMaster(isMaster);
    setCaptureOpen(true);
  };

  const handlePhotoCapture = async (blob: Blob) => {
    const photo = await createPhotoFromBlob(blob, captureMaster ? undefined : captureAngle);

    if (captureMaster && look) {
      // Update look's master reference (would need store update)
      // For now, store as first additional photo or use separate logic
      addPhotoToCapture(captureId, photo, 'additional');
    } else {
      addPhotoToCapture(captureId, photo, captureAngle === 'additional' ? 'additional' : captureAngle);
    }
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

  // Get scenes in this look for thumbnail strip
  const lookScenes = look
    ? currentProject.scenes.filter(s => look.scenes.includes(s.sceneNumber))
    : [];

  return (
    <div className="mobile-container">
      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Character header section */}
        <div className="flex items-start gap-4">
          <CharacterAvatar character={character} size="xl" />
          <div className="flex-1 min-w-0">
            <h2 className="text-character-name text-gold font-bold truncate">
              {character.name}
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Scene {scene.sceneNumber} | {formatSluglineShort(scene.slugline)}
            </p>

            {/* Current look badge */}
            {look && (
              <div className="mt-3 bg-gold-50 rounded-lg px-3 py-2">
                <div className="text-sm font-semibold text-gold">{look.name}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Scenes {formatSceneRange(look.scenes)} • {formatEstimatedTime(look.estimatedTime)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scene Photos Section */}
        <section>
          <h3 className="section-header mb-3">SCENE PHOTOS</h3>
          <PhotoGrid
            photos={capture.photos}
            onCapture={(angle) => handleOpenCapture(angle)}
            onRemove={(angle) => removePhotoFromCapture(captureId, angle)}
          />
        </section>

        {/* Master Reference Section */}
        <section>
          <h3 className="section-header mb-3">MASTER REFERENCE</h3>
          <MasterReference
            photo={look?.masterReference}
            onCapture={() => handleOpenCapture('front', true)}
          />
        </section>

        {/* Scenes in This Look */}
        {lookScenes.length > 1 && (
          <section>
            <h3 className="section-header mb-3">SCENES IN THIS LOOK</h3>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {lookScenes.map((lookScene) => {
                const sceneCapture = sceneCaptures[`${lookScene.id}-${characterId}`];
                const hasCaptured = sceneCapture ? getCaptureStatus(sceneCapture) !== 'not-started' : false;

                return (
                  <SceneThumbnailSlot
                    key={lookScene.id}
                    sceneNumber={lookScene.sceneNumber}
                    hasCaptured={hasCaptured}
                    isActive={lookScene.id === sceneId}
                    onClick={() => setCurrentScene(lookScene.id)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Additional Photos Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-header">
              ADDITIONAL PHOTOS
              {capture.additionalPhotos.length > 0 && (
                <span className="ml-2 text-text-light">({capture.additionalPhotos.length})</span>
              )}
            </h3>
          </div>
          <AdditionalPhotosGrid
            photos={capture.additionalPhotos}
            onCapture={() => handleOpenCapture('additional')}
            onRemove={(photoId) => removePhotoFromCapture(captureId, 'additional', photoId)}
          />
        </section>

        {/* Quick Flags Section */}
        <section>
          <h3 className="section-header mb-3">QUICK FLAGS</h3>
          <QuickFlags
            flags={capture.continuityFlags}
            onToggle={(flag) => toggleContinuityFlag(captureId, flag)}
          />
        </section>

        {/* Continuity Events Section */}
        <section>
          <ContinuityEvents
            events={capture.continuityEvents}
            onAddEvent={() => setAddEventOpen(true)}
            onRemoveEvent={(eventId) => removeContinuityEvent(captureId, eventId)}
          />
        </section>

        {/* Accordion sections for Makeup, Hair, Notes */}
        <AccordionGroup>
          <Accordion
            title="MAKEUP"
            count={look ? countFilledMakeupFields(look.makeup) : 0}
          >
            <MakeupForm makeup={look?.makeup} readOnly />
          </Accordion>

          <Accordion
            title="HAIR"
            count={look ? countFilledHairFields(look.hair) : 0}
          >
            <HairForm hair={look?.hair} readOnly />
          </Accordion>

          <Accordion title="SCENE NOTES">
            <NotesForm
              notes={capture.notes}
              onChange={(notes) => updateSceneCapture(captureId, { notes })}
            />
          </Accordion>
        </AccordionGroup>

        {/* Application Time */}
        <section>
          <div className="flex items-center gap-3">
            <label className="field-label">APPLICATION TIME</label>
            <input
              type="number"
              value={capture.applicationTime ?? look?.estimatedTime ?? ''}
              onChange={(e) => updateSceneCapture(captureId, {
                applicationTime: e.target.value ? parseInt(e.target.value, 10) : undefined
              })}
              className="input-field w-20 text-center"
              placeholder="--"
              min="0"
            />
            <span className="text-sm text-text-muted">minutes</span>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="space-y-3">
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
        </section>
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
    </div>
  );
}

// Helper functions
function formatSluglineShort(slugline: string): string {
  return slugline
    .replace(/^(INT\.|EXT\.)\s*/i, '')
    .replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)\s*$/i, '')
    .split(' - ')[0];
}

function countFilledMakeupFields(makeup: MakeupDetails | undefined): number {
  if (!makeup) return 0;
  return Object.values(makeup).filter(v => v && v.trim() !== '').length;
}

function countFilledHairFields(hair: HairDetails | undefined): number {
  if (!hair) return 0;
  return Object.values(hair).filter(v => v && v.trim() !== '').length;
}

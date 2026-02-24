import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { createPhotoFromBlob } from '@/utils/imageUtils';
import { formatEstimatedTime, formatSceneRange } from '@/utils/helpers';
import type { Photo, PhotoAngle, ContinuityEvent, SFXDetails } from '@/types';
import {
  countFilledFields,
  countHairFields,
  countSFXFields,
  createEmptyContinuityFlags,
  createEmptySFXDetails,
} from '@/types';
import { Accordion } from '../ui';
import { CharacterAvatar } from '../characters/CharacterAvatar';
import { MasterReference, PhotoCapture, PhotoViewer } from '../photos';
import { QuickFlags } from '../continuity/QuickFlags';
import { ContinuityEvents } from '../continuity/ContinuityEvents';
import { AddEventModal } from '../continuity/AddEventModal';
import { MakeupForm } from '../forms/MakeupForm';
import { HairForm } from '../forms/HairForm';
import { SFXForm } from '../forms/SFXForm';
import { NotesForm } from '../forms/NotesForm';

interface LookOverviewProps {
  lookId: string;
  onBack: () => void;
  onSceneClick: (sceneId: string) => void;
}

export function LookOverview({ lookId, onBack, onSceneClick }: LookOverviewProps) {
  const {
    currentProject,
    getCharacter,
    sceneCaptures,
    updateLookWithPropagation,
    updateLook,
  } = useProjectStore();

  const [captureOpen, setCaptureOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [captureSFX, setCaptureSFX] = useState(false);

  const look = currentProject?.looks.find((l) => l.id === lookId);
  const character = look ? getCharacter(look.characterId) : undefined;

  if (!look || !character || !currentProject) {
    return null;
  }

  // Get scene data and front photos for carousel
  const lookScenes = currentProject.scenes.filter((s) =>
    look.scenes.includes(s.sceneNumber)
  );

  const sceneFrontPhotos = lookScenes.map((scene) => {
    const captureKey = `${scene.id}-${look.characterId}`;
    const capture = sceneCaptures[captureKey];
    const frontPhoto = capture?.photos.front;
    return {
      scene,
      frontPhoto,
      hasCaptured: !!capture && !!(capture.photos.front || capture.additionalPhotos.length > 0),
    };
  });

  // Look-level fields (with defaults)
  const lookFlags = look.continuityFlags || createEmptyContinuityFlags();
  const lookSfx = look.sfxDetails || createEmptySFXDetails();
  const lookNotes = look.notes || '';
  const lookEvents = look.continuityEvents || [];

  // Handle master reference capture
  const handleOpenCapture = (isSFX = false) => {
    setCaptureSFX(isSFX);
    setCaptureOpen(true);
  };

  const handlePhotoCapture = async (blob: Blob) => {
    const photo = await createPhotoFromBlob(blob);
    if (captureSFX) {
      // Add to look-level SFX reference photos
      const currentSfx = look.sfxDetails || createEmptySFXDetails();
      updateLookWithPropagation(look.id, {
        sfxDetails: {
          ...currentSfx,
          sfxReferencePhotos: [...currentSfx.sfxReferencePhotos, photo],
        },
      });
    } else {
      // Set as master reference
      updateLook(look.id, { masterReference: photo });
    }
  };

  const handleRemoveMasterReference = () => {
    updateLook(look.id, { masterReference: undefined });
  };

  const handleViewMasterReference = () => {
    if (look.masterReference) {
      setViewerPhotos([look.masterReference]);
      setViewerInitialIndex(0);
      setViewerOpen(true);
    }
  };

  // Handle continuity flags at look level
  const handleToggleFlag = (flag: keyof typeof lookFlags) => {
    const updatedFlags = { ...lookFlags, [flag]: !lookFlags[flag] };
    updateLookWithPropagation(look.id, { continuityFlags: updatedFlags });
  };

  // Handle continuity events at look level
  const handleAddEvent = (event: Omit<ContinuityEvent, 'id'>) => {
    const newEvent: ContinuityEvent = {
      ...event,
      id: `event-${Date.now()}`,
    };
    updateLook(look.id, {
      continuityEvents: [...lookEvents, newEvent],
    });
    setAddEventOpen(false);
  };

  const handleRemoveEvent = (eventId: string) => {
    updateLook(look.id, {
      continuityEvents: lookEvents.filter((e) => e.id !== eventId),
    });
  };

  // Handle SFX at look level
  const handleSFXChange = (sfx: SFXDetails) => {
    updateLookWithPropagation(look.id, { sfxDetails: sfx });
  };

  const handleRemoveSFXPhoto = (photoId: string) => {
    const currentSfx = look.sfxDetails || createEmptySFXDetails();
    updateLook(look.id, {
      sfxDetails: {
        ...currentSfx,
        sfxReferencePhotos: currentSfx.sfxReferencePhotos.filter(
          (p) => p.id !== photoId
        ),
      },
    });
  };

  // Handle notes at look level
  const handleNotesChange = (notes: string) => {
    updateLookWithPropagation(look.id, { notes });
  };

  // Handle photo deletion from viewer
  const handleDeleteFromViewer = (photoId: string) => {
    if (look.masterReference?.id === photoId) {
      handleRemoveMasterReference();
    }
    setViewerPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center -ml-1"
            >
              <svg
                className="w-5 h-5 text-text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-[17px] font-bold text-text-primary flex-1">
              Look Overview
            </h1>
          </div>
        </div>
      </div>

      <div className="mobile-container">
        <div className="px-4 py-4 space-y-2.5 pb-32">
          {/* Character + Look info */}
          <div className="flex items-start gap-3.5">
            <CharacterAvatar character={character} size="xl" />
            <div className="flex-1 min-w-0">
              <h2 className="text-character-name text-gold font-bold truncate">
                {character.name}
              </h2>
              <p className="text-sm font-semibold text-text-primary mt-0.5">
                {look.name}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Scenes {formatSceneRange(look.scenes)} •{' '}
                ~{formatEstimatedTime(look.estimatedTime)}
              </p>
            </div>
          </div>

          {/* Active Quick Flags shown as badges */}
          {(() => {
            const activeFlags = [
              { key: 'sweat', label: 'Sweat' },
              { key: 'dishevelled', label: 'Dishevelled' },
              { key: 'blood', label: 'Blood' },
              { key: 'dirt', label: 'Dirt' },
              { key: 'wetHair', label: 'Wet Hair' },
              { key: 'tears', label: 'Tears' },
            ].filter(
              ({ key }) =>
                lookFlags[key as keyof typeof lookFlags]
            );

            if (activeFlags.length === 0) return null;

            return (
              <div className="flex flex-wrap gap-2">
                {activeFlags.map(({ key, label }) => (
                  <span
                    key={key}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gold text-white"
                  >
                    {label}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Master Reference */}
          <div className="card">
            <h3 className="section-header mb-3">MASTER REFERENCE</h3>
            <MasterReference
              photo={look.masterReference}
              onCapture={() => handleOpenCapture(false)}
              onView={handleViewMasterReference}
              onRemove={look.masterReference ? handleRemoveMasterReference : undefined}
            />
            <p className="text-[11px] text-text-light mt-2">
              This reference applies to all scenes in this look
            </p>
          </div>

          {/* Scene Front Photos Carousel */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-header">SCENE CONTINUITY</h3>
              <span className="text-[11px] text-text-light">
                {sceneFrontPhotos.filter((s) => s.hasCaptured).length}/
                {sceneFrontPhotos.length} captured
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
              {sceneFrontPhotos.map(({ scene, frontPhoto, hasCaptured }) => (
                <button
                  key={scene.id}
                  onClick={() => onSceneClick(scene.id)}
                  className="flex-shrink-0 w-20 group"
                >
                  <div
                    className={`aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${
                      hasCaptured
                        ? 'border-gold bg-gray-100'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {frontPhoto ? (
                      <img
                        src={frontPhoto.thumbnail || frontPhoto.uri}
                        alt={`Scene ${scene.sceneNumber}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-center mt-1.5 text-[10px] font-semibold ${
                      hasCaptured ? 'text-gold' : 'text-text-muted'
                    }`}
                  >
                    Sc {scene.sceneNumber}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Flags */}
          <div className="card">
            <h3 className="section-header mb-3">QUICK FLAGS</h3>
            <QuickFlags flags={lookFlags} onToggle={handleToggleFlag} />
            <p className="text-[11px] text-text-light mt-2">
              Flags set here apply to all scenes in this look
            </p>
          </div>

          {/* Continuity Events */}
          <div className="card">
            <ContinuityEvents
              events={lookEvents}
              onAddEvent={() => setAddEventOpen(true)}
              onRemoveEvent={handleRemoveEvent}
            />
          </div>

          {/* Makeup Accordion */}
          <Accordion
            title="MAKEUP"
            count={countFilledFields(look.makeup)}
          >
            <MakeupForm
              makeup={look.makeup}
              onChange={(makeup) =>
                updateLookWithPropagation(look.id, { makeup })
              }
            />
          </Accordion>

          {/* Hair Accordion */}
          <Accordion
            title="HAIR"
            count={countHairFields(look.hair)}
          >
            <HairForm
              hair={look.hair}
              onChange={(hair) =>
                updateLookWithPropagation(look.id, { hair })
              }
            />
          </Accordion>

          {/* SFX Accordion */}
          <Accordion
            title="SPECIAL EFFECTS"
            count={countSFXFields(lookSfx)}
            badge={!lookSfx.sfxRequired ? 'None' : undefined}
          >
            <SFXForm
              sfx={lookSfx}
              onChange={handleSFXChange}
              onCapturePhoto={() => handleOpenCapture(true)}
              onRemovePhoto={handleRemoveSFXPhoto}
            />
          </Accordion>

          {/* Notes Accordion */}
          <Accordion title="LOOK NOTES">
            <NotesForm notes={lookNotes} onChange={handleNotesChange} />
            <p className="text-[11px] text-text-light mt-2">
              Notes set here auto-fill into all scenes for this look
            </p>
          </Accordion>

          {/* Application Time */}
          <div className="card flex items-center gap-3.5">
            <label className="field-label whitespace-nowrap">
              APPLICATION TIME
            </label>
            <input
              type="number"
              value={look.estimatedTime || ''}
              onChange={(e) =>
                updateLook(look.id, {
                  estimatedTime: e.target.value
                    ? parseInt(e.target.value, 10)
                    : 0,
                })
              }
              className="input-field w-16 text-center font-semibold"
              placeholder="--"
              min="0"
            />
            <span className="text-sm text-text-muted">minutes</span>
          </div>
        </div>
      </div>

      {/* Photo Capture Modal */}
      <PhotoCapture
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={handlePhotoCapture}
        angle={'front' as PhotoAngle}
        characterName={character.name}
        sceneNumber={look.scenes[0] || ''}
        lookName={look.name}
      />

      {/* Add Continuity Event Modal */}
      <AddEventModal
        isOpen={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        onAdd={handleAddEvent}
        availableScenes={look.scenes}
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

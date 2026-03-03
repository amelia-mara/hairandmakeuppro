import { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

export function LookEditorModal() {
  const project = useProjectStore((s) => s.currentProject);
  const addLook = useProjectStore((s) => s.addLook);
  const updateLook = useProjectStore((s) => s.updateLook);
  const deleteLook = useProjectStore((s) => s.deleteLook);
  const showModal = useUIStore((s) => s.showLookEditor);
  const setShowModal = useUIStore((s) => s.setShowLookEditor);
  const editingLookId = useUIStore((s) => s.editingLookId);
  const selectedCharacterName = useUIStore((s) => s.selectedCharacterName);
  const activeCenterTab = useUIStore((s) => s.activeCenterTab);

  const existingLook = useMemo(() => {
    if (!project || !editingLookId) return null;
    return project.looks.find((l) => l.id === editingLookId) || null;
  }, [project, editingLookId]);

  // Determine which character this look is for
  const characterName = selectedCharacterName || (activeCenterTab !== 'script' ? activeCenterTab : null);
  const character = useMemo(() => {
    if (!project || !characterName) return null;
    return project.characters.find((c) => c.name === characterName) || null;
  }, [project, characterName]);

  const [name, setName] = useState('');
  const [hair, setHair] = useState('');
  const [makeup, setMakeup] = useState('');
  const [sfx, setSfx] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedScenes, setAssignedScenes] = useState<Set<string>>(new Set());

  // Populate form when editing
  useEffect(() => {
    if (existingLook) {
      setName(existingLook.name);
      setHair(existingLook.hairDescription);
      setMakeup(existingLook.makeupDescription);
      setSfx(existingLook.sfxDescription || '');
      setNotes(existingLook.notes || '');
      setAssignedScenes(new Set(existingLook.assignedScenes));
    } else {
      setName('');
      setHair('');
      setMakeup('');
      setSfx('');
      setNotes('');
      setAssignedScenes(new Set());
    }
  }, [existingLook, showModal]);

  const characterScenes = useMemo(() => {
    if (!project || !characterName) return [];
    return project.scenes.filter((s) => s.characters.includes(characterName));
  }, [project, characterName]);

  const toggleScene = (sceneId: string) => {
    setAssignedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const handleSave = () => {
    if (!character || !name.trim()) return;

    if (existingLook) {
      updateLook(existingLook.id, {
        name,
        hairDescription: hair,
        makeupDescription: makeup,
        sfxDescription: sfx || undefined,
        notes: notes || undefined,
        assignedScenes: Array.from(assignedScenes),
      });
    } else {
      addLook({
        characterId: character.id,
        name,
        hairDescription: hair,
        makeupDescription: makeup,
        sfxDescription: sfx || undefined,
        notes: notes || undefined,
        assignedScenes: Array.from(assignedScenes),
      });
    }

    setShowModal(false);
  };

  const handleDelete = () => {
    if (existingLook) {
      deleteLook(existingLook.id);
      setShowModal(false);
    }
  };

  return (
    <Modal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      title={existingLook ? `Edit Look: ${existingLook.name}` : 'Create New Look'}
      size="lg"
    >
      <div className="space-y-4">
        <Input
          label="Look Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Day 1, Hero Look, Party Scene..."
        />

        <TextArea
          label="Hair"
          value={hair}
          onChange={(e) => setHair(e.target.value)}
          rows={3}
          placeholder="Describe the hair for this look..."
        />

        <TextArea
          label="Makeup"
          value={makeup}
          onChange={(e) => setMakeup(e.target.value)}
          rows={3}
          placeholder="Describe the makeup for this look..."
        />

        <TextArea
          label="SFX"
          value={sfx}
          onChange={(e) => setSfx(e.target.value)}
          rows={2}
          placeholder="SFX details (optional)..."
        />

        <TextArea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Additional notes..."
        />

        {/* Scene Assignment */}
        {characterScenes.length > 0 && (
          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide block mb-2">
              Assign to Scenes
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-white/5 rounded-lg p-2">
              {characterScenes.map((scene) => (
                <Checkbox
                  key={scene.id}
                  checked={assignedScenes.has(scene.id)}
                  onChange={() => toggleScene(scene.id)}
                  label={`${scene.number}. ${scene.location} - ${scene.timeOfDay}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-white/10">
          {existingLook ? (
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete Look</Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
              {existingLook ? 'Save Changes' : 'Create Look'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

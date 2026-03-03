import { useState, useCallback, useEffect } from 'react';
import { Modal, Button, Input, TextArea, Checkbox } from '@/components/ui';
import type { Look, Scene } from '@/types';

interface LookEditorModalProps {
  open: boolean;
  onClose: () => void;
  look?: Look;
  characterName: string;
  scenes: Scene[];
  onSave: (data: Omit<Look, 'id' | 'created' | 'modified'> | Partial<Look>) => void;
}

interface FormState {
  name: string;
  hairDescription: string;
  makeupDescription: string;
  sfxDescription: string;
  notes: string;
  assignedSceneIds: string[];
}

const emptyForm: FormState = {
  name: '',
  hairDescription: '',
  makeupDescription: '',
  sfxDescription: '',
  notes: '',
  assignedSceneIds: [],
};

export function LookEditorModal({
  open,
  onClose,
  look,
  characterName,
  scenes,
  onSave,
}: LookEditorModalProps) {
  const isEditing = Boolean(look);

  const [form, setForm] = useState<FormState>(emptyForm);

  // Reset form when modal opens or look changes
  useEffect(() => {
    if (open) {
      if (look) {
        setForm({
          name: look.name,
          hairDescription: look.hairDescription,
          makeupDescription: look.makeupDescription,
          sfxDescription: look.sfxDescription || '',
          notes: look.notes || '',
          assignedSceneIds: [...look.assignedSceneIds],
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, look]);

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleToggleScene = useCallback((sceneId: string) => {
    setForm((prev) => {
      const ids = prev.assignedSceneIds.includes(sceneId)
        ? prev.assignedSceneIds.filter((id) => id !== sceneId)
        : [...prev.assignedSceneIds, sceneId];
      return { ...prev, assignedSceneIds: ids };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) return;

    if (isEditing && look) {
      onSave({
        id: look.id,
        characterId: look.characterId,
        name: form.name.trim(),
        hairDescription: form.hairDescription,
        makeupDescription: form.makeupDescription,
        sfxDescription: form.sfxDescription || undefined,
        notes: form.notes || undefined,
        assignedSceneIds: form.assignedSceneIds,
      });
    } else {
      onSave({
        characterId: look?.characterId || '',
        name: form.name.trim(),
        hairDescription: form.hairDescription,
        makeupDescription: form.makeupDescription,
        sfxDescription: form.sfxDescription || undefined,
        notes: form.notes || undefined,
        assignedSceneIds: form.assignedSceneIds,
      });
    }

    onClose();
  }, [form, isEditing, look, onSave, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `Edit Look - ${characterName}` : `New Look - ${characterName}`}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>
            {isEditing ? 'Save Changes' : 'Create Look'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Name */}
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="e.g., Day Look, Gala Evening, Injured"
        />

        {/* Hair Description */}
        <TextArea
          label="Hair Description"
          value={form.hairDescription}
          onChange={(e) => updateField('hairDescription', e.target.value)}
          placeholder="Describe the hairstyle..."
          className="min-h-[80px]"
        />

        {/* Makeup Description */}
        <TextArea
          label="Makeup Description"
          value={form.makeupDescription}
          onChange={(e) => updateField('makeupDescription', e.target.value)}
          placeholder="Describe the makeup look..."
          className="min-h-[80px]"
        />

        {/* SFX Description */}
        <TextArea
          label="SFX Description"
          value={form.sfxDescription}
          onChange={(e) => updateField('sfxDescription', e.target.value)}
          placeholder="Special effects makeup, prosthetics, wounds..."
          className="min-h-[60px]"
        />

        {/* Notes */}
        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Additional notes..."
          className="min-h-[60px]"
        />

        {/* Scene assignment */}
        {scenes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Assign to Scenes
            </label>
            <div className="border border-border-default rounded-lg max-h-[200px] overflow-y-auto divide-y divide-border-subtle">
              {scenes.map((scene) => (
                <label
                  key={scene.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors-fast cursor-pointer"
                >
                  <Checkbox
                    checked={form.assignedSceneIds.includes(scene.id)}
                    onChange={() => handleToggleScene(scene.id)}
                  />
                  <span className="text-sm text-text-primary">
                    <span className="font-medium">Sc. {scene.number}</span>
                    <span className="text-text-muted ml-2">
                      {scene.intExt} - {scene.location}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

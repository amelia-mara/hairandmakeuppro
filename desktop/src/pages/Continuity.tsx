import { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  GitBranch,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Select,
  TextArea,
  Modal,
} from '@/components/ui';
import { useProjectStore } from '@/stores';
import type { ContinuityEvent } from '@/types';
import { generateId } from '@/utils/helpers';

const eventTypeOptions = [
  { value: 'injury', label: 'Injury' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'hair', label: 'Hair' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'prop', label: 'Prop' },
  { value: 'other', label: 'Other' },
];

const typeFilterOptions = [
  { value: 'all', label: 'All Types' },
  ...eventTypeOptions,
];

const typeBadgeVariant: Record<string, 'hair' | 'makeup' | 'sfx' | 'cast' | 'default'> = {
  injury: 'sfx',
  makeup: 'makeup',
  hair: 'hair',
  wardrobe: 'cast',
  prop: 'default',
  other: 'default',
};

export default function Continuity() {
  const { scenes, characters } = useProjectStore();

  const [events, setEvents] = useState<ContinuityEvent[]>([]);
  const [charFilter, setCharFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ContinuityEvent | null>(null);

  /* Form state */
  const [formCharId, setFormCharId] = useState('');
  const [formType, setFormType] = useState<ContinuityEvent['type']>('other');
  const [formDesc, setFormDesc] = useState('');
  const [formStartScene, setFormStartScene] = useState('');
  const [formEndScene, setFormEndScene] = useState('');

  const charFilterOptions = [
    { value: 'all', label: 'All Characters' },
    ...characters.map((c) => ({ value: c.id, label: c.name })),
  ];

  const sceneOptions = scenes.map((s) => ({
    value: s.id,
    label: `Sc ${s.number} - ${s.location}`,
  }));

  const filteredEvents = useMemo(() => {
    let result = events;
    if (charFilter !== 'all') {
      result = result.filter((e) => e.characterId === charFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter((e) => e.type === typeFilter);
    }
    return result;
  }, [events, charFilter, typeFilter]);

  const getCharName = (id: string) =>
    characters.find((c) => c.id === id)?.name ?? 'Unknown';

  const getSceneNumber = (id: string) =>
    scenes.find((s) => s.id === id)?.number ?? '?';

  const openAddModal = () => {
    setEditingEvent(null);
    setFormCharId(characters[0]?.id ?? '');
    setFormType('other');
    setFormDesc('');
    setFormStartScene(scenes[0]?.id ?? '');
    setFormEndScene('');
    setModalOpen(true);
  };

  const openEditModal = (event: ContinuityEvent) => {
    setEditingEvent(event);
    setFormCharId(event.characterId);
    setFormType(event.type);
    setFormDesc(event.description);
    setFormStartScene(event.startSceneId);
    setFormEndScene(event.endSceneId ?? '');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formCharId || !formDesc.trim() || !formStartScene) return;

    if (editingEvent) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? {
                ...e,
                characterId: formCharId,
                type: formType,
                description: formDesc.trim(),
                startSceneId: formStartScene,
                endSceneId: formEndScene || undefined,
              }
            : e
        )
      );
    } else {
      const newEvent: ContinuityEvent = {
        id: generateId(),
        characterId: formCharId,
        type: formType,
        description: formDesc.trim(),
        startSceneId: formStartScene,
        endSceneId: formEndScene || undefined,
      };
      setEvents((prev) => [...prev, newEvent]);
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  /* ---------------------------------------------------------------- */
  /*  Timeline Bar                                                    */
  /* ---------------------------------------------------------------- */

  const totalScenes = scenes.length;

  const TimelineBar = ({ event }: { event: ContinuityEvent }) => {
    const startIdx = scenes.findIndex((s) => s.id === event.startSceneId);
    const endIdx = event.endSceneId
      ? scenes.findIndex((s) => s.id === event.endSceneId)
      : startIdx;
    const safeStart = Math.max(0, startIdx);
    const safeEnd = Math.max(safeStart, endIdx);

    const leftPct = totalScenes > 0 ? (safeStart / totalScenes) * 100 : 0;
    const widthPct =
      totalScenes > 0
        ? Math.max(((safeEnd - safeStart + 1) / totalScenes) * 100, 2)
        : 2;

    return (
      <div className="flex items-center gap-3 py-1">
        <span className="text-xs text-text-muted w-28 truncate shrink-0 text-right">
          {getCharName(event.characterId)}
        </span>
        <div className="flex-1 h-5 bg-surface-hover rounded relative">
          <div
            className="absolute h-full rounded bg-gold/50 border border-gold/60"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            title={event.description}
          />
        </div>
        <Badge variant={typeBadgeVariant[event.type] ?? 'default'} className="shrink-0 w-20 justify-center">
          {event.type}
        </Badge>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary tracking-wide">
            CONTINUITY TRACKER
          </h1>
          <Badge variant="default">{events.length} events</Badge>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={openAddModal}
        >
          Add Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="w-52">
          <Select
            options={charFilterOptions}
            value={charFilter}
            onChange={(e) => setCharFilter(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={typeFilterOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Timeline Visualization */}
      {filteredEvents.length > 0 && totalScenes > 0 && (
        <Card padding="md">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Timeline
          </p>
          {/* Scene axis labels */}
          <div className="flex items-center gap-3 mb-2">
            <span className="w-28 shrink-0" />
            <div className="flex-1 flex justify-between text-[10px] text-text-muted px-1">
              <span>Sc {scenes[0]?.number}</span>
              {totalScenes > 2 && (
                <span>Sc {scenes[Math.floor(totalScenes / 2)]?.number}</span>
              )}
              <span>Sc {scenes[totalScenes - 1]?.number}</span>
            </div>
            <span className="w-20 shrink-0" />
          </div>
          <div className="space-y-1">
            {filteredEvents.map((event) => (
              <TimelineBar key={event.id} event={event} />
            ))}
          </div>
        </Card>
      )}

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <GitBranch className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">
            {events.length === 0
              ? 'No continuity events yet. Add one to track character changes across scenes.'
              : 'No events match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Events
          </p>
          {filteredEvents.map((event) => (
            <Card key={event.id} padding="md" className="flex items-start gap-4">
              {/* Character avatar */}
              <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-gold">
                  {getCharName(event.characterId).charAt(0)}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-text-primary">
                    {getCharName(event.characterId)}
                  </span>
                  <Badge variant={typeBadgeVariant[event.type] ?? 'default'}>
                    {event.type}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  {event.description}
                </p>
                <p className="text-xs text-text-muted mt-1.5">
                  Sc {getSceneNumber(event.startSceneId)}
                  {event.endSceneId &&
                    event.endSceneId !== event.startSceneId &&
                    ` \u2192 Sc ${getSceneNumber(event.endSceneId)}`}
                </p>
                {event.stages && event.stages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 text-xs text-text-muted">
                    {event.stages.map((stage, i) => (
                      <span key={i} className="bg-surface-hover px-2 py-0.5 rounded">
                        Sc {getSceneNumber(stage.sceneId)}: {stage.description}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEditModal(event)}
                  className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors-fast"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="p-1.5 text-text-muted hover:text-error rounded transition-colors-fast"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEvent ? 'Edit Event' : 'Add Continuity Event'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!formCharId || !formDesc.trim() || !formStartScene}
            >
              {editingEvent ? 'Save Changes' : 'Add Event'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Character"
            options={characters.map((c) => ({ value: c.id, label: c.name }))}
            value={formCharId}
            onChange={(e) => setFormCharId(e.target.value)}
          />
          <Select
            label="Type"
            options={eventTypeOptions}
            value={formType}
            onChange={(e) =>
              setFormType(e.target.value as ContinuityEvent['type'])
            }
          />
          <TextArea
            label="Description"
            placeholder="Describe the continuity event..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Start Scene"
              options={sceneOptions}
              value={formStartScene}
              onChange={(e) => setFormStartScene(e.target.value)}
            />
            <Select
              label="End Scene (optional)"
              options={[{ value: '', label: 'Same scene' }, ...sceneOptions]}
              value={formEndScene}
              onChange={(e) => setFormEndScene(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useCallback } from 'react';
import {
  BREAKDOWN_CATEGORIES,
  useTagStore,
  type ScriptTag,
} from '@/stores/breakdownStore';
import { FInput } from './form-primitives';

/**
 * Costume breakdown fields for a single character in a single scene.
 * Rendered inside CharBlock when the project department is 'costume'.
 * Fields: lookDescription, clothing, shoes, accessories, outerwear,
 * hairAndMakeupNotes, sfxNotes, environmental, action, changeNotes.
 */

export interface CostumeSceneBreakdown {
  lookDescription?: string;
  clothing?: string;
  shoes?: string;
  accessories?: string;
  outerwear?: string;
  hairAndMakeupNotes?: string;
  sfxNotes?: string;
  environmental?: string;
  action?: string;
  changeNotes?: string;
}

interface CostumeBreakdownFieldsProps {
  charId: string;
  sceneId: string;
  data: CostumeSceneBreakdown;
  onChange: (data: CostumeSceneBreakdown) => void;
}

export function CostumeBreakdownFields({ charId, sceneId, data, onChange }: CostumeBreakdownFieldsProps) {
  const update = (field: keyof CostumeSceneBreakdown, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const tagStore = useTagStore();
  const sceneTags = tagStore.getTagsForScene(sceneId).filter((t) => t.characterId === charId);
  const catColor = (id: string) => BREAKDOWN_CATEGORIES.find((c) => c.id === id)?.color || '#999';

  const handleDismissTag = useCallback((tag: ScriptTag) => { tagStore.dismissTag(tag.id); }, [tagStore]);
  const handleRestoreTag = useCallback((tag: ScriptTag) => { tagStore.restoreTag(tag.id); }, [tagStore]);

  const TagPills = ({ tags, color }: { tags: ScriptTag[]; color: string }) =>
    tags.length > 0 ? (
      <div className="cb-tag-row">
        {tags.map((t) => (
          <span
            key={t.id}
            className={`cb-tag-pill${t.dismissed ? ' cb-tag-pill--dismissed' : ''}`}
            style={{ borderColor: color, color }}
            onClick={t.dismissed ? () => handleRestoreTag(t) : undefined}
            title={t.dismissed ? 'Click to re-apply to field' : undefined}
          >
            {t.text}
            {!t.dismissed && (
              <button className="cb-tag-remove" onClick={() => handleDismissTag(t)}>×</button>
            )}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="cb-field">
        <FInput label="Look Description" value={data.lookDescription || ''} onChange={(v) => update('lookDescription', v)} />
      </div>

      <div className="cb-field">
        <FInput label="Clothing" value={data.clothing || ''} onChange={(v) => update('clothing', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'clothing')} color={catColor('clothing')} />
      </div>

      <div className="cb-field">
        <FInput label="Shoes" value={data.shoes || ''} onChange={(v) => update('shoes', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'shoes')} color={catColor('shoes')} />
      </div>

      <div className="cb-field">
        <FInput label="Accessories" value={data.accessories || ''} onChange={(v) => update('accessories', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'accessories')} color={catColor('accessories')} />
      </div>

      <div className="cb-field">
        <FInput label="Outerwear" value={data.outerwear || ''} onChange={(v) => update('outerwear', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'outerwear')} color={catColor('outerwear')} />
      </div>

      <div className="cb-field">
        <FInput label="Hair & Makeup Notes" value={data.hairAndMakeupNotes || ''} onChange={(v) => update('hairAndMakeupNotes', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'cos_hmu')} color={catColor('cos_hmu')} />
      </div>

      <div className="cb-field">
        <FInput label="SFX Notes" value={data.sfxNotes || ''} onChange={(v) => update('sfxNotes', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'cos_sfx')} color={catColor('cos_sfx')} />
      </div>

      <div className="cb-field">
        <FInput label="Environmental" value={data.environmental || ''} onChange={(v) => update('environmental', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'cos_env')} color={catColor('cos_env')} />
      </div>

      <div className="cb-field">
        <FInput label="Action" value={data.action || ''} onChange={(v) => update('action', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'cos_action')} color={catColor('cos_action')} />
      </div>

      <div className="cb-field">
        <FInput label="Change Notes" value={data.changeNotes || ''} onChange={(v) => update('changeNotes', v)} />
        <TagPills tags={sceneTags.filter((t) => t.categoryId === 'cos_change')} color={catColor('cos_change')} />
      </div>
    </>
  );
}

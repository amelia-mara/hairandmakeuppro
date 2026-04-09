import { createPortal } from 'react-dom';
import {
  BREAKDOWN_CATEGORIES,
  type Character,
  type Scene,
  type ScriptTag,
} from '@/stores/breakdownStore';

export interface TagPopupState {
  x: number; y: number;
  sceneId: string;
  startOffset: number; endOffset: number;
  text: string;
  /** Step 1: pick character, Step 2: pick field/category, edit: edit existing tag */
  step: 'character' | 'field' | 'edit';
  categoryId?: string;
  characterId?: string;
  /** When true, popup appears below the selection instead of above */
  popBelow?: boolean;
  /** Tag IDs being edited (set when step === 'edit') */
  editingTagIds?: string[];
}

interface ScriptTagPopupProps {
  popup: TagPopupState | null;
  popupRef: React.RefObject<HTMLDivElement | null>;
  characters: Character[];
  scenes: Scene[];
  tags: ScriptTag[];
  onCharacterPick: (charId: string) => void;
  onCreateNewCharacter: () => void;
  onAddCharacterToScene: () => void;
  onFieldPick: (catId: string) => void;
  onSynopsisPick: () => void;
  onEditChangeCategory: (tagId: string, newCatId: string) => void;
  onEditDeleteTag: (tagId: string) => void;
  onBack: () => void;
}

/**
 * The 3-step tag assignment popup portalled to `document.body` so it
 * isn't clipped by the scroll overflow of the script view. Renders
 * conditionally — returns null when `popup` is null.
 *
 * Steps:
 *   1. Character — pick which character this tag belongs to (or
 *      Synopsis, or create a new character, or add an existing
 *      character to the scene)
 *   2. Field — pick the breakdown category (Hair, Makeup, etc.)
 *      or character profile field
 *   3. Edit — re-categorise or delete an existing tag (opened by
 *      clicking a highlighted tag span in the script body)
 */
export function ScriptTagPopup({
  popup,
  popupRef,
  characters,
  scenes,
  tags,
  onCharacterPick,
  onCreateNewCharacter,
  onAddCharacterToScene,
  onFieldPick,
  onSynopsisPick,
  onEditChangeCategory,
  onEditDeleteTag,
  onBack,
}: ScriptTagPopupProps) {
  if (!popup) return null;

  return createPortal(
    <div ref={popupRef} className="sv-tag-popup sv-tag-popup--fixed" style={{
      left: popup.x,
      top: popup.y,
      transform: popup.popBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    }}>
      {popup.step === 'character' && (
        <>
          <div className="sv-tag-popup-title">Assign to character</div>
          <div className="sv-tag-popup-quoted">"{popup.text.length > 50 ? popup.text.slice(0, 50) + '…' : popup.text}"</div>
          <div className="sv-tag-popup-charlist">
            <button className="sv-tag-popup-char-item sv-tag-popup-char-item--synopsis" onClick={onSynopsisPick}>
              <span className="sv-tag-popup-char-avatar" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <span>Synopsis</span>
            </button>
            {characters.map((ch) => (
              <button key={ch.id} className="sv-tag-popup-char-item" onClick={() => onCharacterPick(ch.id)}>
                <span className="sv-tag-popup-char-avatar">{ch.name.charAt(0)}</span>
                <span>{ch.name}</span>
              </button>
            ))}
            <button className="sv-tag-popup-char-item sv-tag-popup-char-item--new" onClick={onCreateNewCharacter}>
              <span className="sv-tag-popup-char-avatar" style={{ background: 'rgba(212, 148, 58, 0.2)', color: '#D4943A' }}>+</span>
              <span>+ Character</span>
            </button>
          </div>
        </>
      )}
      {popup.step === 'field' && (
        <>
          <div className="sv-tag-popup-title">
            Tag as — <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{characters.find(c => c.id === popup.characterId)?.name}</span>
          </div>
          {/* Add to Scene — shown when the character is not yet in this scene */}
          {popup.characterId && (() => {
            const scene = scenes.find(s => s.id === popup.sceneId);
            const isInScene = scene?.characterIds.includes(popup.characterId!);
            if (isInScene) return null;
            return (
              <div className="sv-tag-popup-field-section">
                <button className="sv-tag-popup-btn sv-tag-popup-btn--add-scene" onClick={onAddCharacterToScene}>
                  <span className="sv-tag-popup-swatch" style={{ background: 'var(--accent-cue, #B8860B)' }} />
                  Add to Scene
                </button>
              </div>
            );
          })()}
          <div className="sv-tag-popup-field-section">
            <div className="sv-tag-popup-field-label">Scene Breakdown</div>
            <div className="sv-tag-popup-grid">
              {BREAKDOWN_CATEGORIES.filter(c => c.group === 'breakdown').map((cat) => (
                <button key={cat.id} className="sv-tag-popup-btn" onClick={() => onFieldPick(cat.id)}>
                  <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sv-tag-popup-field-section">
            <div className="sv-tag-popup-field-label">Character Profile</div>
            <div className="sv-tag-popup-grid">
              {BREAKDOWN_CATEGORIES.filter(c => c.group === 'profile').map((cat) => (
                <button key={cat.id} className="sv-tag-popup-btn" onClick={() => onFieldPick(cat.id)}>
                  <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <button className="sv-tag-popup-char-btn sv-tag-popup-char-btn--skip" onClick={onBack}>
            Back
          </button>
        </>
      )}
      {popup.step === 'edit' && popup.editingTagIds && (
        <>
          <div className="sv-tag-popup-title">Edit Tag</div>
          <div className="sv-tag-popup-quoted">"{popup.text.length > 50 ? popup.text.slice(0, 50) + '…' : popup.text}"</div>
          {popup.editingTagIds.map(tagId => {
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return null;
            const currentCat = BREAKDOWN_CATEGORIES.find(c => c.id === tag.categoryId);
            const charName = tag.characterId ? characters.find(c => c.id === tag.characterId)?.name : '';
            return (
              <div key={tagId} className="sv-tag-popup-edit-item">
                <div className="sv-tag-popup-edit-header">
                  <span className="sv-tag-popup-swatch" style={{ background: currentCat?.color || '#888' }} />
                  <span className="sv-tag-popup-edit-label">{currentCat?.label || 'Tag'}{charName ? ` → ${charName}` : ''}</span>
                  <button className="sv-tag-popup-delete-btn" onClick={() => onEditDeleteTag(tagId)} title="Delete tag">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
                <div className="sv-tag-popup-edit-cats">
                  {BREAKDOWN_CATEGORIES.filter(c => c.group === 'breakdown').map(cat => (
                    <button key={cat.id}
                      className={`sv-tag-popup-btn${cat.id === tag.categoryId ? ' sv-tag-popup-btn--active' : ''}`}
                      onClick={() => onEditChangeCategory(tagId, cat.id)}>
                      <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>,
    document.body
  );
}

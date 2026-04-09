import type { CostumeLookbook } from '@/types';
import { Textarea } from '../ui';

interface CostumeLookbookFieldsProps {
  data: CostumeLookbook;
  readOnly: boolean;
  onChange: (data: CostumeLookbook) => void;
}

/**
 * Costume lookbook fields for the "Intended Look" layer.
 * Editable by the Designer during prep, read-only for the floor team during shoot.
 */
export function CostumeLookbookFields({ data, readOnly, onChange }: CostumeLookbookFieldsProps) {
  const update = (field: keyof CostumeLookbook, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="card space-y-3">
      <h3 className="section-header mb-1">COSTUME LOOKBOOK</h3>

      <div>
        <label className="field-label">OUTFIT</label>
        <Textarea
          value={data.outfit ?? ''}
          onChange={(e) => update('outfit', e.target.value)}
          placeholder="Describe the outfit..."
          rows={2}
          className="resize-none"
          disabled={readOnly}
        />
      </div>

      <div>
        <label className="field-label">ACCESSORIES</label>
        <Textarea
          value={data.accessories ?? ''}
          onChange={(e) => update('accessories', e.target.value)}
          placeholder="Jewellery, bags, hats, glasses..."
          rows={2}
          className="resize-none"
          disabled={readOnly}
        />
      </div>

      <div>
        <label className="field-label">BREAKDOWN</label>
        <Textarea
          value={data.breakdown ?? ''}
          onChange={(e) => update('breakdown', e.target.value)}
          placeholder="Ageing, distressing, breakdown effects..."
          rows={2}
          className="resize-none"
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

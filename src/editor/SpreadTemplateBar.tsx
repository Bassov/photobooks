import { useSyncExternalStore } from 'react'
import { TEMPLATE_IDS, type TemplateId } from '../core'
import {
  dispatchBookOp,
  getSpreadTemplateId,
  subscribeSpread,
} from './bookStore'

const TEMPLATE_LABELS: Record<TemplateId, string> = {
  'full-bleed': 'Full bleed',
  'one-per-page': 'One per page',
  '2-up': '2-up',
  '4-grid': '4-grid',
}

export function SpreadTemplateBar({
  spreadId,
  onAddSpread,
}: {
  spreadId: string | null
  onAddSpread: () => void
}) {
  const templateId = useSyncExternalStore(
    (listener) =>
      spreadId === null ? () => undefined : subscribeSpread(spreadId, listener),
    () => (spreadId === null ? null : getSpreadTemplateId(spreadId)),
    () => (spreadId === null ? null : getSpreadTemplateId(spreadId)),
  )

  return (
    <div className="spread-template-bar">
      <div role="radiogroup" aria-label="Spread template">
        {TEMPLATE_IDS.map((id) => (
          <label key={id} className="spread-template-choice">
            <input
              type="radio"
              name="spread-template"
              value={id}
              checked={templateId === id}
              disabled={spreadId === null}
              onChange={() => {
                if (spreadId === null) {
                  return
                }
                dispatchBookOp({
                  type: 'applyTemplate',
                  spreadId,
                  templateId: id,
                })
              }}
            />
            {TEMPLATE_LABELS[id]}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="spread-template-add"
        onClick={onAddSpread}
        disabled={spreadId === null}
      >
        Add spread
      </button>
    </div>
  )
}

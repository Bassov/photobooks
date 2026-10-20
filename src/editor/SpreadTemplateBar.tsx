import { memo, useSyncExternalStore } from 'react'
import { TEMPLATE_IDS, type TemplateId } from '../core'
import '../ui/Button.css'
import { SegmentedControl } from '../ui/SegmentedControl'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { getSpreadTemplateId, subscribeSpread } from './bookStore'

const TEMPLATE_ITEMS: { id: TemplateId; label: string }[] = [
  { id: 'full-bleed', label: 'Full bleed' },
  { id: 'one-per-page', label: 'One per page' },
  { id: '2-up', label: '2-up' },
  { id: '4-grid', label: '4-grid' },
]

export const SpreadTemplateBar = memo(function SpreadTemplateBar({
  spreadId,
  onAddSpread,
}: {
  spreadId: string | null
  onAddSpread: () => void
}) {
  const readTemplateId = (): string | null =>
    spreadId === null ? null : getSpreadTemplateId(spreadId)
  const templateId = useSyncExternalStore(
    (listener) =>
      spreadId === null ? () => undefined : subscribeSpread(spreadId, listener),
    readTemplateId,
    readTemplateId,
  )

  const selected =
    templateId !== null && TEMPLATE_IDS.includes(templateId as TemplateId)
      ? templateId
      : 'one-per-page'

  return (
    <div className="spread-template-bar">
      <SegmentedControl
        label="Template for this spread"
        size="sm"
        value={selected}
        isDisabled={spreadId === null}
        onChange={(id) => {
          applyMarkedSpreadTemplate(spreadId, id as TemplateId)
        }}
        items={TEMPLATE_ITEMS}
      />
      <button
        type="button"
        className="pb-button pb-button--secondary pb-button--sm spread-template-add"
        onClick={onAddSpread}
        disabled={spreadId === null}
      >
        Add spread
      </button>
    </div>
  )
})

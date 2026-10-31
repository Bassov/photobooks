import { useSyncExternalStore } from 'react'
import { getSpreadSizeMm } from '../core'
import { getBookStoreSnapshot } from './bookStore'
import { layoutRects, templateName } from './layoutCatalog'
import { percentStyle, thumbSlots } from './layoutThumb'
import { subscribeTemplatePreview, templatePreviewOn } from './templatePreview'
import './TemplatePreviewOverlay.css'

/**
 * Kit canvas TemplatePreview (uikit/src/sandbox/canvas.tsx:461): hovering a
 * layout tile shows its slots over this spread. Only the previewed spread
 * re-renders; the book is read once per preview, not subscribed.
 */
export function TemplatePreviewOverlay({ spreadId }: { spreadId: string }) {
  const templateId = useSyncExternalStore(subscribeTemplatePreview, () =>
    templatePreviewOn(spreadId),
  )
  // No preview ('') resolves to no layout rects, so the layer renders nothing.
  return <PreviewLayer spreadId={spreadId} templateId={templateId} />
}

function PreviewLayer({
  spreadId,
  templateId,
}: {
  spreadId: string
  templateId: string
}) {
  const { book } = getBookStoreSnapshot()
  const index = book.spreads.findIndex((item) => item.id === spreadId)
  const spread = book.spreads[index]
  const rects =
    spread === undefined ? null : layoutRects(templateId, book, index, spread)
  if (rects === null) {
    return null
  }
  const { widthMm, heightMm } = getSpreadSizeMm(book, index)
  return (
    <div
      className="template-preview"
      data-testid="tpl-preview"
      data-template={templateId}
      aria-hidden="true"
    >
      {thumbSlots(widthMm, heightMm, rects).map((slot, i) => (
        <div
          key={i}
          className="template-preview-slot"
          data-testid="tpl-preview-slot"
          style={percentStyle(slot)}
        />
      ))}
      <div className="template-preview-label">
        Preview · {templateName(templateId)}
      </div>
    </div>
  )
}

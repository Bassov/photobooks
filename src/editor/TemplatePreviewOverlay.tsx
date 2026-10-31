import { useSyncExternalStore } from 'react'
import {
  generateTemplateFrames,
  getSpreadSizeMm,
  type FixedTemplateId,
} from '../core'
import { getBookStoreSnapshot } from './bookStore'
import { TEMPLATE_NAMES } from './layoutCatalog'
import { percentStyle, thumbSlots } from './layoutThumb'
import { subscribeTemplatePreview, templatePreviewOn } from './templatePreview'
import './TemplatePreviewOverlay.css'

/**
 * Kit canvas TemplatePreview (uikit/src/sandbox/canvas.tsx:461): hovering a
 * layout tile shows its slots over this spread. Only the previewed spread
 * re-renders; the book is read once per preview, not subscribed.
 */
export function TemplatePreviewOverlay({ spreadId }: { spreadId: string }) {
  const templateId = useSyncExternalStore(
    subscribeTemplatePreview,
    () => templatePreviewOn(spreadId),
    () => templatePreviewOn(spreadId),
  )
  return templateId === '' ? null : (
    <PreviewLayer spreadId={spreadId} templateId={templateId} />
  )
}

function PreviewLayer({
  spreadId,
  templateId,
}: {
  spreadId: string
  templateId: FixedTemplateId
}) {
  const { book } = getBookStoreSnapshot()
  const index = book.spreads.findIndex((item) => item.id === spreadId)
  const spread = book.spreads[index]
  if (spread === undefined) {
    return null
  }
  const { widthMm, heightMm } = getSpreadSizeMm(book, index)
  const rects = generateTemplateFrames(templateId, book, index, spread).map(
    (frame) => frame.rect,
  )
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
        Preview · {TEMPLATE_NAMES[templateId]}
      </div>
    </div>
  )
}

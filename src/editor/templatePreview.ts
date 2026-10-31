import type { FixedTemplateId } from '../core'

/** Kit `setTemplatePreview`: the layout tile under the pointer / focus. */
export interface TemplatePreview {
  spreadId: string
  templateId: FixedTemplateId
}

let preview: TemplatePreview | null = null
const listeners = new Set<() => void>()

export function setTemplatePreview(next: TemplatePreview | null): void {
  if (
    next?.spreadId === preview?.spreadId &&
    next?.templateId === preview?.templateId
  ) {
    return
  }
  preview = next
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeTemplatePreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Previewed template on `spreadId`, else `''` (other spreads stay quiet). */
export function templatePreviewOn(spreadId: string): FixedTemplateId | '' {
  return preview?.spreadId === spreadId ? preview.templateId : ''
}

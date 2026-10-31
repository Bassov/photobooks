import {
  customLayoutRects,
  generateTemplateFrames,
  isTemplateId,
  parseContactSheetId,
  TEMPLATE_IDS,
  type Book,
  type FixedTemplateId,
  type RectMm,
  type Spread,
} from '../core'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { dispatchBookOp } from './bookStore'
import { findSavedTemplate } from './savedTemplates'

/** Display names for every fixed template (kit names where the kit has one). */
export const TEMPLATE_NAMES: Record<FixedTemplateId, string> = {
  'full-bleed': 'Full bleed',
  'one-per-page': 'One per page',
  '2-up': '2-up',
  '4-grid': '4-grid',
  'two-portraits': 'Two portraits',
  'landscape-two-portraits': 'Landscape + 2 portraits',
  'hero-two': 'Hero + two',
  'hero-grid': 'Hero + grid',
  panorama: 'Panorama',
  'three-across': 'Three across',
  'framed-single': 'Framed single',
  'offset-pair': 'Offset pair',
}

/**
 * The picker lists the kit builtin layouts in kit order (uikit `data.ts`
 * `templates` then `sandbox/templates.ts` `EXTRA`). `2-up` / `4-grid` stay
 * valid for stored books but are not offered.
 */
export const LAYOUT_PICKER: readonly FixedTemplateId[] = [
  'full-bleed',
  'one-per-page',
  'hero-two',
  'hero-grid',
  'panorama',
  'three-across',
  'framed-single',
  'offset-pair',
  'two-portraits',
  'landscape-two-portraits',
]

/** Summary / preview name of a stored template id, or null if unknown. */
export function templateName(templateId: string | undefined): string | null {
  if (templateId === undefined) {
    return null
  }
  const contact = parseContactSheetId(templateId)
  if (contact !== null) {
    return `Contact sheet ${String(contact.cols)}×${String(contact.rows)}`
  }
  const fixed = TEMPLATE_IDS.find((id) => id === templateId)
  if (fixed !== undefined) {
    return TEMPLATE_NAMES[fixed]
  }
  return findSavedTemplate(templateId)?.name ?? null
}

/** Slot rects (mm) of a catalog template or saved layout on a spread; null if unknown. */
export function layoutRects(
  templateId: string,
  book: Book,
  spreadIndex: number,
  spread: Spread,
): RectMm[] | null {
  if (isTemplateId(templateId)) {
    return generateTemplateFrames(templateId, book, spreadIndex, spread).map(
      (frame) => frame.rect,
    )
  }
  const saved = findSavedTemplate(templateId)
  return saved === undefined
    ? null
    : customLayoutRects(book, spreadIndex, saved.slots)
}

/** Apply a catalog template or a saved layout to a spread. */
export function applyLayout(spreadId: string, templateId: string): void {
  if (isTemplateId(templateId)) {
    applyMarkedSpreadTemplate(spreadId, templateId)
    return
  }
  const saved = findSavedTemplate(templateId)
  if (saved !== undefined) {
    dispatchBookOp({
      type: 'applyCustomLayout',
      spreadId,
      templateId,
      slots: saved.slots,
    })
  }
}

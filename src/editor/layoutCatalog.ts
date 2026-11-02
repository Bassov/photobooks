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

/** One picker tile: a kit builtin (`saved: false`) or one of the user's templates. */
export interface LayoutItem {
  id: string
  name: string
  rects: readonly RectMm[]
  saved: boolean
}

/**
 * Owner 2026-11-02: one list from one photo up. The sort is stable, so the
 * catalog order (builtins, then saved in save order) holds inside a count.
 */
export function sortByPhotoCount<T extends { rects: readonly RectMm[] }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => a.rects.length - b.rects.length)
}

/**
 * `[dropped, kept]` builtins the picker shows as one tile on a spread where
 * the dropped one is only a margin variant of the kept one. The dropped id
 * stays a valid stored template (render, regrid, auto-fill resolve it).
 */
export const PICKER_MERGES: readonly (readonly [
  FixedTemplateId,
  FixedTemplateId,
])[] = [['two-portraits', 'one-per-page']]

/** Slack for float noise in generated rects (mm). */
const EPSILON_MM = 1e-6
/** Centres this close (mm) count as the same placement. */
const CENTRE_TOLERANCE_MM = 0.5
/** A margin variant keeps at least this share of each frame's area. */
const MIN_AREA_SHARE = 0.7

function within(inner: RectMm, outer: RectMm): boolean {
  return (
    inner.x >= outer.x - EPSILON_MM &&
    inner.y >= outer.y - EPSILON_MM &&
    inner.x + inner.width <= outer.x + outer.width + EPSILON_MM &&
    inner.y + inner.height <= outer.y + outer.height + EPSILON_MM
  )
}

function centredInset(inner: RectMm, outer: RectMm): boolean {
  const dx = inner.x + inner.width / 2 - (outer.x + outer.width / 2)
  const dy = inner.y + inner.height / 2 - (outer.y + outer.height / 2)
  return (
    within(inner, outer) &&
    Math.abs(dx) <= CENTRE_TOLERANCE_MM &&
    Math.abs(dy) <= CENTRE_TOLERANCE_MM &&
    inner.width * inner.height >= MIN_AREA_SHARE * outer.width * outer.height
  )
}

/**
 * True when `inset` differs from `outer` only by margins: the same number of
 * frames inside the trim, each a centred inset of its match keeping ≥ 70 % of
 * its area. Full bleed (past the trim) and differently placed frames fail.
 */
export function isMarginVariant(
  inset: readonly RectMm[],
  outer: readonly RectMm[],
  size: { widthMm: number; heightMm: number },
): boolean {
  const trim = { x: 0, y: 0, width: size.widthMm, height: size.heightMm }
  return (
    inset.length > 0 &&
    inset.length === outer.length &&
    inset.every((rect, index) => {
      const box = outer[index]
      return box !== undefined && within(box, trim) && centredInset(rect, box)
    })
  )
}

/**
 * Drop the `PICKER_MERGES` builtins that are margin variants on this spread.
 * `aliases` maps each dropped id to the tile that stands for it.
 */
export function mergeLayouts<T extends LayoutItem>(
  items: readonly T[],
  size: { widthMm: number; heightMm: number },
): { items: T[]; aliases: ReadonlyMap<string, string> } {
  const aliases = new Map<string, string>()
  for (const [dropped, kept] of PICKER_MERGES) {
    const variant = items.find((item) => item.id === dropped)
    const tile = items.find((item) => item.id === kept)
    if (
      variant !== undefined &&
      tile !== undefined &&
      isMarginVariant(variant.rects, tile.rects, size)
    ) {
      aliases.set(dropped, kept)
    }
  }
  return { items: items.filter((item) => !aliases.has(item.id)), aliases }
}

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

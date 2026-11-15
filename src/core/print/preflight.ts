import { frameDpi, lowDpi } from '../geometry/dpi'
import { resolveSpread } from '../geometry/resolveSpread'
import { getSinglePageSide, getSpreadPageCount } from '../geometry/spreadSize'
import type { RectMm, ResolvedItem } from '../geometry/types'
import { pagesOf } from '../pages'
import type { ColorWarning } from '../pdf/colorPreflight'
import type { Book } from '../schema'
import { coverGeometry } from './coverGeometry'
import type { ImpositionLayout } from './imposition'
import type { PrintProfile } from './profileSchema'

export const PREFLIGHT_SEVERITIES = ['error', 'warning', 'info'] as const
export type PreflightSeverity = (typeof PREFLIGHT_SEVERITIES)[number]

export const PREFLIGHT_RULE_IDS = [
  'page-count-below-min',
  'page-count-above-max',
  'page-count-step',
  'asset-missing',
  'asset-modified',
  'dpi-below-min',
  'dpi-below-warn',
  'empty-image-frame',
  'empty-text-frame',
  'safe-zone-intrusion',
  'bleed-hazard',
  'cover-asset-missing',
  'cover-asset-modified',
  'cover-dpi-below-min',
  'cover-dpi-below-warn',
  'cover-not-srgb',
  'spine-text-small',
  'spine-text-cut',
  'cover-front-empty',
] as const
export type PreflightRuleId = (typeof PREFLIGHT_RULE_IDS)[number]

/** What a rule checks: the interior pages or the cover sheet. */
export type PreflightScope = 'pages' | 'cover'

export const PREFLIGHT_FIX_IDS = [
  'add-pages',
  'remove-pages',
  'relink-asset',
  'reduce-photo-scale',
  'fill-or-remove-frame',
  'move-into-safe-zone',
  'extend-to-bleed',
  'edit-cover',
] as const
export type PreflightFixId = (typeof PREFLIGHT_FIX_IDS)[number]

export interface PreflightRuleSpec {
  severity: PreflightSeverity
  fix: PreflightFixId
  scope: PreflightScope
}

/**
 * Severity and fix action of every rule (pinned by a snapshot). Built per call
 * (not at module load) so that its mutants are reachable.
 */
export function preflightRules(): Record<PreflightRuleId, PreflightRuleSpec> {
  const pages = (severity: PreflightSeverity, fix: PreflightFixId) =>
    ({ severity, fix, scope: 'pages' }) as const
  const cover = (severity: PreflightSeverity, fix: PreflightFixId) =>
    ({ severity, fix, scope: 'cover' }) as const
  return {
    'page-count-below-min': pages('error', 'add-pages'),
    'page-count-above-max': pages('error', 'remove-pages'),
    'page-count-step': pages('error', 'add-pages'),
    'asset-missing': pages('error', 'relink-asset'),
    'asset-modified': pages('warning', 'relink-asset'),
    'dpi-below-min': pages('error', 'reduce-photo-scale'),
    'dpi-below-warn': pages('warning', 'reduce-photo-scale'),
    'empty-image-frame': pages('warning', 'fill-or-remove-frame'),
    'empty-text-frame': pages('info', 'fill-or-remove-frame'),
    'safe-zone-intrusion': pages('warning', 'move-into-safe-zone'),
    'bleed-hazard': pages('warning', 'extend-to-bleed'),
    'cover-asset-missing': cover('error', 'relink-asset'),
    'cover-asset-modified': cover('warning', 'relink-asset'),
    'cover-dpi-below-min': cover('error', 'reduce-photo-scale'),
    'cover-dpi-below-warn': cover('warning', 'reduce-photo-scale'),
    'cover-not-srgb': cover('warning', 'edit-cover'),
    'spine-text-small': cover('warning', 'edit-cover'),
    'spine-text-cut': cover('warning', 'edit-cover'),
    'cover-front-empty': cover('info', 'edit-cover'),
  }
}

/** Where an issue sits; book-level issues (page count) carry none. */
export interface PreflightLocation {
  spreadId?: string
  /** 1-based physical page (spread `i` holds pages `2i`, `2i + 1`). */
  page?: number
  /** Frame id (spread or parent layer). */
  itemId?: string
}

export interface PreflightIssue extends PreflightRuleSpec {
  rule: PreflightRuleId
  location: PreflightLocation
  /** The checked number (effective DPI, page count), when the rule has one. */
  measured?: number
  /** The profile limit it was checked against. */
  threshold?: number
  /** The photo's RGB space (`cover-not-srgb`). */
  family?: ColorWarning['family']
}

/** Relink scan result (`src/assets` match status) per asset id. */
export type PreflightAssetStatus = 'ok' | 'missing' | 'modified'

/** The cover sheet check (Designer cover-pdf C9). */
export interface PreflightCoverOptions {
  /** Booklets (`2up` / `4up`) print no cover: no cover issues. */
  layout: 'single' | ImpositionLayout
  /** `colorWarnings` of the book's photos; only the front photo's counts. */
  colors?: readonly ColorWarning[]
  /** Advance width (mm) of one line of spine text at `sizeMm`. */
  textAdvanceMm: (text: string, sizeMm: number) => number
}

export interface PreflightOptions {
  /** Ids absent from the map are taken as present and unchanged. */
  assetStatus?: ReadonlyMap<string, PreflightAssetStatus>
  /** Adds the cover rules; absent → interior rules only. */
  cover?: PreflightCoverOptions
}

/** Rounding slack (mm) so that an edge placed on a line counts as on it. */
const EPSILON_MM = 0.01

function issue(
  rule: PreflightRuleId,
  location: PreflightLocation,
  numbers: { measured?: number; threshold?: number } = {},
): PreflightIssue {
  return { rule, ...preflightRules()[rule], location, ...numbers }
}

/**
 * Print checks of the book's spreads against `profile` (pure: no DOM, no IO).
 * Order: page count, then spread by spread, item by item, in rule order, then
 * the cover when `options.cover` asks for it.
 */
export function preflight(
  book: Book,
  profile: PrintProfile,
  options: PreflightOptions = {},
): PreflightIssue[] {
  const issues = pageCountIssues(book, profile)
  for (const { item, sheet, box, spreadId, page } of printedItems(book)) {
    const location: PreflightLocation = { spreadId, page, itemId: item.frameId }
    issues.push(
      ...itemIssues(book, profile, options, item, location),
      ...placementIssues(book, profile, item, box, sheet, location),
    )
  }
  if (options.cover?.layout === 'single') {
    issues.push(...coverIssues(book, profile, options, options.cover))
  }
  return issues
}

function coverIssues(
  book: Book,
  profile: PrintProfile,
  options: PreflightOptions,
  cover: PreflightCoverOptions,
): PreflightIssue[] {
  const geometry = coverGeometry(profile, book)
  const issues = frontIssues(
    book,
    profile,
    options,
    cover,
    geometry.rects.frontPhoto,
  )
  const text = book.cover.spine.text.trim()
  if (text === '') {
    return issues
  }
  // Type size as CoverView draws it: kit 12 px of 848, at most half the spine.
  const sizeMm = Math.min((geometry.coverW * 12) / 848, geometry.spine / 2)
  const pt = (sizeMm * 72) / 25.4
  if (pt < profile.minFontPt) {
    issues.push(
      issue(
        'spine-text-small',
        {},
        { measured: pt, threshold: profile.minFontPt },
      ),
    )
  }
  if (cover.textAdvanceMm(text, sizeMm) > geometry.trimH - 2 * geometry.safe) {
    issues.push(issue('spine-text-cut', {}))
  }
  return issues
}

/** Front photo checks, in rule order; `cover-front-empty` without one. */
function frontIssues(
  book: Book,
  profile: PrintProfile,
  options: PreflightOptions,
  cover: PreflightCoverOptions,
  panel: RectMm,
): PreflightIssue[] {
  const { assetId, crop } = book.cover.front
  if (assetId === undefined) {
    return [issue('cover-front-empty', {})]
  }
  const asset = book.assets[assetId]
  const status = options.assetStatus?.get(assetId)
  if (asset === undefined || status === 'missing') {
    return [issue('cover-asset-missing', {})]
  }
  const found = status === 'modified' ? [issue('cover-asset-modified', {})] : []
  // The editor's front ppi (`coverPanelPpi` in src/render/coverLayout.ts):
  // cover fit on the photo box, divided by the crop zoom. An unknown pixel
  // size is NaN, which `lowDpi` rates as no issue.
  const perMm = Math.min(
    Number(asset.widthPx) / panel.width,
    Number(asset.heightPx) / panel.height,
  )
  const low = lowDpi(
    Math.round((perMm * 25.4) / (crop?.zoom ?? 1)),
    profile.dpi,
  )
  if (low !== undefined) {
    found.push(
      low.level === 'min'
        ? issue(
            'cover-dpi-below-min',
            {},
            {
              measured: low.dpi,
              threshold: profile.dpi.min,
            },
          )
        : issue(
            'cover-dpi-below-warn',
            {},
            {
              measured: low.dpi,
              threshold: profile.dpi.warn,
            },
          ),
    )
  }
  const color = cover.colors?.find((warning) => warning.assetId === assetId)
  if (color !== undefined) {
    found.push({ ...issue('cover-not-srgb', {}), family: color.family })
  }
  return found
}

/**
 * Printed pages of each placed photo (asset id → ascending, unique pages),
 * by the same page rule as `preflight` issue locations.
 */
export function photoPages(book: Book): Map<string, number[]> {
  const pages = new Map<string, Set<number>>()
  for (const { item, page } of printedItems(book)) {
    if (item.assetId !== undefined) {
      const set = pages.get(item.assetId) ?? new Set<number>()
      pages.set(item.assetId, set.add(page))
    }
  }
  return new Map(
    [...pages].map(([assetId, set]) => [
      assetId,
      [...set].sort((a, b) => a - b),
    ]),
  )
}

interface PrintedItem {
  item: ResolvedItem
  sheet: Sheet
  box: RectMm
  spreadId: string
  page: number
}

/** Resolved items that reach a page, spread by spread, item by item. */
function* printedItems(book: Book): Generator<PrintedItem> {
  for (const [index, spread] of book.spreads.entries()) {
    const resolved = resolveSpread(book, spread.id, {
      getAspectRatio: (assetId) => {
        const asset = book.assets[assetId]
        return asset?.widthPx === undefined || asset.heightPx === undefined
          ? 1
          : asset.widthPx / asset.heightPx
      },
    })
    // Every id of `book.spreads` resolves; the guard only narrows the type.
    if (resolved !== undefined) {
      const sheet: Sheet = {
        index,
        count: book.spreads.length,
        widthMm: resolved.spreadWidthMm,
        heightMm: resolved.spreadHeightMm,
        trimWidthMm: book.settings.trim.widthMm,
      }
      for (const item of resolved.items) {
        const box = boundsOf(item)
        if (prints(box, sheet)) {
          yield {
            item,
            sheet,
            box,
            spreadId: spread.id,
            page: pageAt(box, sheet),
          }
        }
      }
    }
  }
}

function pageCountIssues(book: Book, profile: PrintProfile): PreflightIssue[] {
  const pages = pagesOf(book.spreads.length)
  const { min, max, step } = profile.pageCount
  if (pages < min) {
    return [
      issue('page-count-below-min', {}, { measured: pages, threshold: min }),
    ]
  }
  if (pages > max) {
    return [
      issue('page-count-above-max', {}, { measured: pages, threshold: max }),
    ]
  }
  return (pages - min) % step === 0
    ? []
    : [issue('page-count-step', {}, { measured: pages, threshold: step })]
}

function itemIssues(
  book: Book,
  profile: PrintProfile,
  options: PreflightOptions,
  item: ResolvedItem,
  location: PreflightLocation,
): PreflightIssue[] {
  if (item.text !== undefined) {
    return item.text.text.trim() === ''
      ? [issue('empty-text-frame', location)]
      : []
  }
  if (item.assetId === undefined) {
    return [issue('empty-image-frame', location)]
  }
  const asset = book.assets[item.assetId]
  if (asset === undefined) {
    return [issue('asset-missing', location)]
  }
  const status = options.assetStatus?.get(item.assetId)
  const found: PreflightIssue[] =
    status === 'missing'
      ? [issue('asset-missing', location)]
      : status === 'modified'
        ? [issue('asset-modified', location)]
        : []
  if (
    asset.widthPx === undefined ||
    asset.heightPx === undefined ||
    item.sourceCropRect === undefined
  ) {
    return found
  }
  const low = lowDpi(
    frameDpi(
      item.rectMm,
      item.sourceCropRect,
      item.photoQuarterTurns ?? 0,
      asset.widthPx,
      asset.heightPx,
    ),
    profile.dpi,
  )
  if (low === undefined) {
    return found
  }
  return low.level === 'min'
    ? [
        ...found,
        issue('dpi-below-min', location, {
          measured: low.dpi,
          threshold: profile.dpi.min,
        }),
      ]
    : [
        ...found,
        issue('dpi-below-warn', location, {
          measured: low.dpi,
          threshold: profile.dpi.warn,
        }),
      ]
}

interface Sheet {
  index: number
  count: number
  /** Trim box of the spread in its own mm: `0..widthMm` × `0..heightMm`. */
  widthMm: number
  heightMm: number
  trimWidthMm: number
}

/** Axis-aligned bounds of the frame rotated about its center. */
function boundsOf(item: ResolvedItem): RectMm {
  const { x, y, width, height } = item.rectMm
  const radians = (item.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const boundsWidth = width * cos + height * sin
  const boundsHeight = width * sin + height * cos
  return {
    x: x + (width - boundsWidth) / 2,
    y: y + (height - boundsHeight) / 2,
    width: boundsWidth,
    height: boundsHeight,
  }
}

/** Items wholly on the pasteboard or in the bleed never reach a page. */
function prints(box: RectMm, sheet: Sheet): boolean {
  return (
    box.x < sheet.widthMm &&
    box.x + box.width > 0 &&
    box.y < sheet.heightMm &&
    box.y + box.height > 0
  )
}

function pageAt(box: RectMm, sheet: Sheet): number {
  const { index, count } = sheet
  if (getSpreadPageCount(index, count) === 1) {
    return index === 0 ? 1 : index * 2
  }
  return box.x + box.width / 2 < sheet.trimWidthMm ? index * 2 : index * 2 + 1
}

function placementIssues(
  book: Book,
  profile: PrintProfile,
  item: ResolvedItem,
  box: RectMm,
  sheet: Sheet,
  location: PreflightLocation,
): PreflightIssue[] {
  const safe = profile.safeMarginMm
  if (item.text !== undefined) {
    return insideSafeZone(box, sheet, safe)
      ? []
      : [issue('safe-zone-intrusion', location)]
  }
  return nearTrimEdge(box, sheet, safe, book.settings.bleedMm)
    ? [issue('bleed-hazard', location)]
    : []
}

/** Text stays `safe` mm inside the trim and the gutter of one page. */
function insideSafeZone(box: RectMm, sheet: Sheet, safe: number): boolean {
  const pageCount = getSpreadPageCount(sheet.index, sheet.count)
  const pageWidth = sheet.widthMm / pageCount
  const page = Math.min(
    pageCount - 1,
    Math.max(0, Math.floor((box.x + box.width / 2) / pageWidth)),
  )
  const left = page * pageWidth + safe
  const right = (page + 1) * pageWidth - safe
  return (
    box.x >= left - EPSILON_MM &&
    box.x + box.width <= right + EPSILON_MM &&
    box.y >= safe - EPSILON_MM &&
    box.y + box.height <= sheet.heightMm - safe + EPSILON_MM
  )
}

/**
 * A photo edge inside the safe margin of an outer trim edge that stops short
 * of the bleed edge: trimming leaves a paper sliver or cuts the photo edge.
 * The binding side of a single first / last page is no trim edge.
 */
function nearTrimEdge(
  box: RectMm,
  sheet: Sheet,
  safe: number,
  bleed: number,
): boolean {
  const side = getSinglePageSide(sheet.index, sheet.count)
  const short = (inset: number) =>
    inset < safe - EPSILON_MM && inset > -bleed + EPSILON_MM
  const right = box.x + box.width
  const bottom = box.y + box.height
  return (
    (side !== 'right' && short(box.x)) ||
    (side !== 'left' && short(sheet.widthMm - right)) ||
    short(box.y) ||
    short(sheet.heightMm - bottom)
  )
}

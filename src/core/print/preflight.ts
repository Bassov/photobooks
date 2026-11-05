import { frameDpi, lowDpi } from '../geometry/dpi'
import { resolveSpread } from '../geometry/resolveSpread'
import { getSinglePageSide, getSpreadPageCount } from '../geometry/spreadSize'
import type { RectMm, ResolvedItem } from '../geometry/types'
import { pagesOf } from '../pages'
import type { Book } from '../schema'
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
] as const
export type PreflightRuleId = (typeof PREFLIGHT_RULE_IDS)[number]

export const PREFLIGHT_FIX_IDS = [
  'add-pages',
  'remove-pages',
  'relink-asset',
  'reduce-photo-scale',
  'fill-or-remove-frame',
  'move-into-safe-zone',
  'extend-to-bleed',
] as const
export type PreflightFixId = (typeof PREFLIGHT_FIX_IDS)[number]

export interface PreflightRuleSpec {
  severity: PreflightSeverity
  fix: PreflightFixId
}

/**
 * Severity and fix action of every rule (pinned by a snapshot). Built per call
 * (not at module load) so that its mutants are reachable.
 */
export function preflightRules(): Record<PreflightRuleId, PreflightRuleSpec> {
  return {
    'page-count-below-min': { severity: 'error', fix: 'add-pages' },
    'page-count-above-max': { severity: 'error', fix: 'remove-pages' },
    'page-count-step': { severity: 'error', fix: 'add-pages' },
    'asset-missing': { severity: 'error', fix: 'relink-asset' },
    'asset-modified': { severity: 'warning', fix: 'relink-asset' },
    'dpi-below-min': { severity: 'error', fix: 'reduce-photo-scale' },
    'dpi-below-warn': { severity: 'warning', fix: 'reduce-photo-scale' },
    'empty-image-frame': { severity: 'warning', fix: 'fill-or-remove-frame' },
    'empty-text-frame': { severity: 'info', fix: 'fill-or-remove-frame' },
    'safe-zone-intrusion': { severity: 'warning', fix: 'move-into-safe-zone' },
    'bleed-hazard': { severity: 'warning', fix: 'extend-to-bleed' },
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
}

/** Relink scan result (`src/assets` match status) per asset id. */
export type PreflightAssetStatus = 'ok' | 'missing' | 'modified'

export interface PreflightOptions {
  /** Ids absent from the map are taken as present and unchanged. */
  assetStatus?: ReadonlyMap<string, PreflightAssetStatus>
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
 * Order: page count, then spread by spread, item by item, in rule order.
 */
export function preflight(
  book: Book,
  profile: PrintProfile,
  options: PreflightOptions = {},
): PreflightIssue[] {
  const issues = pageCountIssues(book, profile)
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
        issues.push(
          ...spreadItemIssues(book, profile, options, item, sheet, spread.id),
        )
      }
    }
  }
  return issues
}

function spreadItemIssues(
  book: Book,
  profile: PrintProfile,
  options: PreflightOptions,
  item: ResolvedItem,
  sheet: Sheet,
  spreadId: string,
): PreflightIssue[] {
  const box = boundsOf(item)
  if (!prints(box, sheet)) {
    return []
  }
  const location: PreflightLocation = {
    spreadId,
    page: pageAt(box, sheet),
    itemId: item.frameId,
  }
  return [
    ...itemIssues(book, profile, options, item, location),
    ...placementIssues(book, profile, item, box, sheet, location),
  ]
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

import { getSpreadPageCount } from './geometry/spreadSize'
import type { RectMm, ResolvedFolio } from './geometry/types'
import { effectiveGrid } from './grid/layoutGrid'
import { omitKey } from './omitKey'
import { parentAsSpread, updateParentSpread } from './parentSpreads'
import type {
  Book,
  PageNumberFormat,
  PageNumberItem,
  PageNumbering,
  ParentSpread,
} from './schema'
import { spreadParent } from './spreadParent'

/** Where a master prints its folios (Designer `page-numbers`: Outer / Centre / Inner). */
export type PageNumberPosition = 'outer' | 'centre' | 'inner'

type FolioAlign = NonNullable<PageNumberItem['align']>
type Side = 'l' | 'r'

/** Folio box: 20 mm wide, one caption line high. */
export const FOLIO_WIDTH_MM = 20
export const FOLIO_HEIGHT_MM = 4.34

export const PAGE_NUMBER_START_MIN = 1
export const PAGE_NUMBER_START_MAX = 999

/*
 * Tables are built per call (like the schema's `atParseTime`) so their
 * mutants are reachable by per-test mutant switching.
 */

/** The book's numbering; absent → start 1, decimal, page 1 numbered. */
export function pageNumberingOf(book: Book): PageNumbering {
  return book.pageNumbering ?? { start: 1, skipFirst: false, format: 'decimal' }
}

function toRoman(n: number): string {
  const table: readonly (readonly [number, string])[] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let rest = n
  let out = ''
  for (const [value, digits] of table) {
    while (rest >= value) {
      out += digits
      rest -= value
    }
  }
  return out
}

/** Folio text of number `n`; roman has no zero (→ `undefined`). */
export function formatPageNumber(
  n: number,
  format: PageNumberFormat,
): string | undefined {
  if (format === 'decimal') {
    return String(n)
  }
  if (n < 1) {
    return undefined
  }
  const roman = toRoman(n)
  return format === 'lower-roman' ? roman.toLowerCase() : roman
}

/** Left- and right-page align of a position. */
function alignsOf(position: PageNumberPosition): [FolioAlign, FolioAlign] {
  switch (position) {
    case 'outer':
      return ['left', 'right']
    case 'centre':
      return ['center', 'center']
    case 'inner':
      return ['right', 'left']
  }
}

function itemId(parentId: string, side: Side): string {
  return `${parentId}-pn-${side}`
}

/**
 * The two folio items of parent `parentId` at `position` (spread mm, both
 * pages): centred in the bottom margin band of its effective grid, never past
 * the safe area. An unknown parent has none.
 */
export function pageNumberItems(
  book: Book,
  parentId: string,
  position: PageNumberPosition,
): PageNumberItem[] {
  const parent = book.parents?.find((item) => item.id === parentId)
  if (parent === undefined) {
    return []
  }
  const { bottom, inside, outside } = effectiveGrid(
    book,
    parentAsSpread(parent),
  ).values
  const { widthMm: page, heightMm } = book.settings.trim
  const safe = book.settings.safeMarginMm
  const y = Math.min(
    heightMm - bottom / 2 - FOLIO_HEIGHT_MM / 2,
    heightMm - safe - FOLIO_HEIGHT_MM,
  )
  const centre = (page - FOLIO_WIDTH_MM) / 2
  // x on its own page, kept inside the safe area (centred when it cannot fit).
  const min = Math.min(safe, centre)
  const max = Math.max(page - safe - FOLIO_WIDTH_MM, centre)
  const onPage = (x: number): number => Math.min(max, Math.max(min, x))
  const [leftX, rightX] =
    position === 'outer'
      ? [outside, page - outside - FOLIO_WIDTH_MM]
      : position === 'centre'
        ? [centre, centre]
        : [page - inside - FOLIO_WIDTH_MM, inside]
  const [leftAlign, rightAlign] = alignsOf(position)
  const rect = (x: number): RectMm => ({
    x,
    y,
    width: FOLIO_WIDTH_MM,
    height: FOLIO_HEIGHT_MM,
  })
  return [
    { id: itemId(parentId, 'l'), rect: rect(onPage(leftX)), align: leftAlign },
    {
      id: itemId(parentId, 'r'),
      rect: rect(page + onPage(rightX)),
      align: rightAlign,
    },
  ]
}

/** Position read back from the left item's align; `null` without one. */
export function pageNumberPosition(
  parent: ParentSpread,
): PageNumberPosition | null {
  const left = parent.pageNumbers?.find(
    (item) => item.id === itemId(parent.id, 'l'),
  )
  if (left === undefined) {
    return null
  }
  if (left.align === 'center') {
    return 'centre'
  }
  return left.align === 'right' ? 'inner' : 'outer'
}

/** Page sides a spread has: page 1 sits alone on the right, a single last page on the left. */
function pageSides(spreadIndex: number, spreadCount: number): readonly Side[] {
  if (spreadIndex === 0) {
    return ['r']
  }
  return spreadIndex === spreadCount - 1 ? ['l'] : ['l', 'r']
}

function folioOn(
  book: Book,
  spreadIndex: number,
  side: Side,
): { item: PageNumberItem; text: string } | undefined {
  const spread = book.spreads[spreadIndex]
  if (
    spread === undefined ||
    !pageSides(spreadIndex, book.spreads.length).includes(side)
  ) {
    return undefined
  }
  const parent = spreadParent(book, spread)
  const id = parent === undefined ? undefined : itemId(parent.id, side)
  const item = parent?.pageNumbers?.find((candidate) => candidate.id === id)
  if (
    item === undefined ||
    spread.parentOverrides?.hiddenIds?.includes(item.id) === true
  ) {
    return undefined
  }
  const page = spreadIndex * 2 + (side === 'r' ? 1 : 0)
  const { start, skipFirst, format } = pageNumberingOf(book)
  if (skipFirst && page === 1) {
    return undefined
  }
  const text = formatPageNumber(start + page - 1, format)
  return text === undefined ? undefined : { item, text }
}

/**
 * Folio printed on physical page `page` (1-based: spread `i` holds pages
 * `2i`, `2i + 1`); `undefined` when the page, its parent item or its number
 * does not exist, the spread hides the item, or page 1 is skipped.
 */
export function folioText(book: Book, page: number): string | undefined {
  // Page 0 and below land on no spread side.
  if (!Number.isInteger(page)) {
    return undefined
  }
  return folioOn(book, Math.floor(page / 2), page % 2 === 0 ? 'l' : 'r')?.text
}

/** Folios of spread `spreadIndex` in its own mm (a single page 1 starts at x 0). */
export function spreadFolios(book: Book, spreadIndex: number): ResolvedFolio[] {
  const single = getSpreadPageCount(spreadIndex, book.spreads.length) === 1
  const sides: readonly Side[] = ['l', 'r']
  return sides.flatMap((side) => {
    const folio = folioOn(book, spreadIndex, side)
    if (folio === undefined) {
      return []
    }
    const { item, text } = folio
    const shiftMm = side === 'r' && single ? book.settings.trim.widthMm : 0
    return [
      {
        id: item.id,
        text,
        rectMm: { ...item.rect, x: item.rect.x - shiftMm },
        align: item.align ?? 'left',
      },
    ]
  })
}

function itemsKey(items: readonly PageNumberItem[] | undefined): string {
  return JSON.stringify(
    items?.map(({ id, align, rect }) => [
      id,
      align,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    ]),
  )
}

function sameItems(
  a: readonly PageNumberItem[] | undefined,
  b: readonly PageNumberItem[],
): boolean {
  return itemsKey(a) === itemsKey(b)
}

function writeItems(
  book: Book,
  parentId: string,
  items: PageNumberItem[],
): Book {
  return updateParentSpread(book, parentId, (parent) =>
    sameItems(parent.pageNumbers, items)
      ? parent
      : { ...parent, pageNumbers: items },
  )
}

/** Show folios at `position` on a parent, or remove them (`null`). */
export function setParentPageNumbers(
  book: Book,
  parentId: string,
  position: PageNumberPosition | null,
): Book {
  if (position === null) {
    return updateParentSpread(book, parentId, (parent) =>
      parent.pageNumbers === undefined
        ? parent
        : omitKey(parent, 'pageNumbers'),
    )
  }
  return writeItems(book, parentId, pageNumberItems(book, parentId, position))
}

/**
 * Re-derives the folio rects of every parent that has them (after a trim or
 * grid edit); unchanged rects keep the same parent and book.
 */
export function syncPageNumbers(book: Book): Book {
  if (book.parents === undefined) {
    return book
  }
  let next = book
  for (const parent of book.parents) {
    const position = pageNumberPosition(parent)
    if (position !== null) {
      next = writeItems(
        next,
        parent.id,
        pageNumberItems(next, parent.id, position),
      )
    }
  }
  return next
}

/**
 * Book numbering merged over the current one (absent → start 1, decimal):
 * `start` is rounded and clamped to 1–999, a non-finite one is ignored; the
 * same values leave the book.
 */
export function setPageNumbering(
  book: Book,
  patch: Partial<PageNumbering>,
): Book {
  const current = pageNumberingOf(book)
  const asked = patch.start ?? Number.NaN
  const start = Number.isFinite(asked)
    ? Math.min(
        PAGE_NUMBER_START_MAX,
        Math.max(PAGE_NUMBER_START_MIN, Math.round(asked)),
      )
    : current.start
  const next: PageNumbering = {
    start,
    skipFirst: patch.skipFirst ?? current.skipFirst,
    format: patch.format ?? current.format,
  }
  if (
    next.start === current.start &&
    next.skipFirst === current.skipFirst &&
    next.format === current.format
  ) {
    return book
  }
  return { ...book, pageNumbering: next }
}

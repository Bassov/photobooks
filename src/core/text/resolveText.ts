import type { Asset, Book, Frame, Spread, TextStyleId } from '../schema'

export interface ResolvedTextItem {
  frameId: string
  text: string
  styleId: TextStyleId
  align: 'left' | 'center' | 'right'
  /** Image frame the text follows; omitted when unanchored. */
  anchorFrameId?: string
}

const DEFAULT_TEXT_STYLE: TextStyleId = 'caption'
const DEFAULT_TEXT_ALIGN = 'left' as const

/** Live caption parts are joined with a middle dot (kit chip separator). */
const TOKEN_SEPARATOR = ' · '

/** Printed for each photo token when the anchor frame holds no photo. */
const NO_PHOTO_VALUE = '—'

const PHOTO_TOKENS = ['date', 'title', 'caption', 'camera'] as const

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function isTextFrame(frame: Frame): boolean {
  return frame.kind === 'text'
}

function dayMonthYear(day: number, month: number, year: number): string {
  const name = MONTHS[month - 1]
  return name === undefined || day < 1 || day > 31
    ? ''
    : `${String(day)} ${name} ${String(year)}`
}

/**
 * `capturedAt` as `D Mon YYYY` (fixed English months, no `Intl`): an ISO
 * time with `Z` / offset reads the local date, else the first
 * `YYYY[-:]MM[-:]DD` digits (EXIF `2025:07:12 08:35:00`); unparseable → ''.
 */
export function formatCaptureDate(capturedAt: string): string {
  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(capturedAt)) {
    const date = new Date(capturedAt)
    return Number.isNaN(date.getTime())
      ? ''
      : dayMonthYear(date.getDate(), date.getMonth() + 1, date.getFullYear())
  }
  const match = /(\d{4})[-:](\d{2})[-:](\d{2})/.exec(capturedAt)
  return match === null
    ? ''
    : dayMonthYear(Number(match[3]), Number(match[2]), Number(match[1]))
}

function photoValues(asset: Asset | undefined): Record<string, string> {
  return {
    date: formatCaptureDate(asset?.capturedAt ?? ''),
    title: asset?.meta?.title ?? '',
    caption: asset?.meta?.caption ?? '',
    camera: asset?.meta?.camera ?? '',
  }
}

/** Replaces known tokens; unknown tokens stay literal. */
function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? (values[name] ?? token) : token,
  )
}

/** Drops ` · ` parts left blank by empty photo values. */
function dropEmptyParts(text: string): string {
  return text
    .split(TOKEN_SEPARATOR)
    .filter((part) => part.trim() !== '')
    .join(TOKEN_SEPARATOR)
}

function resolveTemplate(
  book: Book,
  spread: Spread,
  frame: Frame,
  template: string,
): string {
  const spreadNumber = String(book.spreads.indexOf(spread) + 1)
  if (frame.anchorFrameId === undefined) {
    return fillTemplate(template, {
      date: '',
      title: book.title ?? '',
      caption: '',
      camera: '',
      spread: spreadNumber,
    })
  }
  const anchorId = frame.anchorFrameId
  const assetId = spread.frames.find((f) => f.id === anchorId)?.assetId
  if (assetId === undefined) {
    const dashes = Object.fromEntries(
      PHOTO_TOKENS.map((name) => [name, NO_PHOTO_VALUE]),
    )
    return fillTemplate(template, { ...dashes, spread: spreadNumber })
  }
  return dropEmptyParts(
    fillTemplate(template, {
      ...photoValues(book.assets[assetId]),
      spread: spreadNumber,
    }),
  )
}

/** Pure: one text frame's content resolved against the book (and `spread` for tokens). */
export function resolveTextContent(
  book: Book,
  spread: Spread,
  frame: Frame,
): ResolvedTextItem {
  const content = frame.content
  const text =
    content === undefined
      ? ''
      : content.type === 'static'
        ? content.text
        : resolveTemplate(book, spread, frame, content.template)
  return {
    frameId: frame.id,
    text,
    styleId: frame.styleId ?? DEFAULT_TEXT_STYLE,
    align: frame.align ?? DEFAULT_TEXT_ALIGN,
    ...(frame.anchorFrameId === undefined
      ? {}
      : { anchorFrameId: frame.anchorFrameId }),
  }
}

/** Pure: text frames of a spread with content resolved against the book, in z order. */
export function resolveTextItems(
  book: Book,
  spread: Spread,
): ResolvedTextItem[] {
  return spread.frames
    .filter(isTextFrame)
    .toSorted((a, b) => a.z - b.z)
    .map((frame) => resolveTextContent(book, spread, frame))
}

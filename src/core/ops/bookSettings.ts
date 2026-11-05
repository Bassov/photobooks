import { builtInPrintProfiles } from '../print/catalog'
import type { PrintProfile } from '../print/profileSchema'
import type { Book } from '../schema'

/** Page trim limits in mm (kit size editor: 5–50 cm). */
export const TRIM_MIN_MM = 50
export const TRIM_MAX_MM = 500

function round1(mm: number): number {
  return Math.round(mm * 10) / 10
}

function clampTrim(mm: number): number {
  return Math.min(TRIM_MAX_MM, Math.max(TRIM_MIN_MM, round1(mm)))
}

/**
 * Resize one page. Frames and guides keep their place relative to the page
 * (scaled per axis), so a resize never leaves frames off the paper.
 */
export function setTrim(
  book: Book,
  trim: { widthMm: number; heightMm: number },
): Book {
  if (!Number.isFinite(trim.widthMm) || !Number.isFinite(trim.heightMm)) {
    return book
  }
  const widthMm = clampTrim(trim.widthMm)
  const heightMm = clampTrim(trim.heightMm)
  const old = book.settings.trim
  if (old.widthMm === widthMm && old.heightMm === heightMm) {
    return book
  }
  const kx = widthMm / old.widthMm
  const ky = heightMm / old.heightMm
  const scaleGuides = <G extends { orientation: string; offsetMm: number }>(
    guides: readonly G[],
  ): G[] =>
    guides.map((guide) => ({
      ...guide,
      offsetMm: round1(
        guide.offsetMm * (guide.orientation === 'vertical' ? kx : ky),
      ),
    }))
  return {
    ...book,
    settings: { ...book.settings, trim: { widthMm, heightMm } },
    guides: scaleGuides(book.guides),
    spreads: book.spreads.map((spread) => ({
      ...spread,
      ...(spread.guides === undefined
        ? {}
        : { guides: scaleGuides(spread.guides) }),
      frames: spread.frames.map((frame) => ({
        ...frame,
        rect: {
          x: round1(frame.rect.x * kx),
          y: round1(frame.rect.y * ky),
          width: Math.max(0.1, round1(frame.rect.width * kx)),
          height: Math.max(0.1, round1(frame.rect.height * ky)),
        },
      })),
    })),
  }
}

/**
 * Spec D4: the book takes profile `id` (built-in, else from `customs`) with no
 * overrides, a custom one also as a snapshot; the bleed is clamped to the
 * profile and the safe margin is the profile's. Trim and page count stay (out
 * of range is a warning); an unknown id leaves the book as it is.
 */
export function setPrintProfile(
  book: Book,
  id: string,
  customs: readonly PrintProfile[] = [],
): Book {
  const builtIn = builtInPrintProfiles().find((profile) => profile.id === id)
  const profile = builtIn ?? customs.find((custom) => custom.id === id)
  if (profile === undefined) {
    return book
  }
  return {
    ...book,
    printProfile:
      builtIn === undefined
        ? { id, overrides: {}, snapshot: profile }
        : { id, overrides: {} },
    settings: {
      ...book.settings,
      bleedMm: Math.min(
        profile.bleedMaxMm,
        Math.max(profile.bleedMinMm, book.settings.bleedMm),
      ),
      safeMarginMm: profile.safeMarginMm,
    },
  }
}

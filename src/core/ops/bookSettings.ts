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

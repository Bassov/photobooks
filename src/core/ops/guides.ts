import { updateSpread } from '../update'
import type { Book, Spread } from '../schema'

export type Guide = NonNullable<Spread['guides']>[number]

/** Guides pulled further than this beyond the spread edge are not kept. */
export const GUIDE_OVERSHOOT_MM = 20

function roundMm(mm: number): number {
  return Math.round(mm * 10) / 10
}

function guidesOf(spread: Spread): readonly Guide[] {
  return spread.guides ?? []
}

/** First `guide-<n>` not used on the spread. */
export function nextGuideId(spread: Spread): string {
  const existing = new Set(guidesOf(spread).map((guide) => guide.id))
  let n = existing.size + 1
  while (existing.has(`guide-${String(n)}`)) {
    n += 1
  }
  return `guide-${String(n)}`
}

/** Append a spread guide (offset rounded to 0.1 mm); a taken id or a non-finite offset is a no-op. */
export function addGuide(
  book: Book,
  spreadId: string,
  guide: {
    orientation: Guide['orientation']
    offsetMm: number
    id?: string | undefined
  },
): Book {
  if (!Number.isFinite(guide.offsetMm)) {
    return book
  }
  return updateSpread(book, spreadId, (spread) => {
    const id = guide.id ?? nextGuideId(spread)
    if (guidesOf(spread).some((existing) => existing.id === id)) {
      return spread
    }
    const added: Guide = {
      id,
      orientation: guide.orientation,
      offsetMm: roundMm(guide.offsetMm),
    }
    return { ...spread, guides: [...guidesOf(spread), added] }
  })
}

/** `guides` with `guideId` at `offsetMm`; the same array when it is absent, locked or already there. */
function movedIn<G extends Guide>(
  guides: readonly G[],
  guideId: string,
  offsetMm: number,
): readonly G[] {
  const current = guides.find((guide) => guide.id === guideId)
  if (
    current === undefined ||
    current.locked === true ||
    current.offsetMm === offsetMm
  ) {
    return guides
  }
  return guides.map((guide) =>
    guide.id === guideId ? { ...guide, offsetMm } : guide,
  )
}

/**
 * Move one guide along its axis: an own guide, else a parent guide's local
 * copy (`parentOverrides.guides`). Locked or unknown guides stay.
 */
export function moveGuide(
  book: Book,
  spreadId: string,
  guideId: string,
  offsetMm: number,
): Book {
  if (!Number.isFinite(offsetMm)) {
    return book
  }
  const next = roundMm(offsetMm)
  return updateSpread(book, spreadId, (spread) => {
    const own = guidesOf(spread)
    if (own.some((guide) => guide.id === guideId)) {
      const guides = movedIn(own, guideId, next)
      return guides === own ? spread : { ...spread, guides: [...guides] }
    }
    const overrides = spread.parentOverrides
    if (overrides?.guides === undefined) {
      return spread
    }
    const guides = movedIn(overrides.guides, guideId, next)
    return guides === overrides.guides
      ? spread
      : { ...spread, parentOverrides: { ...overrides, guides: [...guides] } }
  })
}

/** Delete one guide; locked or unknown guides stay. */
export function removeGuide(
  book: Book,
  spreadId: string,
  guideId: string,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const current = guidesOf(spread).find((guide) => guide.id === guideId)
    if (current === undefined || current.locked === true) {
      return spread
    }
    return {
      ...spread,
      guides: guidesOf(spread).filter((guide) => guide.id !== guideId),
    }
  })
}

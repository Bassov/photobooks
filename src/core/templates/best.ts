import type { Book } from '../schema'
import { getSpreadPageCount } from '../geometry/spreadSize'
import { slotAspect, templateSlotAspects, type AspectClass } from './aspect'
import { customLayoutRects, type SavedTemplate } from './custom'
import {
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  contactSheetId,
  type TemplateId,
} from './types'

const CANDIDATES: TemplateId[] = [
  'two-portraits',
  'landscape-two-portraits',
  'full-bleed',
  'one-per-page',
  '2-up',
  '4-grid',
]

function smallestContactSheet(perPage: number): TemplateId {
  let best = { cols: CONTACT_MAX_COLS, rows: CONTACT_MAX_ROWS }
  let bestCells = Infinity
  for (let rows = 1; rows <= CONTACT_MAX_ROWS; rows += 1) {
    for (let cols = 1; cols <= CONTACT_MAX_COLS; cols += 1) {
      const cells = cols * rows
      if (cells >= perPage && cells < bestCells) {
        best = { cols, rows }
        bestCells = cells
      }
    }
  }
  return contactSheetId(best.cols, best.rows)
}

interface Candidate {
  id: string
  slots: readonly AspectClass[]
}

/**
 * Pure best-fit template for photos in order, by count then orientation.
 * Builtins come first, then `saved` layouts of this spread's page count in
 * save order; on an equal score the earlier candidate wins.
 */
export function bestTemplateId(
  book: Book,
  spreadIndex: number,
  photos: readonly AspectClass[],
  saved: readonly SavedTemplate[] = [],
): string {
  if (photos.length === 0) {
    return 'one-per-page'
  }
  const pages = getSpreadPageCount(spreadIndex, book.spreads.length)
  const builtins = [
    ...CANDIDATES,
    smallestContactSheet(Math.ceil(photos.length / pages)),
  ]
  const candidates: Candidate[] = [
    ...builtins.map((id) => ({
      id,
      slots: templateSlotAspects(id, book, spreadIndex),
    })),
    ...saved
      .filter((template) => template.pages === pages)
      .map((template) => ({
        id: template.id,
        slots: customLayoutRects(book, spreadIndex, template.slots).map(
          slotAspect,
        ),
      })),
  ]
  let winner: string = contactSheetId(CONTACT_MAX_COLS, CONTACT_MAX_ROWS)
  let winnerScore: [number, number] | null = null
  for (const { id, slots } of candidates) {
    if (slots.length < photos.length) {
      continue
    }
    let mismatches = 0
    photos.forEach((photo, index) => {
      const slot = slots[index]
      if (slot !== photo && slot !== 'square' && photo !== 'square') {
        mismatches += 1
      }
    })
    const score: [number, number] = [mismatches, slots.length - photos.length]
    if (
      winnerScore === null ||
      score[0] < winnerScore[0] ||
      (score[0] === winnerScore[0] && score[1] < winnerScore[1])
    ) {
      winner = id
      winnerScore = score
    }
  }
  return winner
}

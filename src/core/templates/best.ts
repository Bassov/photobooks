import type { Book } from '../schema'
import { getSpreadPageCount } from '../geometry/spreadSize'
import { templateSlotAspects, type AspectClass } from './aspect'
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

/** Pure best-fit template for photos in order, by count then orientation. */
export function bestTemplateId(
  book: Book,
  spreadIndex: number,
  photos: readonly AspectClass[],
): TemplateId {
  if (photos.length === 0) {
    return 'one-per-page'
  }
  const pages = getSpreadPageCount(spreadIndex, book.spreads.length)
  const candidates = [
    ...CANDIDATES,
    smallestContactSheet(Math.ceil(photos.length / pages)),
  ]
  let winner: TemplateId = contactSheetId(CONTACT_MAX_COLS, CONTACT_MAX_ROWS)
  let winnerScore: [number, number] | null = null
  for (const id of candidates) {
    const slots = templateSlotAspects(id, book, spreadIndex)
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

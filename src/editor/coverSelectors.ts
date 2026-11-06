import type { Cover } from '../core'
// Not the barrel: CoverView's site bundle rule (zod-free geometry).
import {
  bookCoverGeometry,
  type CoverGeometry,
} from '../core/print/coverGeometry'
import { sameCoverGeometry } from '../render/coverLayout'
import { getBookStoreSnapshot } from './bookStore'

export function readCover(): Cover {
  return getBookStoreSnapshot().book.cover
}

let lastGeometry: CoverGeometry | undefined

/**
 * Cover geometry of the store book, the previous object while every value is
 * equal: a frame edit keeps it, a Pages or trim change replaces it (Designer
 * cover-editor perf: a Pages change re-renders only the cover views).
 */
export function readCoverGeometry(): CoverGeometry {
  const next = bookCoverGeometry(getBookStoreSnapshot().book)
  if (lastGeometry === undefined || !sameCoverGeometry(lastGeometry, next)) {
    lastGeometry = next
  }
  return lastGeometry
}

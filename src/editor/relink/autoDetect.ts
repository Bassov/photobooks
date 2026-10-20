import { getAssetSource } from '../../photo/assetSources'
import { getBookStoreSnapshot, subscribeBookStore } from '../bookStore'
import {
  getProjectSessionSnapshot,
  subscribeProjectSession,
} from '../projectSession'
import { detectMissingAssets } from './detect'
import { shouldDetectOnActivation } from './relinkModel'

let lastKey = ''
let installed = false

/** Pure key for deduping auto-detect across session/gallery/source changes. */
export function relinkDetectKey(
  bookId: string | null,
  galleryKey: string,
  importRunning: boolean,
  sourcedCount: number,
): string {
  return `${bookId ?? ''}:${galleryKey}:${importRunning ? '1' : '0'}:${String(sourcedCount)}`
}

/**
 * Run detect when the active library-backed book needs it. Idempotent per
 * bookId+gallery+source key so React re-renders cannot loop, but a later
 * AssetSource attach re-runs detect and clears false missings.
 */
export function syncRelinkAutoDetect(): void {
  const project = getProjectSessionSnapshot()
  if (
    !shouldDetectOnActivation({
      surface: project.surface,
      bookId: project.bookId,
      restorePending: project.restorePending,
      accessPhase: project.accessPhase,
    })
  ) {
    return
  }
  const store = getBookStoreSnapshot()
  if (store.importRunning) {
    return
  }
  const gallery = store.book.gallery
  const galleryKey = gallery.join('\0')
  let sourcedCount = 0
  for (const id of gallery) {
    if (getAssetSource(id) !== undefined) {
      sourcedCount += 1
    }
  }
  const key = relinkDetectKey(
    project.bookId,
    galleryKey,
    store.importRunning,
    sourcedCount,
  )
  if (key === lastKey) {
    return
  }
  lastKey = key
  detectMissingAssets({ openDialog: true })
}

/** Reset dedupe key (tests). */
export function resetRelinkAutoDetect(): void {
  lastKey = ''
  installed = false
}

/**
 * Subscribe once to session + book store. Safe outside React (no effect loop).
 */
export function installRelinkAutoDetect(): () => void {
  if (installed) {
    return () => undefined
  }
  installed = true
  syncRelinkAutoDetect()
  const unsubSession = subscribeProjectSession(() => {
    syncRelinkAutoDetect()
  })
  const unsubBook = subscribeBookStore(() => {
    syncRelinkAutoDetect()
  })
  return () => {
    unsubSession()
    unsubBook()
    installed = false
  }
}

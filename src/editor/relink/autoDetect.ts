import { getBookStoreSnapshot, subscribeBookStore } from '../bookStore'
import {
  getProjectSessionSnapshot,
  subscribeProjectSession,
} from '../projectSession'
import { detectMissingAssets } from './detect'
import { shouldDetectOnActivation } from './relinkModel'

let lastKey = ''
let installed = false

/** Pure key for deduping auto-detect across session/gallery changes. */
export function relinkDetectKey(
  bookId: string | null,
  galleryKey: string,
): string {
  return `${bookId ?? ''}:${galleryKey}`
}

/**
 * Run detect when the active library-backed book needs it. Idempotent per
 * bookId+gallery key so React re-renders cannot loop.
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
  const galleryKey = getBookStoreSnapshot().book.gallery.join('\0')
  const key = relinkDetectKey(project.bookId, galleryKey)
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

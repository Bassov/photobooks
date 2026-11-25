/** How often URLs held back by a mounted element are checked again. */
export const DEFERRED_REVOKE_RECHECK_MS = 1000

/** Elements that can make the browser fetch a `blob:` URL. */
const BLOB_REFERENCE_SELECTOR =
  '[src^="blob:"], [srcset*="blob:"], [style*="blob:"]'

const pending = new Set<string>()
let recheckTimer: ReturnType<typeof setTimeout> | undefined
/** `src` / `srcset` / `style` strings that hold a blob URL, read once per task. */
let referenceSnapshot: string[] | undefined

function blobReferences(): string[] {
  if (referenceSnapshot !== undefined) {
    return referenceSnapshot
  }
  const found: string[] = []
  for (const element of document.querySelectorAll(BLOB_REFERENCE_SELECTOR)) {
    for (const name of ['src', 'srcset', 'style']) {
      const value = element.getAttribute(name)
      if (value?.includes('blob:') === true) {
        found.push(value)
      }
    }
  }
  referenceSnapshot = found
  // The DOM may change in the next task; read it again then.
  queueMicrotask(() => {
    referenceSnapshot = undefined
  })
  return found
}

function isReferenced(url: string): boolean {
  return blobReferences().some((value) => value.includes(url))
}

function recheckPending(): void {
  recheckTimer = undefined
  for (const url of pending) {
    if (!isReferenced(url)) {
      pending.delete(url)
      URL.revokeObjectURL(url)
    }
  }
  scheduleRecheck()
}

function scheduleRecheck(): void {
  if (pending.size > 0 && recheckTimer === undefined) {
    recheckTimer = setTimeout(recheckPending, DEFERRED_REVOKE_RECHECK_MS)
  }
}

/**
 * Revoke an object URL once no element in the document references it. A
 * mounted `<img>` keeps its old `src` / `srcset` until it re-renders, and the
 * browser fetches it again on remount, clone or srcset switch: revoking it
 * then logs `net::ERR_FILE_NOT_FOUND`. Held URLs are revoked by a timer
 * after the element drops them. Without a DOM the URL is revoked now.
 */
export function revokeObjectUrlWhenUnused(url: string): void {
  if (typeof document === 'undefined' || !isReferenced(url)) {
    URL.revokeObjectURL(url)
    return
  }
  pending.add(url)
  scheduleRecheck()
}

/** Test seam: URLs held back because an element still references them. */
export function getDeferredRevokeCountForTests(): number {
  return pending.size
}

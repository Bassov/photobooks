import { vi } from 'vitest'

/** Capture IntersectionObserver callbacks for pasteboard active-spread tests. */
export function stubIntersectionObserverCapture(): {
  callbacks: IntersectionObserverCallback[]
} {
  const callbacks: IntersectionObserverCallback[] = []
  class FakeIntersectionObserver {
    constructor(cb: IntersectionObserverCallback) {
      callbacks.push(cb)
    }
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  return { callbacks }
}

export function fakeIntersectionEntry(
  target: Element,
  intersectionRatio: number,
): IntersectionObserverEntry {
  return {
    target,
    intersectionRatio,
  } as unknown as IntersectionObserverEntry
}

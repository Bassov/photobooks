/** Last published filmstrip window (view order + mounted range). */
export interface FilmstripWindow {
  order: readonly string[]
  /** First mounted index in `order`. */
  start: number
  /** One past the last mounted index. */
  end: number
  /** Last scroll direction along `order` (1 forward, -1 back, 0 unknown). */
  direction: -1 | 0 | 1
}

type Listener = () => void

const EMPTY: FilmstripWindow = { order: [], start: 0, end: 0, direction: 0 }

let current: FilmstripWindow = EMPTY
const listeners = new Set<Listener>()

export function getFilmstripWindow(): FilmstripWindow {
  return current
}

export function setFilmstripWindow(next: FilmstripWindow): void {
  current = next
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeFilmstripWindow(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetFilmstripWindowForTests(): void {
  current = EMPTY
  listeners.clear()
}

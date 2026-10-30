import { clamp } from '../lib/clamp'
/** Kit sandbox `view.thumb` default (below the 90 px name-strip threshold). */
export const FILMSTRIP_THUMB_DEFAULT = 76
export const FILMSTRIP_THUMB_MIN = 64
export const FILMSTRIP_THUMB_MAX = 192
export const FILMSTRIP_THUMB_STEP = 8
const STORAGE_KEY = 'photobooks.filmstrip.thumbHeight'

type Listener = () => void

const listeners = new Set<Listener>()

export function clampThumbHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return FILMSTRIP_THUMB_DEFAULT
  }
  return Math.round(clamp(value, FILMSTRIP_THUMB_MIN, FILMSTRIP_THUMB_MAX))
}

export function readStored(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === null
      ? FILMSTRIP_THUMB_DEFAULT
      : clampThumbHeight(Number(raw))
  } catch {
    return FILMSTRIP_THUMB_DEFAULT
  }
}

let height = readStored()

export function getFilmstripThumbHeight(): number {
  return height
}

export function subscribeFilmstripThumbHeight(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Commit a new thumb height (clamped, persisted, subscribers notified once). */
export function setFilmstripThumbHeight(next: number): void {
  const value = clampThumbHeight(next)
  if (value === height) {
    return
  }
  height = value
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Storage unavailable: keep the in-memory size for this session.
  }
  for (const listener of listeners) {
    listener()
  }
}

export function resetFilmstripThumbHeightForTests(): void {
  height = FILMSTRIP_THUMB_DEFAULT
  window.localStorage.removeItem(STORAGE_KEY)
  for (const listener of listeners) {
    listener()
  }
}

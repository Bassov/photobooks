import { useSyncExternalStore } from 'react'
import { appInnerHeight, subscribeUiScale } from '../ui/uiScale'

/**
 * Filmstrip thumb height H (Designer walkthrough-ux-review §B, kit
 * `uikit/src/sandbox/store.tsx` `thumbPx`): `auto` follows the window height,
 * a number is the user's pick from the dock separator.
 */
export type FilmstripThumb = number | 'auto'

export const THUMB_MIN = 56
/** File names show under thumbs from this H up (kit chrome.tsx `h >= 90`). */
export const THUMB_NAMES_MIN = 90
const THUMB_STEP = 4
const THUMB_KEY_STEP = 8
export const THUMB_STORAGE_KEY = 'photobooks.filmstrip.thumb.v2'

/** `auto` = clamp(76, floor(0.085 · innerHeight), 160): 900 → 76. */
export function thumbAuto(innerHeight: number): number {
  return Math.min(160, Math.max(76, Math.floor(0.085 * innerHeight)))
}

/** Manual max = min(240, floor(0.5 · (innerHeight − 48)) − 64), never below the min. */
export function thumbMax(innerHeight: number): number {
  return Math.max(
    THUMB_MIN,
    Math.min(240, Math.floor(0.5 * (innerHeight - 48)) - 64),
  )
}

export function clampThumb(px: number, innerHeight: number): number {
  return Math.min(thumbMax(innerHeight), Math.max(THUMB_MIN, px))
}

export function thumbPx(thumb: FilmstripThumb, innerHeight: number): number {
  return thumb === 'auto'
    ? thumbAuto(innerHeight)
    : clampThumb(thumb, innerHeight)
}

/** Drag from `startPx` by `deltaUpPx` (pointer moved up) in 4 px steps, clamped. */
export function thumbDragPx(
  startPx: number,
  deltaUpPx: number,
  innerHeight: number,
): number {
  return clampThumb(
    Math.round((startPx + deltaUpPx) / THUMB_STEP) * THUMB_STEP,
    innerHeight,
  )
}

/** Separator keys: ↑/↓ ±8, Home min, End max, Enter `auto`; other keys → null. */
export function thumbForKey(
  key: string,
  currentPx: number,
  innerHeight: number,
): FilmstripThumb | null {
  switch (key) {
    case 'ArrowUp':
      return clampThumb(currentPx + THUMB_KEY_STEP, innerHeight)
    case 'ArrowDown':
      return clampThumb(currentPx - THUMB_KEY_STEP, innerHeight)
    case 'Home':
      return THUMB_MIN
    case 'End':
      return thumbMax(innerHeight)
    case 'Enter':
      return 'auto'
    default:
      return null
  }
}

/** Stored pick: a finite number or `auto` (missing / bad / old key → `auto`). */
export function readThumb(): FilmstripThumb {
  try {
    const raw = window.localStorage.getItem(THUMB_STORAGE_KEY)
    const n = Number(raw)
    // "auto", junk and NaN fail isFinite; '' would read as 0.
    return raw !== null && raw !== '' && Number.isFinite(n) ? n : 'auto'
  } catch {
    return 'auto'
  }
}

export function writeThumb(thumb: FilmstripThumb): void {
  try {
    window.localStorage.setItem(THUMB_STORAGE_KEY, String(thumb))
  } catch {
    // Storage blocked (private mode / quota): the pick lasts this session.
  }
}

let current: FilmstripThumb | null = null
const listeners = new Set<() => void>()

function currentThumb(): FilmstripThumb {
  current ??= readThumb()
  return current
}

/** Sets H for this session; `persist` writes the v2 key (drag steps pass false). */
export function setFilmstripThumb(thumb: FilmstripThumb, persist = true): void {
  current = thumb
  if (persist) {
    writeThumb(thumb)
  }
  for (const listener of listeners) {
    listener()
  }
}

/** Test hook: forget the session pick so the next read hits storage. */
export function resetFilmstripThumb(): void {
  current = null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // A window resize re-clamps H on render; it never writes storage.
  // So does an interface size change (H is in app px: innerHeight / s).
  window.addEventListener('resize', listener)
  const offScale = subscribeUiScale(listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('resize', listener)
    offScale()
  }
}

function heightSnapshot(): number {
  return thumbPx(currentThumb(), appInnerHeight())
}

function maxSnapshot(): number {
  return thumbMax(appInnerHeight())
}

/** Effective thumb height H for the current window. */
export function useFilmstripThumbHeight(): number {
  return useSyncExternalStore(subscribe, heightSnapshot, heightSnapshot)
}

/** Largest manual H for the current window (separator aria-valuemax / End). */
export function useFilmstripThumbMax(): number {
  return useSyncExternalStore(subscribe, maxSnapshot, maxSnapshot)
}

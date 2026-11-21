import { useSyncExternalStore } from 'react'

/**
 * Interface size (Designer `interface-size` §2, D1–D4): the whole app scales
 * by `#root { zoom: var(--ui-scale) }`, and the app viewport tokens in
 * `styles/app.css` divide the viewport units by the same s. The choice is
 * saved per computer; the effective s is clamped so the app stays at least
 * 1280×720 CSS px and is never written back.
 */
export const UI_SCALES = [1, 1.25, 1.5] as const
export type UiScaleStep = (typeof UI_SCALES)[number]

export const UI_SCALE_KEY = 'photobooks.ui.scale.v1'

const MIN_APP_W = 1280
const MIN_APP_H = 720

const STORED = new Map<string, UiScaleStep>([
  ['100', 1],
  ['125', 1.25],
  ['150', 1.5],
])

export interface UiScaleState {
  readonly choice: UiScaleStep
  readonly effective: UiScaleStep
}

/** Stored choice; anything but "100" | "125" | "150" (or no storage) is 1. */
export function readUiScaleChoice(): UiScaleStep {
  try {
    return STORED.get(window.localStorage.getItem(UI_SCALE_KEY) ?? '') ?? 1
  } catch {
    return 1
  }
}

/** D4: the largest step ≤ choice that leaves a 1280×720 app, else 1. */
export function effectiveUiScale(
  choice: number,
  width: number,
  height: number,
): UiScaleStep {
  let best: UiScaleStep = 1
  for (const s of UI_SCALES) {
    if (s <= choice && width / s >= MIN_APP_W && height / s >= MIN_APP_H) {
      best = s
    }
  }
  return best
}

let state: UiScaleState | null = null
const listeners = new Set<() => void>()

function computeState(): UiScaleState {
  const choice = readUiScaleChoice()
  return {
    choice,
    effective: effectiveUiScale(choice, window.innerWidth, window.innerHeight),
  }
}

function currentState(): UiScaleState {
  state ??= computeState()
  return state
}

function writeRootScale(effective: UiScaleStep): void {
  const root = document.documentElement
  root.style.setProperty('--ui-scale', String(effective))
  root.dataset.uiScale = String(Math.round(effective * 100))
}

/** Re-reads choice + window size; writes `<html>` and notifies on a change. */
function refresh(): void {
  const prev = currentState()
  const next = computeState()
  writeRootScale(next.effective)
  // Same values keep the old object, so useSyncExternalStore bails out.
  if (next.choice === prev.choice && next.effective === prev.effective) {
    return
  }
  state = next
  for (const listener of listeners) {
    listener()
  }
}

/** Saves the choice for this computer and applies it at once. */
export function setUiScaleChoice(choice: UiScaleStep): void {
  try {
    window.localStorage.setItem(UI_SCALE_KEY, String(Math.round(choice * 100)))
  } catch {
    // Storage blocked: nothing to apply, the stored choice is unchanged.
  }
  refresh()
}

let frame = 0
function onResize(): void {
  if (frame !== 0) {
    return
  }
  frame = window.requestAnimationFrame(() => {
    frame = 0
    refresh()
  })
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === UI_SCALE_KEY) {
    refresh()
  }
}

/**
 * Sets `--ui-scale` and `data-ui-scale` on `<html>` (call before the first
 * render) and follows window resizes (rAF-throttled) and other tabs. Returns
 * a disposer that removes the listeners.
 */
export function applyUiScale(): () => void {
  state = null
  writeRootScale(currentState().effective)
  window.addEventListener('resize', onResize)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('storage', onStorage)
    window.cancelAnimationFrame(frame)
    frame = 0
  }
}

/** Subscribes to effective scale / choice changes. */
export function subscribeUiScale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** `{ choice, effective }` for React (Settings row, clamp hint). */
export function useUiScale(): UiScaleState {
  return useSyncExternalStore(subscribeUiScale, currentState, currentState)
}

/** Effective s, for pointer math in CSS px of the app. */
export function uiScale(): UiScaleStep {
  return currentState().effective
}

/** Device px per app CSS px: devicePixelRatio × s (D7). */
export function effectiveDpr(): number {
  return (window.devicePixelRatio || 1) * uiScale()
}

/** Window height in app CSS px (`innerHeight / s`). */
export function appInnerHeight(): number {
  return window.innerHeight / uiScale()
}

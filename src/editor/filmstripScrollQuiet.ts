/** Hold heavy React publishes briefly while the filmstrip is scrolling. */
const SCROLL_QUIET_MS = 200

let quietUntilMs = 0

/** Call from the filmstrip scroll handler so thumb/progress work can defer. */
export function noteFilmstripScrollActivity(): void {
  quietUntilMs = performance.now() + SCROLL_QUIET_MS
}

/** True while scroll-driven quiet window is still open. */
export function isFilmstripScrollQuiet(): boolean {
  return performance.now() < quietUntilMs
}

/** Milliseconds left in the quiet window (0 when not quiet). */
export function filmstripScrollQuietRemainingMs(): number {
  return Math.max(0, quietUntilMs - performance.now())
}

export function resetFilmstripScrollQuietForTests(): void {
  quietUntilMs = 0
}

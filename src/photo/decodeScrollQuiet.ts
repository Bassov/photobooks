/** Shared filmstrip-scroll quiet window for decode background drains. */

const DECODE_SCROLL_QUIET_MS = 200

let decodeScrollQuietUntilMs = 0

/**
 * Filmstrip scroll / interaction: pause background-lane drains until quiet.
 * Now-lane (visible ∪ book-used) still pumps immediately.
 */
export function noteDecodeScrollActivity(
  durationMs: number = DECODE_SCROLL_QUIET_MS,
): void {
  // Non-positive durationMs yields a quiet-until in the past (not quiet).
  decodeScrollQuietUntilMs = performance.now() + durationMs
}

/** True while the decode scroll-quiet window is still open. */
export function isDecodeScrollQuiet(): boolean {
  return performance.now() < decodeScrollQuietUntilMs
}

export function resetDecodeScrollQuietForTests(): void {
  decodeScrollQuietUntilMs = 0
}

/**
 * Yield to the event loop so filmstrip scroll can paint during long rescans.
 * Uses a macrotask (not microtask) so the browser can commit a frame.
 */
export function yieldForPaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

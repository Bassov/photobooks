/** Per-frame scrollLeft step: several slots per frame (a fling, not a nudge). */
export const FLING_STEP_PX = 240

/**
 * Fling the strip 0 → end → 0 → end, one `step` of scrollLeft per frame.
 * Each rAF first samples what the previous frame painted: placeholders whose
 * box intersects the scrollport. Self-contained for `page.evaluate`.
 */
export async function browserFlingAndProbe(step: number): Promise<{
  frames: number
  placeholderFrames: number
  maxPlaceholders: number
}> {
  const port = document.querySelector<HTMLElement>(
    '[data-testid="filmstrip-scroll"]',
  )
  if (!port) {
    throw new Error('filmstrip-scroll missing')
  }
  const nextFrame = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  let frames = 0
  let placeholderFrames = 0
  let maxPlaceholders = 0
  const sample = (): void => {
    const view = port.getBoundingClientRect()
    let visible = 0
    for (const node of port.querySelectorAll(
      '[data-testid="filmstrip-placeholder"]',
    )) {
      const box = node.getBoundingClientRect()
      if (
        box.right > view.left &&
        box.left < view.right &&
        box.bottom > view.top &&
        box.top < view.bottom
      ) {
        visible += 1
      }
    }
    frames += 1
    if (visible > 0) {
      placeholderFrames += 1
    }
    maxPlaceholders = Math.max(maxPlaceholders, visible)
  }
  const end = port.scrollWidth - port.clientWidth
  const legs = [end, 0, end]
  for (const target of legs) {
    for (;;) {
      await nextFrame()
      sample()
      const left = port.scrollLeft
      if (left === target) {
        break
      }
      port.scrollLeft =
        target > left ? Math.min(target, left + step) : Math.max(0, left - step)
    }
  }
  // Settle: the last scroll commit and its paint are sampled too.
  for (let i = 0; i < 4; i += 1) {
    await nextFrame()
    sample()
  }
  return { frames, placeholderFrames, maxPlaceholders }
}

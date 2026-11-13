import { useEffect, useRef, useState } from 'react'

/** How long the button reads "Copied". */
export const COPIED_MS = 2000

/** A longer gap between frames is a stall, not time "Copied" was seen. */
const MAX_FRAME_MS = 100

/** On a page too busy to paint, "Copied" still goes this long after the click. */
const MAX_COPIED_MS = 3000

/**
 * The system share sheet on a coarse pointer that has one; else the
 * clipboard. True when the link went to the clipboard.
 */
async function shareOrCopy(title: string, url: string): Promise<boolean> {
  const nav = navigator as Partial<Navigator>
  if (matchMedia('(pointer: coarse)').matches && nav.share !== undefined) {
    try {
      await nav.share({ title, url })
    } catch {
      // Dismissed sheet (AbortError) or a refused share: nothing to show.
    }
    return false
  }
  try {
    await nav.clipboard?.writeText(url)
  } catch {
    // No clipboard permission: still confirm, the link is the page's own.
  }
  return true
}

/**
 * Share (Designer personal-site D36): a text button that reads "Copied" for
 * 2 s after copying the link. Both labels sit in one grid cell (`.sb-share`),
 * so the width never moves (the hidden one is `visibility: hidden`); the
 * Copied label is the live region.
 */
export function ShareButton({
  title,
  url,
  className,
}: {
  title: string
  url: () => string
  className: string
}) {
  // the copy that reads "Copied" (0: "Share"); a new copy restarts the window
  const [shown, setShown] = useState(0)
  const copies = useRef(0)
  // the click of the copy that reads "Copied" (performance.now)
  const clicked = useRef(0)
  const copied = shown > 0
  // The 2 s are painted time, from the frame that paints "Copied": a long task
  // (before that paint or during the window) would otherwise eat into what
  // the reader sees, so a frame gap counts at most MAX_FRAME_MS. A stall
  // stretches the window up to MAX_COPIED_MS after the click, never below
  // 2 s after the paint. The cleanup drops the window on a new copy and on
  // unmount.
  useEffect(() => {
    if (!copied) return
    let seen = 0
    let end = Infinity
    let last = 0
    let frame = 0
    const tick = (now: number) => {
      if (end === Infinity) {
        end = Math.max(clicked.current + MAX_COPIED_MS, now + COPIED_MS)
      } else {
        seen += Math.min(now - last, MAX_FRAME_MS)
      }
      last = now
      if (seen >= COPIED_MS || now >= end) setShown(0)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [copied, shown])
  const press = () => {
    const at = performance.now()
    void shareOrCopy(title, url()).then((showCopied) => {
      if (!showCopied) return
      clicked.current = at
      setShown(++copies.current)
    })
  }
  return (
    <button
      type="button"
      className={`${className} g ss-tx sb-share`}
      data-testid="site-share"
      data-copied={copied ? '' : undefined}
      onClick={press}
    >
      <span>Share</span>
      <span aria-live="polite">Copied</span>
    </button>
  )
}

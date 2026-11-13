import { useEffect, useRef, useState } from 'react'

/** How long the button reads "Copied". */
export const COPIED_MS = 2000

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
  const copied = shown !== 0
  // The 2 s count from the frame that paints "Copied": a long task between
  // the commit and the paint would otherwise eat into what the reader sees.
  // The cleanup drops the window on a new copy and on unmount.
  useEffect(() => {
    if (shown === 0) return
    let timer: number | undefined
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        setShown(0)
      }, COPIED_MS)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [shown])
  const press = () => {
    void shareOrCopy(title, url()).then((showCopied) => {
      if (showCopied) setShown(++copies.current)
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

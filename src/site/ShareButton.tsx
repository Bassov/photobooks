import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/Icon'

/** How long the button reads "Link copied". */
export const COPIED_MS = 2000

async function shareOrCopy(title: string, url: string): Promise<boolean> {
  const nav = navigator as Partial<Navigator>
  if (nav.share !== undefined && nav.canShare?.({ url }) === true) {
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
    // No clipboard permission: the link still reaches the status text.
  }
  return true
}

/**
 * Native share sheet where there is one, else copy the link and read "Link
 * copied" for 2 s. Both labels share one grid cell, so the width never moves.
 */
export function ShareButton({
  title,
  url,
}: {
  title: string
  url: () => string
}) {
  const [copied, setCopied] = useState(false)
  const [said, setSaid] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )
  const press = () => {
    const link = url()
    void shareOrCopy(title, link).then((showCopied) => {
      if (!showCopied) return
      setCopied(true)
      setSaid(`Link copied: ${link}`)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        setCopied(false)
      }, COPIED_MS)
    })
  }
  return (
    <>
      <button
        type="button"
        className="site-share"
        data-testid="site-share"
        data-copied={copied ? '' : undefined}
        onClick={press}
      >
        <span
          className="site-share-label"
          data-hidden={copied ? '' : undefined}
        >
          <Icon name="share" />
          Share
        </span>
        <span
          className="site-share-label"
          data-hidden={copied ? undefined : ''}
        >
          <Icon name="check" />
          Link copied
        </span>
      </button>
      <span
        className="site-sr-only"
        role="status"
        data-testid="site-share-status"
      >
        {said}
      </span>
    </>
  )
}

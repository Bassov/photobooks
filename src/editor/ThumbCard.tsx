import type { ReactNode } from 'react'
import { thumbCardStyle } from './spreadsPanelModel'

/** Kit list card box (uikit/src/sandbox/chrome.tsx:309): `ratio` paper centred in a ≥1.6:1 box. */
export function ThumbCard({
  ratio,
  children,
}: {
  ratio: number
  children: ReactNode
}) {
  const style = thumbCardStyle(ratio)
  return (
    <div
      className="grid w-full place-items-center"
      data-thumb-card=""
      style={style.box}
    >
      <div className="relative" data-thumb-paper="" style={style.inner}>
        {children}
      </div>
    </div>
  )
}

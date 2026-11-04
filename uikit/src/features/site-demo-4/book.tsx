/* Demo 4 parts (Spec site-awards-v2 §4): the flat top-down book, the cover with the stacked page-block edge. */
import * as React from "react"
import { CoverFace } from "../site-demo-1/art"
import { thick } from "../site-demo-1/book3d"
import type { SiteBook } from "../site-demo-1/data"

/** the page-block edge: round(.45·T) layers (k·.55, k) in two papers, then one in the cloth */
export const edgeOf = (b: SiteBook, s: number) => {
  const d = Math.round(thick(b, s) * 0.45), e: string[] = []
  for (let k = 1; k <= d; k++) e.push(`${(k * 0.55).toFixed(2)}px ${k}px 0 ${k % 2 ? "#F6F2EA" : "#DCD4C6"}`)
  e.push(`${(d * 0.55 + 0.6).toFixed(2)}px ${d + 1}px 0 ${b.spine}`)
  return e.join(", ")
}

/** The flat book face: the cover with the edge and the rest / lifted shadow (`.sv4-pose`, CSS). */
export function FlatBook({ b, s }: { b: SiteBook; s: number }) {
  const W = b.w * s, H = b.h * s
  return (
    <span className="sv4-pose" style={{ "--edge": edgeOf(b, s) } as React.CSSProperties}>
      <span className="sv4-face"><CoverFace b={b} w={W} h={H} /></span>
    </span>
  )
}

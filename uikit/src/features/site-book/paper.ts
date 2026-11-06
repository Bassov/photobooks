/* Photo-paper texture (Spec site-stand S3): a fine grain and a top-left sheen over every page face, leaf face, paper-leaf
   strip and the Book3D page block, above the page content (the photo is printed on the paper). Never on covers. */
import type * as React from "react"

export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"
export const SHEEN = "linear-gradient(100deg, rgb(255 255 255/.08), rgb(255 255 255/0) 40%)"

const LAYER: React.CSSProperties = { position: "absolute", top: 0, bottom: 0, pointerEvents: "none" }

/** The two paper layers for a face whose page starts `x` px left of the face box and is `w` px wide (a paper-leaf strip
   shows a slice of its page; the grain tiles and the sheen stay continuous across the strips). */
export function paperLayers(x = 0, w?: number): [React.CSSProperties, React.CSSProperties] {
  const box = w === undefined ? { left: 0, right: 0 } : { left: x, width: w }
  return [
    { ...LAYER, ...box, backgroundImage: GRAIN, backgroundSize: "160px", mixBlendMode: "multiply", opacity: 0.06 },
    { ...LAYER, ...box, background: SHEEN },
  ]
}

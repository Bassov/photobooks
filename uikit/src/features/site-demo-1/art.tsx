/* Book art shared by the shelf, the reader and the thumbs: the cover face (copied from library BookObject) and a spread
   drawn from the kit layout templates (copied from site-photographer SiteSpread). */
import * as React from "react"
import { T, type Box } from "@/data"
import { AUTHOR, src, SPREAD_R, type SiteBook } from "./data"

/** the single last page (left): t-margin mirrored */
const LAST: Box = { x: 4, y: 14, w: 42, h: 72 }
const HINGE = "linear-gradient(90deg, rgb(0 0 0/.30), rgb(0 0 0/.06) 45%, rgb(255 255 255/.26) 70%, rgb(0 0 0/.05))"
export const FOLD = "linear-gradient(90deg, transparent, rgba(0,0,0,.06) 50%, transparent)"
export const ENDPAPER = "#E9E4DA"

/** The front of a book: full-bleed photo, hinge shading, Lora italic title at 9 % from the top or bottom. */
export function CoverFace({ b, w, h }: { b: SiteBook; w: number; h: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-cover bg-center" style={{ backgroundImage: `url(${src(b.cover)})`, backgroundColor: b.spine }}>
      <div className="absolute inset-y-0 left-0" style={{ width: Math.max(8, h / 30), background: HINGE }} />
      <div className="sd-it absolute inset-x-0 text-center leading-none" style={{ padding: "0 8%", color: b.ink, letterSpacing: "-0.02em", fontSize: Math.round(Math.min(w, h) * 0.14), [b.place ?? "top"]: "9%" } as React.CSSProperties}>{b.title}</div>
    </div>
  )
}

/** Spread k (1…) at width w: white paper with the template frames and the spine fold (M73); the last one is a single left page. */
export function SpreadArt({ b, k, w, shadow, fold = true }: { b: SiteBook; k: number; w: number; shadow?: string; fold?: boolean }) {
  const s = b.spreads[k - 1]
  const h = w / SPREAD_R[b.fmt]
  const pw = w / 2
  const last = s.template === "last"
  const frames = last ? [LAST] : T(s.template).frames
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: last ? pw : w, background: "var(--site-paper)", boxShadow: shadow }}>
        {frames.map((f, i) => s.photos[i] ? <div key={i} className="absolute bg-cover bg-center" style={{ left: (f.x * w) / 100, top: (f.y * h) / 100, width: (f.w * w) / 100, height: (f.h * h) / 100, backgroundImage: `url(${src(s.photos[i])})` }} /> : null)}
      </div>
      {fold && !last && <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: pw - w * 0.015, width: w * 0.03, background: FOLD }} />}
    </div>
  )
}

/** Page 1: a white title page. */
export function TitlePage({ b, h }: { b: SiteBook; h: number }) {
  return (
    <div className="absolute inset-0 grid place-content-center text-center" style={{ background: "var(--site-paper)" }}>
      <div className="sd-it leading-none" style={{ fontSize: Math.round(h * 0.055), color: "var(--site-ink)", letterSpacing: "-0.02em" }}>{b.title}</div>
      <div className="leading-none" style={{ marginTop: Math.round(h * 0.025), fontSize: Math.max(12, Math.round(h * 0.018)), letterSpacing: ".2em", color: "var(--site-muted)" }}>{AUTHOR.toUpperCase()} · {b.year}</div>
    </div>
  )
}

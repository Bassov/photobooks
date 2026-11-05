/* Site / book preview viewer — extracted so parts/demo can import without parts↔m5m7 cycle */
import * as React from "react"
import { ChevronLeft, ChevronRight, X, Maximize2, Share2, ArrowLeft, Check, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStudio } from "@/sandbox/store"
import { SW, SH } from "@/sandbox/model"
import { MiniSpread } from "@/sandbox/chrome"
import { pagesOf, CoverSpread, coverW } from "@/sandbox/v7"
import { P } from "@/data"
import { BOOKS } from "./screens"
import { BookObject, LibStyle } from "./library"
import { type Zoom, Z1, ZOOM_STEP, ZOOM_TOGGLE, clampPan, fitArea, fitBox, fitInsets, settle, wheelFactor, zoomAt } from "./lightbox-zoom"

const serif = { fontFamily: "var(--site-heading)" } as const
/* ---------------------------------------------------------------- site viewer (v8: library style — book object, title + author, page nav, fullscreen, share)
   Designer site-viewer (2026-11-04): slides = cover + every spread, constant stage, width-locked Share, root-width layout; colours from the `.site` tokens (index.css) */
const AUTHOR = "Aleksandr Basov"
const focus = "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[color:var(--site-focus)]"
const control = `bg-[color:var(--site-control)] text-[color:var(--site-text)] transition-[background-color] duration-[120ms] enabled:hover:bg-[color:var(--site-control-hover)] disabled:opacity-40 focus-visible:outline-offset-2 ${focus} [&_svg]:size-4`
const quietBtn = `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm ${control}`
const quietIcon = `grid size-9 place-items-center rounded-full ${control}`
const cell = "inline-flex items-center justify-center gap-1.5 [grid-area:1/1]"
const slugOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
export const spreadLabel = (i: number, n: number) => (i === 0 ? "Cover" : i === n - 1 && n > 2 ? `Page ${i * 2}` : `Pages ${i * 2}–${i * 2 + 1}`)
/** Pager text for slide `s` of a book with `n` spreads (slide 0 = cover, slide s = doc spread s − 1): the page label + spread counter of prod Preview. */
export const slideLabel = (s: number, n: number) => {
  if (s === 0) return "Cover"
  const i = s - 1
  return `${i === 0 ? "Page 1" : i === n - 1 ? `Page ${i * 2}` : `Pages ${i * 2}–${i * 2 + 1}`} · ${s} / ${n}`
}
/** Site page count (Designer site-viewer review): the last page number, 2(n − 1) — the first and last spreads show one page each. */
const sitePages = (n: number) => 2 * (n - 1)
const RATIO = { portrait: 4 / 5, landscape: 5 / 4, square: 1 } as const
/** Root-width layout (spec §3–§4): narrow < 768; catalog columns by content width; stage width clamps to the content and the height left for it.
    `R` = spread width / height (SW / SH are live: setGeom changes them per book, so read them at render). */
export const siteLayout = (W: number, H: number, R: number) => {
  const narrow = W < 768, pad = narrow ? 20 : 32, gapX = narrow ? 20 : 32
  const content = Math.min(1100, W) - 2 * pad
  const cols = content >= 940 ? 4 : content >= 680 ? 3 : 2
  // header + top pad + title block + stage margin + pager margin + pager + bottom pad
  const availH = H - (narrow ? 56 + 8 + 138.85 + 20 + 16 + 36 + 20 : 64 + 16 + 94.85 + 32 + 24 + 36 + 32)
  const stage = Math.min(W - 2 * pad, Math.max(280, Math.min(760, availH * R)))
  return { narrow, pad, cols, gapX, gapY: narrow ? 32 : 40, col: (content - gapX * (cols - 1)) / cols, row: Math.min(960, W - 2 * pad), stage }
}
export type SiteState = { page: "catalog" | "book"; book: string; slide: number; lb: boolean; lbZoom?: number }
export function SiteViewer({ title = "Aleksandr’s photobooks", author = AUTHOR, books = BOOKS.filter((b, i) => i < 4 || b.status === "published"), onClose, initial, single, cover, onBookSelect, onCatalog }: { title?: string; author?: string; books?: typeof BOOKS; onClose?: () => void; initial?: Partial<SiteState>; single?: boolean; cover?: (w: number) => React.ReactNode; onBookSelect?: (id: string) => void; onCatalog?: () => void }) {
  const st = useStudio()
  const [s, setS] = React.useState<SiteState>({ page: single ? "book" : "catalog", book: books[0]?.id ?? "b1", slide: 0, lb: false, ...initial })
  const [copied, setCopied] = React.useState(false)
  const [said, setSaid] = React.useState("")
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  const root = React.useRef<HTMLDivElement>(null)
  const [box, setBox] = React.useState({ w: 1440, h: 856 })
  React.useLayoutEffect(() => { const el = root.current; if (!el) return; const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r(); const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect() }, [])
  const R = SW / SH
  const l = siteLayout(box.w, box.h, R)
  const sp = st.doc.spreads
  const n = sp.length
  const to = (i: number) => setS((x) => ({ ...x, slide: Math.max(0, Math.min(n, i)) }))
  const go = (d: number) => setS((x) => ({ ...x, slide: Math.max(0, Math.min(n, x.slide + d)) }))
  React.useEffect(() => {
    if (s.page !== "book" || s.lb) return
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t?.closest?.("input,textarea")) return
      if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1)
      if (e.key === "Home") { e.preventDefault(); to(0) } if (e.key === "End") { e.preventDefault(); to(n) }
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  })
  // v0.8.1 (P1-2): resolve from the books passed in (the user's own book in #/demo), then the sample catalog
  const book = books.find((b) => b.id === s.book) ?? BOOKS.find((b) => b.id === s.book) ?? books[0] ?? BOOKS[0]
  const fsBtn = React.useRef<HTMLButtonElement>(null)
  // the cover is wider than a spread for most trims: fit it inside the w × w / R stage (never taller)
  const cvW = coverW(st.book, pagesOf(st.doc.spreads.length)), coverR = cvW / st.book.h
  const coverFit = (w: number) => Math.min(w, (w / R) * coverR)
  // own: `w` is already the slide's own width (the lightbox fits the cover at coverR)
  const page = (i: number, w: number, own = false) => {
    // the last spread shows its left page only (mirror of MiniSpread's si === 0 clip)
    if (i > 0) return i === n && n > 1 ? <div style={{ clipPath: "inset(0 50% 0 0)" }}><MiniSpread s={sp[i - 1]} width={w} si={i - 1} /></div> : <MiniSpread s={sp[i - 1]} width={w} si={i - 1} />
    const cw = own ? w : coverFit(w)
    return <div className="mx-auto" style={{ width: cw }}>{cover ? cover(cw) : <div style={{ width: cw, height: (cw * st.book.h) / cvW }} data-testid="site-cover"><CoverSpread /></div>}</div>
  }
  // page shadow over the visible page(s) only: spread 0 shows its right page, the last spread its left page (lightbox: stage-dark)
  const shaded = (i: number, w: number, dark: boolean) => <>
    {page(i, w, dark)}
    <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 rounded-2xs", dark && "shadow-stage-dark")} style={{ left: i === 1 ? "50%" : 0, right: i === n && n > 1 ? "50%" : 0, boxShadow: dark ? undefined : "var(--site-page-shadow)" }} />
  </>
  const link = `https://aleksandr.photos/${slugOf(book.title)}`
  const share = () => {
    try { void navigator.clipboard?.writeText(link).catch(() => {}) } catch { /* file:// */ }
    setCopied(true); setSaid(`Link copied: ${link}`)
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), 2000)
  }
  const toCatalog = () => { setS((x) => ({ ...x, page: "catalog" })); onCatalog?.() }
  return (
    <div ref={root} className="site relative flex h-full flex-col overflow-auto" data-narrow={l.narrow || undefined} data-testid="site">
      <LibStyle />
      <header className={cn("flex shrink-0 items-center gap-4", l.narrow ? "h-14 px-5" : "h-16 px-8")}>
        {single || s.page === "catalog" ? <span className="inline-flex h-10 items-center text-xl" style={serif} aria-current={s.page === "catalog" ? "page" : undefined}>{title}</span> : <button type="button" onClick={toCatalog} className={cn("inline-flex h-10 items-center text-xl focus-visible:outline-offset-2", focus)} style={serif} data-testid="site-title-link">{title}</button>}
        <div className="ml-auto flex items-center gap-2">
          {onClose && <Button size="sm" variant="outline" className="gap-1.5 text-sm [&_svg]:size-4" onPress={onClose} data-testid="close-preview"><X />Close preview</Button>}
        </div>
      </header>
      {s.page === "catalog" ? (
        <main className={cn("mx-auto w-full max-w-[1100px]", l.narrow ? "px-5 py-6" : "px-8 py-8")} data-testid="site-catalog">
          <h1 className="site-h1" style={serif}>Books</h1>
          <p className="mt-1 text-base text-[color:var(--site-muted)]">{author} · {books.length} photobook{books.length === 1 ? "" : "s"}</p>
          <div className={cn("grid items-end", l.narrow ? "mt-6" : "mt-8")} style={{ gridTemplateColumns: `repeat(${l.cols}, ${l.col}px)`, columnGap: l.gapX, rowGap: l.gapY }}>
            {books.map((b) => (
              <button key={b.id} type="button" onClick={() => { setS({ page: "book", book: b.id, slide: 0, lb: false }); onBookSelect?.(b.id) }} className={cn("site-card group flex min-w-0 cursor-pointer flex-col items-center gap-3 rounded-md text-left focus-visible:outline-offset-4", focus)} data-testid="site-book" data-book={b.id}>
                <div className="site-card-obj"><BookObject src={b.cover ? P(b.cover)?.src : undefined} title={b.title} fmt={b.format ?? "portrait"} h={Math.min(200, l.col / RATIO[b.format ?? "portrait"])} /></div>
                <div className="w-full"><div className="truncate text-base font-medium">{b.title}</div><div className="mt-0.5 text-xs tabular-nums text-[color:var(--site-muted)]">{sitePages(b.spreads)} pages</div></div>
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main className={cn("flex flex-1 flex-col items-center", l.narrow ? "px-5 pb-5 pt-2" : "px-8 pb-8 pt-4")} data-testid="site-book-page">
          <div className={cn("flex", l.narrow ? "flex-col items-start" : "items-end gap-4")} style={{ width: l.row }}>
            <div className="min-w-0">
              {!single && <button type="button" onClick={toCatalog} className={cn("-ml-1 mb-1 inline-flex h-8 items-center gap-1 rounded-full px-1 text-sm text-[color:var(--site-muted)] hover:text-[color:var(--site-text)]", focus)} data-testid="site-all-books"><ArrowLeft className="size-4" />All books</button>}
              <h1 className="site-h1" style={serif} data-testid="site-title">{book.title}</h1>
              <div className="text-sm text-[color:var(--site-muted)]" data-testid="site-author">by {author} · {sitePages(n)} pages</div>
            </div>
            <div className={cn("flex items-center gap-2", l.narrow ? "mt-3" : "ml-auto")}>
              <button type="button" className={cn(quietBtn, "inline-grid")} onClick={share} data-testid="site-share">
                <span className={cn(cell, copied && "invisible")}><Share2 />Share</span>
                <span className={cn(cell, !copied && "invisible")}><Check />Link copied</span>
              </button>
              <button type="button" className={quietBtn} ref={fsBtn} onClick={() => setS((x) => ({ ...x, lb: true }))} data-testid="site-fullscreen-btn"><Maximize2 />Fullscreen</button>
            </div>
            <span className="sr-only" role="status" data-testid="site-share-status">{said}</span>
          </div>
          <div className={cn("grid shrink-0 place-items-center", l.narrow ? "mt-5" : "mt-8")} style={{ width: l.stage, height: l.stage / R }} data-testid="site-stage">
            <button type="button" onClick={() => setS((x) => ({ ...x, lb: true }))} className={cn("relative block cursor-zoom-in rounded-2xs focus-visible:outline-offset-4", focus)} aria-label="Open fullscreen" data-testid="site-spread">
              {shaded(s.slide, l.stage, false)}
            </button>
          </div>
          <div className={cn("flex items-center gap-3", l.narrow ? "mt-4" : "mt-6")} data-testid="site-pager">
            <button type="button" aria-label="Previous spread" disabled={s.slide === 0} onClick={() => go(-1)} className={quietIcon}><ChevronLeft /></button>
            <span className="w-44 shrink-0 text-center text-sm tabular-nums text-[color:var(--site-muted)]" aria-live="polite" data-testid="site-page-indicator">{slideLabel(s.slide, n)}</span>
            <button type="button" aria-label="Next spread" disabled={s.slide === n} onClick={() => go(1)} className={quietIcon}><ChevronRight /></button>
          </div>
        </main>
      )}
      {s.lb && <Fullscreen i={s.slide} n={n + 1} title={book.title} onGo={go} ratioOf={(i) => (i === 0 ? coverR : R)} render={(i, w) => <div className="relative">{shaded(i, w, true)}</div>} label={(i) => slideLabel(i, n)} initialZoom={s.lbZoom} onClose={() => { setS((x) => ({ ...x, lb: false })); requestAnimationFrame(() => fsBtn.current?.focus()) /* v0.8.1 (P2-2) */ }} />}
    </div>
  )
}
/* Fullscreen = the site lightbox (Designer site-lightbox §2–§3): the presentation pager look; each slide fits the viewport minus
   64 top / 48 bottom / 64 sides (8 on touch); neighbours i ± 1 stay mounted for a 200 ms slide; zoom 1–3× by transform only.
   `ratio` = spread width / height (default: the editor spread); `ratioOf(i)` = slide i's own ratio when slides differ (the cover);
   `label` = indicator text (default: page / page count). */
const HOVER_Q = "(hover: hover) and (pointer: fine)"
const hoverNow = () => window.matchMedia?.(HOVER_Q).matches ?? true
function useHover() {
  const [h, setH] = React.useState(hoverNow)
  React.useEffect(() => { const m = window.matchMedia?.(HOVER_Q); if (!m) return; const f = () => setH(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f) }, [])
  return h
}
type Pt = { x: number; y: number }
type Gesture = { kind: "swipe"; p0: Pt } | { kind: "pan"; p0: Pt; z0: Zoom } | { kind: "pinch"; d0: number; m0: Pt; z0: Zoom }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const chip = "absolute grid cursor-pointer place-items-center rounded-full border-0 bg-white/10 text-white outline-hidden transition-[background-color] duration-[120ms] hover:bg-white/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const stopDown = (e: React.PointerEvent) => e.stopPropagation()
export function Fullscreen({ i, n, title, onGo, onClose, render, ratio = SW / SH, ratioOf = () => ratio, label = (i, n) => `${spreadLabel(i, n)} · ${i === 0 ? 1 : i * 2} / ${pagesOf(n)}`, initialZoom = 1 }: { i: number; n: number; title: string; onGo: (d: number) => void; onClose: () => void; render: (i: number, w: number) => React.ReactNode; ratio?: number; ratioOf?: (i: number) => number; label?: (i: number, n: number) => string; initialZoom?: number }) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const [vp, setVp] = React.useState({ w: window.innerWidth, h: window.innerHeight })
  const hover = useHover()
  const insets = fitInsets(hover)
  const area = fitArea(vp, insets)
  // each slide fits the area at its own ratio (spec §2); zoom / pan limits follow that slide's box
  const boxOf = (k: number) => fitBox({ w: ratioOf(k), h: 1 }, vp, insets)
  const box = boxOf(i)
  // zoom per slide index: a step keeps only the old slide's entry, so it slides away at its zoom and the new one opens at 1
  const [zooms, setZooms] = React.useState<Record<number, Zoom>>({})
  const [at, setAt] = React.useState(i)
  if (at !== i) { setAt(i); setZooms((zs) => (zs[at] ? { [at]: zs[at] } : {})) }
  const zoomOf = (k: number) => clampPan(zooms[k] ?? Z1, boxOf(k), area)
  const zoom = zoomOf(i)
  const [anim, setAnim] = React.useState(false) // discrete change: 200 ms transform transition
  const [live, setLive] = React.useState(false) // will-change while input runs, dropped 150 ms after it
  const [drag, setDrag] = React.useState(false)
  const cur = React.useRef({ i, n, box, area, zoom, onGo, onClose })
  React.useLayoutEffect(() => { cur.current = { i, n, box, area, zoom, onGo, onClose } })
  const liveT = React.useRef<number | undefined>(undefined)
  const wheelEnd = React.useRef<number | undefined>(undefined)
  const update = React.useCallback((f: (z: Zoom) => Zoom, discrete: boolean) => {
    const { i: ci, box: b, area: a } = cur.current
    setZooms((zs) => ({ ...zs, [ci]: clampPan(f(clampPan(zs[ci] ?? Z1, b, a)), b, a) }))
    setAnim(discrete); setLive(true)
    window.clearTimeout(liveT.current)
    liveT.current = window.setTimeout(() => { setLive(false); setAnim(false) }, discrete ? 350 : 150)
  }, [])
  const settleNow = React.useCallback(() => update((z) => settle(z), false), [update])
  const toggleAt = React.useCallback((p: Pt) => update((z) => (z.z > 1 ? Z1 : zoomAt(z, ZOOM_TOGGLE / z.z, p.x, p.y, cur.current.box, cur.current.area)), true), [update])
  const zoomBy = React.useCallback((f: number) => { const a = cur.current.area; update((z) => zoomAt(z, f, a.x + a.w / 2, a.y + a.h / 2, cur.current.box, a), true) }, [update])
  React.useEffect(() => () => window.clearTimeout(liveT.current), [])
  /** Client → dialog-local px (a kit frame may scale the dialog). */
  const local = (cx: number, cy: number) => { const el = boxRef.current!, r = el.getBoundingClientRect(), s = el.clientWidth / (r.width || 1); return { x: (cx - r.left) * s, y: (cy - r.top) * s } }
  // measure the dialog itself (fixed inset-0) so the book fits whatever box it fills — the window, or a transformed kit frame; focus the dialog, not the X
  React.useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return
    el.focus({ preventScroll: true })
    const v = { w: el.clientWidth, h: el.clientHeight }; setVp(v)
    if (initialZoom > 1) { const ins = fitInsets(hoverNow()), a = fitArea(v, ins); setZooms({ [i]: zoomAt(Z1, initialZoom, a.x + a.w / 2, a.y + a.h / 2, fitBox({ w: ratioOf(i), h: 1 }, v, ins), a) }) }
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect()
  }, []) // mount only
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const c = cur.current, el = boxRef.current
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); c.onClose(); return }
      if (e.key === "Tab" && el) {
        const fs = [...el.querySelectorAll<HTMLButtonElement>("[data-lb-control]")].filter((b) => getComputedStyle(b).visibility !== "hidden")
        if (!fs.length) return
        e.preventDefault()
        const at = fs.indexOf(document.activeElement as HTMLButtonElement)
        fs[at < 0 ? (e.shiftKey ? fs.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const space = e.key === " " && !(e.target as HTMLElement)?.closest?.("button")
      const d = e.key === "ArrowRight" || space ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -c.i : e.key === "End" ? c.n - 1 - c.i : 0
      if (d) { e.preventDefault(); c.onGo(d); return }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(ZOOM_STEP) }
      else if (e.key === "-") { e.preventDefault(); zoomBy(1 / ZOOM_STEP) }
      else if (e.key === "0") { e.preventDefault(); update(() => Z1, true) }
    }
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true)
  }, [update, zoomBy])
  React.useEffect(() => {
    const el = boxRef.current; if (!el) return
    // non-passive: Ctrl + wheel must not zoom the page
    const w = (e: WheelEvent) => {
      e.preventDefault()
      const s = el.clientWidth / (el.getBoundingClientRect().width || 1), line = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) { const r = el.getBoundingClientRect(), px = (e.clientX - r.left) * s, py = (e.clientY - r.top) * s; update((z) => zoomAt(z, wheelFactor(e.deltaY, e.deltaMode), px, py, cur.current.box, cur.current.area), false); window.clearTimeout(wheelEnd.current); wheelEnd.current = window.setTimeout(settleNow, 150) }
      else if (cur.current.zoom.z > 1) update((z) => ({ ...z, x: z.x - e.deltaX * line * s, y: z.y - e.deltaY * line * s }), false)
    }
    el.addEventListener("wheel", w, { passive: false }); return () => { el.removeEventListener("wheel", w); window.clearTimeout(wheelEnd.current) }
  }, [update, settleNow])
  const ptrs = React.useRef(new Map<number, Pt>())
  const g = React.useRef<Gesture | null>(null)
  const lastTap = React.useRef<{ t: number; p: Pt } | null>(null)
  const mouse = React.useRef(true)
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    mouse.current = e.pointerType === "mouse"
    if (e.button !== 0 && e.pointerType === "mouse") return
    const p = local(e.clientX, e.clientY); ptrs.current.set(e.pointerId, p)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    const z = cur.current.zoom
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; g.current = { kind: "pinch", d0: Math.max(1, dist(a, b)), m0: mid(a, b), z0: z }; setDrag(false) }
    else if (ptrs.current.size === 1) { g.current = z.z > 1 ? { kind: "pan", p0: p, z0: z } : { kind: "swipe", p0: p }; setDrag(z.z > 1) }
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return
    const p = local(e.clientX, e.clientY); ptrs.current.set(e.pointerId, p)
    const gg = g.current, { box: b, area: a } = cur.current
    if (gg?.kind === "pan") update(() => ({ ...gg.z0, x: gg.z0.x + p.x - gg.p0.x, y: gg.z0.y + p.y - gg.p0.y }), false)
    else if (gg?.kind === "pinch" && ptrs.current.size >= 2) {
      const [p1, p2] = [...ptrs.current.values()], m = mid(p1, p2)
      update(() => { const z = zoomAt(gg.z0, dist(p1, p2) / gg.d0, gg.m0.x, gg.m0.y, b, a); return { ...z, x: z.x + m.x - gg.m0.x, y: z.y + m.y - gg.m0.y } }, false)
    }
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.delete(e.pointerId)) return
    const gg = g.current, p = local(e.clientX, e.clientY)
    if (gg?.kind === "swipe" && e.type === "pointerup") {
      const dx = p.x - gg.p0.x
      if (Math.abs(dx) > 60) cur.current.onGo(dx < 0 ? 1 : -1)
    }
    // double-tap (touch / pen): 2 taps ≤ 300 ms, ≤ 16 px apart; the mouse uses dblclick
    if (!mouse.current && gg && gg.kind !== "pinch" && e.type === "pointerup" && dist(p, gg.p0) <= 16) {
      const t = e.timeStamp, l = lastTap.current
      if (l && t - l.t <= 300 && dist(p, l.p) <= 16) { lastTap.current = null; toggleAt(p) } else lastTap.current = { t, p }
    }
    const rest = [...ptrs.current.values()]
    if (rest.length === 1 && gg?.kind === "pinch") { g.current = { kind: "pan", p0: rest[0], z0: cur.current.zoom }; return }
    if (rest.length === 0) { g.current = null; setDrag(false); if (gg && gg.kind !== "swipe") settleNow() }
  }
  const ks = [i - 1, i, i + 1].filter((k) => k >= 0 && k < n)
  const cursor = zoom.z > 1 ? (drag ? "grabbing" : "grab") : "default"
  const arrowTop = area.y + area.h / 2 - 20
  return (
    <div ref={boxRef} className="fixed inset-0 z-[60] touch-none select-none overflow-hidden bg-presentation outline-hidden" style={{ cursor }} role="dialog" aria-modal="true" aria-label={`${title} — fullscreen`} tabIndex={-1} data-testid="lightbox" data-zoom={zoom.z.toFixed(2)}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDoubleClick={(e) => { if (mouse.current && !(e.target as HTMLElement).closest("[data-lb-control]")) toggleAt(local(e.clientX, e.clientY)) }}>
      {ks.map((k) => {
        const z = k === i ? zoom : zoomOf(k), b = boxOf(k)
        return (
          <div key={k} inert={k !== i} className="absolute transition-[transform,opacity] duration-[var(--duration-base)] ease-out motion-reduce:transition-none" style={{ left: b.x, top: b.y, width: b.w, height: b.h, transform: `translateX(${(k - i) * 100}%)`, opacity: k === i ? 1 : 0 }} data-slide={k}>
            <div className={cn("size-full origin-top-left", k === i && anim && "transition-transform duration-[var(--duration-base)] ease-out motion-reduce:transition-none")} style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.z})`, willChange: k === i && (live || drag) ? "transform" : undefined }} data-testid={k === i ? "site-fullscreen-layer" : undefined}>
              <div className="grid size-full place-items-center" data-testid={k === i ? "site-fullscreen-book" : undefined}>{render(k, b.w)}</div>
            </div>
          </div>
        )
      })}
      {hover && <>
        <button type="button" data-lb-control aria-label="Previous spread" onPointerDown={stopDown} onClick={() => onGo(-1)} className={cn(chip, "size-10 [&_svg]:size-5")} style={{ left: 12, top: arrowTop, visibility: i === 0 ? "hidden" : undefined }}><ChevronLeft /></button>
        <button type="button" data-lb-control aria-label="Next spread" onPointerDown={stopDown} onClick={() => onGo(1)} className={cn(chip, "size-10 [&_svg]:size-5")} style={{ right: 12, top: arrowTop, visibility: i === n - 1 ? "hidden" : undefined }}><ChevronRight /></button>
      </>}
      <button type="button" data-lb-control aria-label={zoom.z > 1 ? "Zoom out" : "Zoom in"} onPointerDown={stopDown} onClick={() => (zoom.z > 1 ? update(() => Z1, true) : zoomBy(ZOOM_TOGGLE))} className={cn(chip, "size-8 [&_svg]:size-4")} style={{ top: 16, right: 56 }} data-testid="site-fullscreen-zoom">{zoom.z > 1 ? <ZoomOut /> : <ZoomIn />}</button>
      <button type="button" data-lb-control aria-label="Exit fullscreen" title="Close (Esc)" onPointerDown={stopDown} onClick={onClose} className={cn(chip, "size-8 [&_svg]:size-4")} style={{ top: 16, right: 16 }} data-testid="site-fullscreen-close"><X /></button>
      <div className="pointer-events-none absolute inset-x-0 text-center text-xs leading-4 tabular-nums text-white/60" style={{ bottom: 16 }} aria-live="polite" data-testid="site-fullscreen-indicator">{label(i, n)}</div>
    </div>
  )
}

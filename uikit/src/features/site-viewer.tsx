/* Site / book preview viewer — extracted so parts/demo can import without parts↔m5m7 cycle */
import * as React from "react"
import { ChevronLeft, ChevronRight, X, Maximize2, Share2, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStudio } from "@/sandbox/store"
import { SW, SH } from "@/sandbox/model"
import { MiniSpread } from "@/sandbox/chrome"
import { pagesOf, CoverSpread, coverW } from "@/sandbox/v7"
import { P } from "@/data"
import { BOOKS } from "./screens"
import { BookObject, LibStyle } from "./library"

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
export type SiteState = { page: "catalog" | "book"; book: string; slide: number; lb: boolean }
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
  const coverFit = (w: number) => Math.min(w, (w / R) * (coverW(st.book) / st.book.h))
  const page = (i: number, w: number) => {
    // the last spread shows its left page only (mirror of MiniSpread's si === 0 clip)
    if (i > 0) return i === n && n > 1 ? <div style={{ clipPath: "inset(0 50% 0 0)" }}><MiniSpread s={sp[i - 1]} width={w} si={i - 1} /></div> : <MiniSpread s={sp[i - 1]} width={w} si={i - 1} />
    const cw = coverFit(w)
    return <div className="mx-auto" style={{ width: cw }}>{cover ? cover(cw) : <div style={{ width: cw, height: (cw * st.book.h) / coverW(st.book) }} data-testid="site-cover"><CoverSpread /></div>}</div>
  }
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
              {page(s.slide, l.stage)}
              {/* page shadow over the visible page(s) only: spread 0 shows its right page, the last spread its left page */}
              <span aria-hidden className="pointer-events-none absolute inset-y-0 rounded-2xs" style={{ left: s.slide === 1 ? "50%" : 0, right: s.slide === n && n > 1 ? "50%" : 0, boxShadow: "var(--site-page-shadow)" }} />
            </button>
          </div>
          <div className={cn("flex items-center gap-3", l.narrow ? "mt-4" : "mt-6")} data-testid="site-pager">
            <button type="button" aria-label="Previous spread" disabled={s.slide === 0} onClick={() => go(-1)} className={quietIcon}><ChevronLeft /></button>
            <span className="w-44 shrink-0 text-center text-sm tabular-nums text-[color:var(--site-muted)]" aria-live="polite" data-testid="site-page-indicator">{slideLabel(s.slide, n)}</span>
            <button type="button" aria-label="Next spread" disabled={s.slide === n} onClick={() => go(1)} className={quietIcon}><ChevronRight /></button>
          </div>
        </main>
      )}
      {s.lb && <Fullscreen i={s.slide} n={n + 1} title={book.title} onGo={go} render={page} label={(i) => slideLabel(i, n)} onClose={() => { setS((x) => ({ ...x, lb: false })); requestAnimationFrame(() => fsBtn.current?.focus()) /* v0.8.1 (P2-2) */ }} />}
    </div>
  )
}
/* Fullscreen: the spread fits the viewport with 32px padding; quiet arrows at the sides, page indicator at the bottom.
   `ratio` = spread width / height (default: the editor spread); `label` = indicator text (default: page / page count). */
export function Fullscreen({ i, n, title, onGo, onClose, render, ratio = SW / SH, label = (i, n) => `${spreadLabel(i, n)} · ${i === 0 ? 1 : i * 2} / ${pagesOf(n)}` }: { i: number; n: number; title: string; onGo: (d: number) => void; onClose: () => void; render: (i: number, w: number) => React.ReactNode; ratio?: number; label?: (i: number, n: number) => string }) {
  const [vp, setVp] = React.useState({ w: window.innerWidth, h: window.innerHeight })
  const t0 = React.useRef<number | null>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const boxRef = React.useRef<HTMLDivElement>(null)
  // measure the dialog itself (fixed inset-0) so the book fits whatever box it fills — the window, or a transformed kit frame
  React.useEffect(() => { const el = boxRef.current; closeRef.current?.focus(); if (!el) return; const r = () => setVp({ w: el.clientWidth, h: el.clientHeight }); r(); const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect() }, [])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") { e.preventDefault(); onGo(1) } if (e.key === "ArrowLeft") { e.preventDefault(); onGo(-1) } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose() } }
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true)
  }, [onGo, onClose])
  const PAD = 32
  const w = Math.max(100, Math.min(vp.w - PAD * 2, (vp.h - PAD * 2) * ratio))
  const arrow = "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white opacity-60 outline-hidden transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0 [&_svg]:size-5"
  return (
    <div ref={boxRef} className="fixed inset-0 z-50 grid place-items-center" style={{ background: "#1F1E1E" }} role="dialog" aria-modal="true" aria-label={`${title} — fullscreen`} data-testid="lightbox"
      onPointerDown={(e) => { t0.current = e.clientX }} onPointerUp={(e) => { if (t0.current !== null && Math.abs(e.clientX - t0.current) > 60) onGo(e.clientX < t0.current ? 1 : -1); t0.current = null }}>
      <div data-testid="site-fullscreen-book" style={{ width: w }}>{render(i, w)}</div>
      <button type="button" aria-label="Previous spread" onClick={() => onGo(-1)} disabled={i === 0} className={arrow} style={{ left: PAD + 8 }}><ChevronLeft /></button>
      <button type="button" aria-label="Next spread" onClick={() => onGo(1)} disabled={i === n - 1} className={arrow} style={{ right: PAD + 8 }}><ChevronRight /></button>
      <div className="absolute inset-x-0 text-center text-xs tabular-nums text-white/80" style={{ bottom: 8 }} data-testid="site-fullscreen-indicator">{label(i, n)}</div>
      <button ref={closeRef} type="button" aria-label="Exit fullscreen" onClick={onClose} className="absolute grid size-9 place-items-center rounded-full bg-black/25 text-white/80 outline-hidden hover:text-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white [&_svg]:size-4" style={{ right: 8, top: 8 }} data-testid="site-fullscreen-close"><X /></button>
    </div>
  )
}

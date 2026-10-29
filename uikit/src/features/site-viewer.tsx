/* Site / book preview viewer — extracted so parts/demo can import without parts↔m5m7 cycle */
import * as React from "react"
import { ChevronLeft, ChevronRight, X, Maximize2, Share2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStudio } from "@/sandbox/store"
import { SW, SH } from "@/sandbox/model"
import { MiniSpread } from "@/sandbox/chrome"
import { pagesOf } from "@/sandbox/v7"
import { P } from "@/data"
import { BOOKS } from "./screens"
import { BookObject, LibStyle } from "./library"

const serif = { fontFamily: "var(--font-heading)" } as const
/* ---------------------------------------------------------------- site viewer (v8: library style — book object, title + author, page nav, fullscreen, share) */
const AUTHOR = "Aleksandr Basov"
const quietBtn = "inline-flex h-9 items-center gap-1.5 rounded-full bg-field px-3.5 text-sm text-foreground outline-hidden transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152] [&_svg]:size-4"
const quietIcon = "grid size-9 place-items-center rounded-full bg-field text-foreground outline-hidden transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152] [&_svg]:size-4"
const slugOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
export const spreadLabel = (i: number, n: number) => (i === 0 ? "Cover" : i === n - 1 && n > 2 ? `Page ${i * 2}` : `Pages ${i * 2}–${i * 2 + 1}`)
export type SiteState = { page: "catalog" | "book"; book: string; spread: number; lb: boolean }
export function SiteViewer({ title = "Aleksandr’s photobooks", author = AUTHOR, books = BOOKS.filter((b, i) => i < 4 || b.status === "published"), onClose, initial, single, cover, onBookSelect, onCatalog }: { title?: string; author?: string; books?: typeof BOOKS; onClose?: () => void; initial?: Partial<SiteState>; single?: boolean; cover?: (w: number) => React.ReactNode; onBookSelect?: (id: string) => void; onCatalog?: () => void }) {
  const st = useStudio()
  const [s, setS] = React.useState<SiteState>({ page: single ? "book" : "catalog", book: books[0]?.id ?? "b1", spread: 0, lb: false, ...initial })
  const [shared, setShared] = React.useState(false)
  const sp = st.doc.spreads
  const go = (d: number) => setS((x) => ({ ...x, spread: Math.max(0, Math.min(sp.length - 1, x.spread + d)) }))
  React.useEffect(() => {
    if (s.page !== "book" || s.lb) return
    const k = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t?.closest?.("input,textarea")) return; if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1) }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  })
  // v0.8.1 (P1-2): resolve from the books passed in (the user's own book in #/demo), then the sample catalog
  const book = books.find((b) => b.id === s.book) ?? BOOKS.find((b) => b.id === s.book) ?? books[0] ?? BOOKS[0]
  const fsBtn = React.useRef<HTMLButtonElement>(null)
  const page = (i: number, w: number) => (i === 0 && cover ? cover(w) : <MiniSpread s={sp[i]} width={w} si={i} />)
  const link = `https://aleksandr.photos/${slugOf(book.title)}`
  const share = () => { try { void navigator.clipboard?.writeText(link).catch(() => {}) } catch { /* file:// */ } setShared(true) }
  return (
    <div className="relative flex h-full flex-col overflow-auto bg-background text-foreground" data-testid="site">
      <LibStyle />
      <header className="flex h-16 shrink-0 items-center gap-4 px-8">
        {single || s.page === "catalog" ? <span className="inline-flex h-10 items-center text-xl" style={serif} aria-current={s.page === "catalog" ? "page" : undefined}>{title}</span> : <button type="button" onClick={() => { setS((x) => ({ ...x, page: "catalog" })); onCatalog?.() }} className="inline-flex h-10 items-center text-xl outline-hidden focus-visible:outline-2 focus-visible:outline-[#535152]" style={serif}>{title}</button>}
        <div className="ml-auto flex items-center gap-2">
          {onClose && <Button size="sm" variant="outline" className="gap-1.5 text-sm [&_svg]:size-4" onPress={onClose} data-testid="close-preview"><X />Close preview</Button>}
        </div>
      </header>
      {s.page === "catalog" ? (
        <main className="mx-auto w-full max-w-[1100px] px-8 py-8" data-testid="site-catalog">
          <h1 className="text-3xl leading-tight" style={serif}>Books</h1>
          <p className="mt-1 text-base text-muted-foreground">{author} · {books.length} photobook{books.length === 1 ? "" : "s"}</p>
          <div className="mt-8 grid grid-cols-4 items-end gap-x-8 gap-y-10">
            {books.map((b) => (
              <button key={b.id} type="button" onClick={() => { setS({ page: "book", book: b.id, spread: 0, lb: false }); onBookSelect?.(b.id) }} className="group flex flex-col items-center gap-3 rounded-md text-left outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#535152]" data-testid="site-book" data-book={b.id}>
                <BookObject src={b.cover ? P(b.cover)?.src : undefined} title={b.title} fmt={b.format ?? "portrait"} h={200} />
                <div className="w-full"><div className="truncate text-base font-medium text-foreground">{b.title}</div><div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{pagesOf(b.spreads)} pages</div></div>
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center px-8 pb-8 pt-4" data-testid="site-book-page">
          <div className="flex w-full max-w-[960px] items-end gap-4">
            <div className="min-w-0">
              {!single && <button type="button" onClick={() => { setS((x) => ({ ...x, page: "catalog" })); onCatalog?.() }} className="-ml-1 mb-1 inline-flex h-8 items-center gap-1 rounded-full px-1 text-sm text-muted-foreground outline-hidden hover:text-foreground focus-visible:outline-2 focus-visible:outline-[#535152]" data-testid="site-all-books"><ArrowLeft className="size-4" />All books</button>}
              <h1 className="text-3xl leading-tight" style={serif} data-testid="site-title">{book.title}</h1>
              <div className="text-sm text-muted-foreground" data-testid="site-author">by {author} · {pagesOf(sp.length)} pages</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className={quietBtn} onClick={share} data-testid="site-share"><Share2 />{shared ? "Link copied" : "Share"}</button>
              <button type="button" className={quietBtn} ref={fsBtn} onClick={() => setS((x) => ({ ...x, lb: true }))} data-testid="site-fullscreen-btn"><Maximize2 />Fullscreen</button>
            </div>
          </div>
          {shared && <div className="mt-2 w-full max-w-[960px] text-right text-xs text-muted-foreground" role="status" data-testid="site-share-link">{link}</div>}
          <button type="button" onClick={() => setS((x) => ({ ...x, lb: true }))} className="group relative mt-8 cursor-zoom-in rounded-2xs outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#535152]" aria-label="Open fullscreen" data-testid="site-spread">
            <div className="shadow-float">{page(s.spread, 760)}</div>
          </button>
          <div className="mt-6 flex items-center gap-3" data-testid="site-pager">
            <button type="button" aria-label="Previous spread" disabled={s.spread === 0} onClick={() => go(-1)} className={quietIcon}><ChevronLeft /></button>
            <span className="min-w-36 text-center text-sm tabular-nums text-muted-foreground" data-testid="site-page-indicator">{spreadLabel(s.spread, sp.length)} · {s.spread === 0 ? 1 : s.spread * 2} / {pagesOf(sp.length)}</span>
            <button type="button" aria-label="Next spread" disabled={s.spread === sp.length - 1} onClick={() => go(1)} className={quietIcon}><ChevronRight /></button>
          </div>
        </main>
      )}
      {s.lb && <Fullscreen i={s.spread} n={sp.length} title={book.title} onGo={go} render={page} onClose={() => { setS((x) => ({ ...x, lb: false })); requestAnimationFrame(() => fsBtn.current?.focus()) /* v0.8.1 (P2-2) */ }} />}
    </div>
  )
}
/* Fullscreen: the spread fits the viewport with 32px padding; quiet arrows at the sides, page indicator at the bottom. */
function Fullscreen({ i, n, title, onGo, onClose, render }: { i: number; n: number; title: string; onGo: (d: number) => void; onClose: () => void; render: (i: number, w: number) => React.ReactNode }) {
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
  const w = Math.max(100, Math.min(vp.w - PAD * 2, ((vp.h - PAD * 2) * SW) / SH))
  const arrow = "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white opacity-60 outline-hidden transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0 [&_svg]:size-5"
  return (
    <div ref={boxRef} className="fixed inset-0 z-50 grid place-items-center" style={{ background: "#1F1E1E" }} role="dialog" aria-modal="true" aria-label={`${title} — fullscreen`} data-testid="lightbox"
      onPointerDown={(e) => { t0.current = e.clientX }} onPointerUp={(e) => { if (t0.current !== null && Math.abs(e.clientX - t0.current) > 60) onGo(e.clientX < t0.current ? 1 : -1); t0.current = null }}>
      <div data-testid="site-fullscreen-book" style={{ width: w }}>{render(i, w)}</div>
      <button type="button" aria-label="Previous spread" onClick={() => onGo(-1)} disabled={i === 0} className={arrow} style={{ left: PAD + 8 }}><ChevronLeft /></button>
      <button type="button" aria-label="Next spread" onClick={() => onGo(1)} disabled={i === n - 1} className={arrow} style={{ right: PAD + 8 }}><ChevronRight /></button>
      <div className="absolute inset-x-0 text-center text-xs tabular-nums text-white/80" style={{ bottom: 8 }} data-testid="site-fullscreen-indicator">{spreadLabel(i, n)} · {i === 0 ? 1 : i * 2} / {pagesOf(n)}</div>
      <button ref={closeRef} type="button" aria-label="Exit fullscreen" onClick={onClose} className="absolute grid size-9 place-items-center rounded-full bg-black/25 text-white/80 outline-hidden hover:text-white focus-visible:outline-2 focus-visible:outline-white [&_svg]:size-4" style={{ right: 8, top: 8 }} data-testid="site-fullscreen-close"><X /></button>
    </div>
  )
}

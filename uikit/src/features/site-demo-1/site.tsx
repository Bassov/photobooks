/* Site demo 1 — "the lit table" (Designer Spec site-awards, Items 1 + 2): the photographer site in its own warm theme.
   Home: masthead, a display statement with the latest book standing as an object, books on shelves at their true
   relative size, About and the dark footer. Book page: the closed book on a lit stage that opens and turns its pages,
   About this book, all spreads, Next book; Fullscreen reads the same way. Layout follows the root's own box. Kit only. */
import * as React from "react"
import { flushSync } from "react-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { SpreadArt } from "./art"
import { Book3D } from "./book3d"
import { AUTHOR, BOOKS, EMAIL, italics, pad2, pagesOf, sizeOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "./data"
import { SiteFullscreen } from "./fullscreen"
import { BookReader, type ReaderApi } from "./reader"
import "./site.css"

const RULE = "1px solid var(--site-rule)"
const THUMB_SHADOW = "0 1px 2px rgb(26 25 24/.12), 0 10px 22px -10px rgb(26 25 24/.3)"
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const smooth = (): ScrollBehavior => (reduced() ? "auto" : "smooth")

type L = { W: number; vh: number; narrow: boolean; mid: boolean; m: number; content: number; mast: number }
const layout = (W: number, vh: number): L => {
  const m = W >= 1024 ? 48 : W >= 768 ? 32 : 20
  return { W, vh, narrow: W < 768, mid: W >= 768 && W < 1024, m, content: W - 2 * m, mast: W < 768 ? 64 : 80 }
}
const grid12: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", columnGap: 24 }
const cols = (a: number, b: number): React.CSSProperties => ({ gridColumn: `${a} / ${b + 1}` })
const Rich = ({ s }: { s: string }) => <>{italics(s).map((x, i) => (x.it ? <em key={i}>{x.t}</em> : <React.Fragment key={i}>{x.t}</React.Fragment>))}</>
const meta = (b: SiteBook) => `${b.year} · ${pagesOf(b)} pages · ${sizeOf(b)}`

export function SiteDemo1() {
  const frame = React.useRef<HTMLDivElement>(null)
  const root = React.useRef<HTMLDivElement>(null)
  const [box, setBox] = React.useState({ w: 1440, h: 900 })
  const [page, setPage] = React.useState("home")
  const [scrolled, setScrolled] = React.useState(false)
  React.useLayoutEffect(() => {
    const el = root.current; if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r()
    const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect()
  }, [])
  const pendingScroll = React.useRef<string | null>(null)
  React.useLayoutEffect(() => {
    const el = root.current; if (!el) return
    el.scrollTop = 0
    const id = pendingScroll.current; pendingScroll.current = null
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start", behavior: smooth() })
  }, [page])
  useReveal(root, page)
  const l = layout(box.w, box.h)
  const b = BOOKS.find((x) => x.id === page)
  const home = (id?: string) => { if (page === "home") { if (id) document.getElementById(id)?.scrollIntoView({ block: "start", behavior: smooth() }); else root.current?.scrollTo({ top: 0, behavior: smooth() }) } else { pendingScroll.current = id ?? null; setPage("home") } }
  /** shelf → book: the clicked Book3D morphs into the reader's closed book (View Transitions; instant without) */
  const openBook = (id: string, from?: HTMLElement | null) => {
    const go = () => flushSync(() => setPage(id))
    const book = from?.querySelector<HTMLElement>('[data-testid="book3d"]')
    if (!document.startViewTransition || reduced() || !book) { go(); return }
    book.style.viewTransitionName = "site-book"
    document.startViewTransition(() => { book.style.viewTransitionName = ""; go() })
  }
  return (
    <div ref={frame} className="relative h-full overflow-hidden" data-surface="site" data-allow-border>
      <div ref={root} className="h-full overflow-y-auto overflow-x-hidden" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)} data-testid="ps-site">
        <header className="sd-mast" style={{ height: l.mast, padding: `0 ${l.m}px` }} data-scrolled={scrolled || undefined} data-testid="ps-mast">
          <button type="button" className="sd-name" style={{ fontSize: l.narrow ? 18 : 22 }} onClick={() => home()} data-testid="ps-home-link">{AUTHOR}</button>
          <nav className="ml-auto flex" style={{ gap: l.narrow ? 20 : 32 }}>
            <button type="button" className="sd-nav" aria-current="page" onClick={() => home("sd-books")} data-testid="ps-nav-books">Books</button>
            <button type="button" className="sd-nav" onClick={() => home("sd-about")} data-testid="ps-nav-about">About</button>
            {!l.narrow && <button type="button" className="sd-nav" onClick={() => document.getElementById("sd-contact")?.scrollIntoView({ block: "start", behavior: smooth() })} data-testid="ps-nav-contact">Contact</button>}
          </nav>
        </header>
        <main>
          {b ? <BookPage key={b.id} b={b} l={l} root={root} onBook={openBook} /> : <Home l={l} onBook={openBook} />}
        </main>
        <footer id="sd-contact" className="sd-foot" style={{ padding: `70px ${l.m}px 40px` }} data-testid="ps-foot">
          <div className="sd-label">Contact</div>
          <a href={`mailto:${EMAIL}`} className="sd-email inline-block" style={{ fontSize: l.narrow ? 32 : 72, marginTop: 28 }}>{EMAIL}</a>
          <div className="flex" style={{ marginTop: 120, font: "400 13px/1.4 var(--site-sans)" }}><span>© 2026 {AUTHOR}</span><span className="ml-auto">Made with Photobooks</span></div>
        </footer>
      </div>
      <div className="sd-grain" aria-hidden />
      <Cursor host={frame} />
    </div>
  )
}

/** Shelf rows, About, the spreads index and Next book fade up once they are 15 % in view. */
function useReveal(root: React.RefObject<HTMLDivElement | null>, key: string) {
  React.useEffect(() => {
    const el = root.current; if (!el) return
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("sd-in"); io.unobserve(e.target) } }, { root: el, threshold: 0.15 })
    el.querySelectorAll("[data-reveal]:not(.sd-in)").forEach((x) => io.observe(x))
    return () => io.disconnect()
  }, [root, key])
}

/** "Open" / ← / → label that follows a fine pointer over books and the reader (lerp .2 per frame). */
function Cursor({ host }: { host: React.RefObject<HTMLDivElement | null> }) {
  const dot = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const h = host.current, d = dot.current
    if (!h || !d || !matchMedia("(hover: hover) and (pointer: fine)").matches) return
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, on = false
    const loop = () => {
      x += (tx - x) * 0.2; y += (ty - y) * 0.2
      d.style.translate = `${x}px ${y}px`
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.2 ? requestAnimationFrame(loop) : 0
    }
    const move = (e: PointerEvent) => {
      const r = h.getBoundingClientRect(), k = r.width / h.offsetWidth || 1
      tx = (e.clientX - r.left) / k; ty = (e.clientY - r.top) / k
      const t = (e.target as Element | null)?.closest?.<HTMLElement>("[data-cursor]")
      const label = e.pointerType === "mouse" ? t?.getAttribute("data-cursor") : null
      if (label) {
        if (!on) { x = tx; y = ty }
        on = true; d.dataset.on = ""; d.textContent = label
        const s = t!.matches('[data-testid="ps-reader"]') ? 56 : 76
        d.style.width = d.style.height = `${s}px`; d.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`
        if (t!.closest(".sd-dark")) d.dataset.dark = ""; else delete d.dataset.dark
      } else { on = false; delete d.dataset.on }
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const leave = () => { on = false; delete d.dataset.on }
    h.addEventListener("pointermove", move); h.addEventListener("pointerleave", leave)
    return () => { cancelAnimationFrame(raf); h.removeEventListener("pointermove", move); h.removeEventListener("pointerleave", leave) }
  }, [host])
  return <div ref={dot} className="sd-cursor" aria-hidden data-testid="ps-cursor" />
}

function Home({ l, onBook }: { l: L; onBook: (id: string, from?: HTMLElement | null) => void }) {
  const latest = BOOKS[0]
  const hero = React.useRef<HTMLDivElement>(null)
  const heroBook = React.useRef<HTMLDivElement>(null)
  const display = l.narrow ? 44 : l.W < 1280 ? Math.min(96, Math.max(56, l.W * 0.072)) : 96
  // the hero book follows the pointer: ry 26 ± 6·nx, rx −5 ∓ 4·ny
  const follow = (e: React.PointerEvent) => {
    const el = heroBook.current, h = hero.current; if (!el || !h || reduced()) return
    const r = h.getBoundingClientRect()
    const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)), ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
    el.style.setProperty("--ry", String(26 + 6 * nx)); el.style.setProperty("--rx", String(-5 - 4 * ny))
  }
  const per = l.narrow ? 1 : l.mid ? 2 : 3
  const slotW = (l.content - 24 * (per - 1)) / per
  const s = per === 3 ? Math.min(12, (slotW - 24) / 30) : Math.min(10, (slotW - 24) / 30)
  const rows: SiteBook[][] = []
  for (let i = 0; i < BOOKS.length; i += per) rows.push(BOOKS.slice(i, i + per))
  return (
    <div data-testid="ps-home">
      <section ref={hero} className="relative" style={{ minHeight: l.narrow ? 0 : Math.max(640, l.vh - l.mast), padding: `0 ${l.m}px ${l.narrow ? 72 : 0}px` }} onPointerMove={follow} data-testid="ps-hero">
        <div style={grid12}>
          <div style={{ ...cols(1, l.narrow ? 12 : 7), paddingTop: l.narrow ? 40 : 92 }}>
            <h1 className="sd-display" style={{ fontSize: display, lineHeight: l.narrow ? 1 : 0.98, letterSpacing: l.narrow ? "-0.03em" : "-0.035em" }} data-testid="ps-lead">Lakes, coasts<br /><em>and the people</em><br />I travel with.</h1>
            <p style={{ font: "400 17px/1.6 var(--site-sans)", maxWidth: 430, marginTop: 40 }}>Six photobooks about trips, roads and the people on the way, 2023–2026. Based in Tbilisi.</p>
            <button type="button" className="sd-link" style={{ marginTop: 40 }} onClick={() => document.getElementById("sd-books")?.scrollIntoView({ block: "start", behavior: smooth() })} data-testid="ps-see-books">See the books ↓</button>
          </div>
          {!l.narrow && (
            <div className="flex flex-col items-center" style={{ ...cols(8, 12), paddingTop: 110 }}>
              <button type="button" className="sd-host" aria-label={`Open ${latest.title}`} data-cursor="Open" onClick={(e) => onBook(latest.id, e.currentTarget)} data-testid="ps-hero-book">
                <Book3D ref={heroBook} b={latest} s={15} pose={{ ry: 26, rx: -5 }} />
              </button>
              <div style={{ marginTop: 40 }}><span className="sd-meta">Latest · </span><em style={{ fontSize: 15, color: "var(--site-ink)" }}>{latest.title}</em><span className="sd-meta">, {latest.year}</span></div>
            </div>
          )}
        </div>
        {!l.narrow && (
          <div className="absolute flex items-center" style={{ left: l.m, right: l.m, bottom: 48 }}>
            <div className="sd-label flex items-center" style={{ gap: 12 }}><span style={{ width: 32, height: 1, background: "var(--site-muted)" }} />Scroll</div>
            <div className="sd-label ml-auto">2023 — 2026</div>
          </div>
        )}
      </section>
      <section id="sd-books" style={{ padding: `${l.narrow ? 0 : 32}px ${l.m}px 0`, scrollMarginTop: l.mast }} data-testid="ps-shelf">
        <div className="flex items-end"><h2 className="sd-h2" style={{ fontSize: l.narrow ? 40 : 56 }}>Books</h2><span className="sd-meta ml-auto">{pad2(BOOKS.length)}</span></div>
        <div style={{ height: 1, background: "var(--site-rule)", marginTop: 28, marginBottom: 54 }} />
        {rows.map((row, ri) => {
          const slotH = Math.max(...row.map((x) => x.h * s)) + 50
          return (
            <div key={ri} className="relative grid" style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))`, columnGap: 24, marginTop: ri ? 96 : 0 }} data-testid="ps-shelf-row">
              <div className="sd-shelf-line" style={{ top: slotH }} />
              {row.map((x, j) => (
                <button key={x.id} type="button" className="sd-host flex flex-col" data-reveal style={{ "--d": `${j * 80}ms` } as React.CSSProperties} data-cursor="Open" onClick={(e) => onBook(x.id, e.currentTarget)} data-testid="ps-book" data-book={x.id}>
                  <div className="flex w-full items-end justify-center" style={{ height: slotH }}><Book3D b={x} s={s} /></div>
                  <div style={{ paddingTop: 26 }}>
                    <div className="sd-meta">{pad2(BOOKS.indexOf(x) + 1)}</div>
                    <div className="sd-serif sd-ul" style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 10 }}>{x.title}</div>
                    <div className="sd-meta" style={{ marginTop: 8 }}>{meta(x)}</div>
                  </div>
                </button>
              ))}
            </div>
          )
        })}
      </section>
      <section id="sd-about" data-reveal style={{ ...grid12, rowGap: 24, borderTop: RULE, padding: "120px 0", margin: `120px ${l.m}px 0`, scrollMarginTop: l.mast }} data-testid="ps-about">
        <div className="sd-label" style={{ ...cols(1, l.narrow ? 12 : 4), paddingTop: 12 }}>About</div>
        <div style={cols(l.narrow ? 1 : 6, 12)}>
          <p className="sd-statement">Small photobooks about trips: mountain lakes, coasts, roads and cities, <em>and the people on the way.</em> I print each one as a layflat hardcover. Based in Tbilisi.</p>
          <a href={`mailto:${EMAIL}`} className="sd-link inline-block" style={{ marginTop: 40 }}>{EMAIL}</a>
        </div>
      </section>
    </div>
  )
}

function BookPage({ b, l, root, onBook }: { b: SiteBook; l: L; root: React.RefObject<HTMLDivElement | null>; onBook: (id: string, from?: HTMLElement | null) => void }) {
  const [view, setView] = React.useState(0)
  const [turned, setTurned] = React.useState(false)
  const [fs, setFs] = React.useState(false)
  const [shared, setShared] = React.useState(false)
  const api = React.useRef<ReaderApi>(null)
  const stage = React.useRef<HTMLElement>(null)
  const fsBtn = React.useRef<HTMLButtonElement>(null)
  const n = viewsOf(b)
  const idx = BOOKS.indexOf(b)
  const next = BOOKS[(idx + 1) % BOOKS.length]
  const ratio = SPREAD_R[b.fmt]
  // reader box: top = masthead + 144, bottom ≤ viewport − 116, centred; narrow = the content width
  const RH = l.narrow ? l.content / ratio : Math.max(160, Math.min(l.vh - 116 - (l.mast + 144), (l.content - 144) / ratio))
  const RW = RH * ratio
  const stageH = Math.max(640, l.vh - l.mast)
  React.useEffect(() => { if (view !== 0) setTurned(true) }, [view])
  React.useEffect(() => { if (!shared) return; const t = setTimeout(() => setShared(false), 2000); return () => clearTimeout(t) }, [shared])
  const share = () => { try { void navigator.clipboard?.writeText(`https://aleksandr.photos/${b.id}`).catch(() => {}) } catch { /* file:// */ } setShared(true) }
  const jump = (v: number) => {
    const s = stage.current, r = root.current
    if (!s || !r) { setView(v); return }
    const off = s.getBoundingClientRect().top - r.getBoundingClientRect().top
    if (Math.abs(off) < 4) { setView(v); return }
    s.scrollIntoView({ block: "end", behavior: smooth() })
    setTimeout(() => setView(v), reduced() ? 0 : 520)
  }
  const closeFs = React.useCallback(() => { setFs(false); requestAnimationFrame(() => fsBtn.current?.focus()) }, [])
  const label = viewLabel(b, view)
  const links = (
    <div className="flex" style={{ gap: 28 }}>
      <button ref={fsBtn} type="button" className="sd-link" onClick={() => setFs(true)} data-testid="ps-fullscreen">Fullscreen</button>
      <button type="button" className="sd-link sd-quiet" onClick={share} data-testid="ps-share">{shared ? "Link copied" : "Share"}</button>
      <span role="status" className="sr-only" data-testid="ps-share-status">{shared ? "Link copied" : ""}</span>
    </div>
  )
  const reader = <BookReader ref={api} b={b} view={view} onView={setView} width={RW} keys={!fs} vt />
  const progress = (
    <div style={{ width: RW, height: 2, background: "rgb(26 25 24/.12)", visibility: view === 0 ? "hidden" : undefined }} data-testid="ps-progress">
      <div style={{ height: 2, width: `${(view / (n - 1)) * 100}%`, background: "var(--site-ink)", transition: "width 800ms var(--site-turn)" }} />
    </div>
  )
  const below = view === 0 && !turned
    ? <div className="sd-meta text-center" data-testid="ps-hint">Click the cover or press → to open</div>
    : view === n - 1
      ? <div className="text-center"><button type="button" className="sd-link" onClick={(e) => onBook(next.id, e.currentTarget)} data-testid="ps-next-inline">Next book: <em>{next.title}</em> →</button></div>
      : null
  const controls = (
    <div className="flex items-center" style={{ width: l.content }}>
      <div className="flex-1"><button type="button" className="sd-link sd-quiet" onClick={() => document.getElementById("sd-thumbs")?.scrollIntoView({ block: "start", behavior: smooth() })} data-testid="ps-all-spreads">All spreads ↓</button></div>
      <div className="flex items-center justify-between" style={{ width: 300 }}>
        <button type="button" className="sd-ctl" aria-label="Previous pages" disabled={view === 0} onClick={() => api.current?.go(-1)} data-testid="ps-prev"><ChevronLeft /></button>
        <span className="sd-meta" style={{ color: "var(--site-text)" }} data-testid="ps-reader-label">{label}</span>
        <button type="button" className="sd-ctl" aria-label="Next pages" disabled={view === n - 1} onClick={() => api.current?.go(1)} data-testid="ps-next"><ChevronRight /></button>
      </div>
      <div className="flex-1 text-right"><span className="sd-meta sd-hover-only">← → to turn</span></div>
    </div>
  )
  const titleBlock = (
    <div>
      <div className="sd-label">Book {pad2(idx + 1)} of {pad2(BOOKS.length)}</div>
      <h1 className="sd-h1" style={{ marginTop: 10 }} data-testid="ps-title">{b.title}</h1>
      <div className="sd-meta" style={{ marginTop: 10 }}>{b.year} · {pagesOf(b)} pages · Hardcover, {sizeOf(b)}</div>
    </div>
  )
  const per = l.narrow ? 2 : l.mid ? 3 : 5
  const tw = (l.content - 24 * (per - 1)) / per
  return (
    <div className={l.narrow ? "sd-narrow" : undefined} data-testid="ps-book-page">
      {l.narrow ? (
        <section ref={stage} style={{ background: "var(--site-stage)", padding: `24px ${l.m}px 48px` }} data-testid="ps-stage">
          {titleBlock}
          <div style={{ marginTop: 40 }}>{reader}</div>
          <div style={{ marginTop: 18 }}>{progress}</div>
          <div style={{ marginTop: 16, minHeight: 18 }}>{below}</div>
          <div style={{ marginTop: 24 }}>{controls}</div>
          <div style={{ marginTop: 24 }}>{links}</div>
        </section>
      ) : (
        <section ref={stage} className="relative" style={{ height: stageH, background: "var(--site-stage)" }} data-testid="ps-stage">
          <div className="absolute" style={{ left: l.m, top: 24 }}>{titleBlock}</div>
          <div className="absolute" style={{ right: l.m, top: 44 }}>{links}</div>
          <div className="absolute" style={{ left: (l.W - RW) / 2, top: 144 }}>{reader}</div>
          <div className="absolute" style={{ left: (l.W - RW) / 2, top: 144 + RH + 18 }}>{progress}</div>
          <div className="absolute inset-x-0" style={{ top: 144 + RH + 16 }}>{below}</div>
          <div className="absolute" style={{ left: l.m, top: 144 + RH + 38 }}>{controls}</div>
        </section>
      )}
      <section style={{ ...grid12, rowGap: 40, padding: `120px ${l.m}px 0` }} data-reveal data-testid="ps-about-book">
        <div style={cols(1, l.narrow ? 12 : 4)}>
          <div className="sd-label">About this book</div>
          <dl className="grid" style={{ gridTemplateColumns: "96px 1fr", marginTop: 24, borderTop: RULE, font: "400 14px/1.4 var(--site-sans)" }} data-testid="ps-facts">
            {([["Size", sizeOf(b)], ["Pages", pagesOf(b)], ["Binding", "Hardcover, layflat"], ["Year", b.year]] as const).map(([dt, dd]) => (
              <React.Fragment key={dt}><dt style={{ padding: "15px 0", borderBottom: RULE, color: "var(--site-muted)" }}>{dt}</dt><dd className="tabular-nums" style={{ padding: "15px 0", borderBottom: RULE, color: "var(--site-text)" }}>{dd}</dd></React.Fragment>
            ))}
          </dl>
        </div>
        <p className="sd-statement" style={cols(l.narrow ? 1 : 6, 12)} data-testid="ps-statement"><Rich s={b.statement} /></p>
      </section>
      <section id="sd-thumbs" style={{ padding: `64px ${l.m}px 0`, scrollMarginTop: l.mast }} data-reveal data-testid="ps-thumbs">
        <div className="sd-label">All spreads <span style={{ marginLeft: 8 }}>{b.spreads.length}</span></div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))`, columnGap: 24, rowGap: 56, marginTop: 32 }}>
          {b.spreads.map((x, i) => {
            const k = i + 1, v = k + 1
            const pg = x.template === "last" ? `${2 * k}` : `${2 * k}–${2 * k + 1}`
            return (
              <button key={k} type="button" className="sd-thumb text-left" aria-current={view === v ? "true" : undefined} aria-label={viewLabel(b, v)} onClick={() => jump(v)} data-testid="ps-thumb" data-view={v}>
                <div className="sd-thumb-art" style={{ width: tw, height: tw / ratio }}><SpreadArt b={b} k={k} w={tw} shadow={THUMB_SHADOW} /></div>
                <div className="sd-meta" style={{ marginTop: 14 }}>{pg}</div>
              </button>
            )
          })}
        </div>
      </section>
      <div style={{ padding: `120px ${l.m}px 0` }}>
        <button type="button" className="sd-host flex w-full text-left" style={{ borderTop: RULE, padding: "60px 0 90px", alignItems: "flex-end", gap: 24, flexWrap: l.narrow ? "wrap" : undefined }} data-reveal data-cursor="Open" onClick={(e) => onBook(next.id, e.currentTarget)} data-testid="ps-next-book">
          <div className="min-w-0">
            <div className="sd-label">Next book</div>
            <div className="sd-ul sd-it" style={{ fontSize: l.narrow ? 64 : 128, lineHeight: 0.95, letterSpacing: "-0.04em", color: "var(--site-ink)", marginTop: 28, paddingBottom: 6 }}>{next.title}</div>
            <div className="sd-meta" style={{ marginTop: 20 }}>{meta(next)}</div>
            <div className="sd-link" style={{ marginTop: 28, display: "inline-block" }}>Open the book →</div>
          </div>
          <div style={{ marginLeft: "auto", paddingBottom: 110, paddingRight: 24 }}><Book3D b={next} s={l.narrow ? 8 : 12} /></div>
        </button>
      </div>
      {fs && <SiteFullscreen b={b} view={view} onView={setView} onClose={closeFs} />}
    </div>
  )
}

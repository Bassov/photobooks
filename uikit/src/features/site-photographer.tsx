/* Photographer site (demo): the published site as a photographer's site of books — home with the books on a shelf,
   one page per book (text, facts, every spread), the kit Fullscreen viewer. Sample books and texts; kit only.
   Designer Spec photographer-site-demo-v2. Layout follows the root's own width, not the viewport. */
import * as React from "react"
import { ArrowLeft, Maximize2, Share2 } from "lucide-react"
import { P, T, type Box } from "@/data"
import { cn } from "@/lib/utils"
import { pagesOf } from "@/sandbox/v7"
import { BookObject, LibStyle, hiPhoto, type Fmt } from "./library"
import { Fullscreen, spreadLabel } from "./site-viewer"

const AUTHOR = "Aleksandr Basov"
const serif = { fontFamily: "var(--font-heading)", fontWeight: 400 } as const
const RULE = "border-[color:rgb(57_55_56/.12)]"
const RATIO: Record<Fmt, number> = { portrait: 4 / 5, landscape: 5 / 4, square: 1 }
/** spread width / height: two pages of the format */
const SPREAD_R: Record<Fmt, number> = { portrait: 1.6, landscape: 2.5, square: 2 }
const SIZE: Record<Fmt, string> = { portrait: "24 × 30 cm, portrait", landscape: "30 × 24 cm, landscape", square: "25 × 25 cm, square" }
/** the single last page (left): t-margin mirrored */
const LAST: Box = { x: 4, y: 14, w: 42, h: 72 }

type SiteBook = { id: string; title: string; year: number; fmt: Fmt; cover: string; ink: string; place?: "top" | "bottom"; statement: string; spreads: { template: string; photos: string[] }[] }
/** "t-full p10 · t-pair p03 p18 · … · last hi/r7" → interior spreads (index 1…) */
const sp = (s: string) => s.split(" · ").map((x) => { const [template, ...photos] = x.split(" "); return { template, photos } })
const BOOKS: SiteBook[] = [
  { id: "lake-trip", title: "Lake trip", year: 2026, fmt: "portrait", cover: "p01", ink: "#fff", place: "bottom",
    statement: "Ten days around the mountain lakes in late September: the water, the roads between, and the two of us.",
    spreads: sp("t-full p10 · t-pair p03 p18 · t-hero2 p01 p16 p07 · t-margin p13 · t-pano p17 · t-offset p11 p09 · t-hero4 p15 p05 p14 p06 p19 · t-full p08 · t-three p12 p20 p04 · last hi/r7") },
  { id: "coast", title: "Coast", year: 2025, fmt: "landscape", cover: "p19", ink: "#2E2C2D",
    statement: "A summer of short trips to the sea: sand, wind and the long light of the evenings.",
    spreads: sp("t-full p19 · t-margin p11 · t-offset p13 p16 · t-hero2 p09 p07 p14 · t-full hi/r2 · last p05") },
  { id: "summer-family", title: "Summer, family", year: 2025, fmt: "square", cover: "p15", ink: "#fff",
    statement: "The family summer: a house by the water, grandparents, children and a lot of ice cream.",
    spreads: sp("t-full p15 · t-three p12 p20 p03 · t-hero4 p13 p05 p14 p06 p19 · t-margin p07 · last p11") },
  { id: "desert-road", title: "Desert road", year: 2024, fmt: "landscape", cover: "p08", ink: "#fff",
    statement: "Two thousand kilometres of empty road, and what stood beside it.",
    spreads: sp("t-full p08 · t-margin p17 · t-hero2 p16 p06 p01 · t-pano hi/x-valley · last p09") },
  { id: "forest", title: "Forest", year: 2024, fmt: "portrait", cover: "p18", ink: "#fff",
    statement: "Walks in the same forest through one year, from the first fog to the first snow.",
    spreads: sp("t-full p10 · t-pair p18 p03 · t-margin hi/c13 · t-full hi/c25 · last hi/c18") },
  { id: "city", title: "City", year: 2023, fmt: "square", cover: "p04", ink: "#fff",
    statement: "Rooftops, cafés and streets of one old town, over three short visits.",
    spreads: sp("t-pano p04 · t-hero2 p07 p05 p14 · t-full p17 · t-offset p06 p13 · t-margin p16 · last p12") },
]
const src = (id: string) => (id.startsWith("hi/") ? hiPhoto(id.slice(3)) : P(id).src)
const pages = (b: SiteBook) => pagesOf(b.spreads.length + 1)
const cover = (b: SiteBook, h: number) => <BookObject src={src(b.cover)} title={b.title} fmt={b.fmt} h={h} ink={b.ink} place={b.place} />

const focus = "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]"
const eyebrow = "text-2xs font-semibold uppercase leading-none tracking-[.12em] text-[#535152]"
const pill = "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors [&_svg]:size-4"
// kit quietBtn (site-viewer)
const quietBtn = "bg-field text-foreground hover:bg-accent"
const navItem = cn("border-b border-transparent py-1.5 text-sm font-medium leading-none text-[#535152] transition-colors duration-[120ms] hover:text-[#232223] aria-[current=page]:border-[#232223] aria-[current=page]:text-[#232223]", focus)

type L = { narrow: boolean; content: number; cols: number; col: number }
const layout = (W: number): L => {
  const narrow = W < 768
  const content = Math.min(1120, W - 2 * (narrow ? 24 : 48))
  const cols = content >= 1088 ? 3 : content >= 704 ? 2 : 1
  return { narrow, content, cols, col: (content - 32 * (cols - 1)) / cols }
}

/** One spread drawn from the kit layout templates; `bare` = the Fullscreen copy (no button, numbers or chip). */
function SiteSpread({ b, i, w, bare, onOpen }: { b: SiteBook; i: number; w: number; bare?: boolean; onOpen?: (el: HTMLElement) => void }) {
  const s = b.spreads[i - 1]
  const h = w / SPREAD_R[b.fmt]
  const pw = w / 2
  const last = s.template === "last"
  const frames = last ? [LAST] : T(s.template).frames
  const art = (
    <>
      <div className="absolute inset-y-0 left-0 overflow-hidden bg-white" style={{ width: last ? pw : w, boxShadow: "var(--page-shadow)" }}>
        {frames.map((f, k) => s.photos[k] ? <div key={k} className="absolute bg-cover bg-center" data-testid="ps-frame" style={{ left: (f.x * w) / 100, top: (f.y * h) / 100, width: (f.w * w) / 100, height: (f.h * h) / 100, backgroundImage: `url(${src(s.photos[k])})` }} /> : null)}
      </div>
      {!last && <div aria-hidden className="pointer-events-none absolute inset-y-0 -translate-x-1/2" style={{ left: pw, width: w * 0.03, background: "linear-gradient(90deg, transparent, rgba(0,0,0,.06) 50%, transparent)" }} />}
    </>
  )
  if (bare) return <div className="relative" style={{ width: w, height: h }}>{art}</div>
  const num = (n: number, x: number) => <span className="absolute top-[calc(100%+8px)] -translate-x-1/2 text-2xs leading-none tabular-nums text-[#535152]" style={{ left: x }}>{n}</span>
  // content-visibility clips paint to its box: the wrapper's 48 px pad keeps the paper shadow and page numbers visible
  return (
    <div className="pointer-events-none" style={{ padding: 48, margin: -48, contentVisibility: "auto", containIntrinsicSize: `${w}px ${h}px` }}>
      <button type="button" className="group pointer-events-auto relative block cursor-zoom-in outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#535152]" style={{ width: w, height: h }}
        onClick={(e) => onOpen?.(e.currentTarget)} aria-label={`${spreadLabel(i, b.spreads.length + 1)}, open fullscreen`} data-testid="ps-spread" data-index={i}>
        {art}
        {num(2 * i, pw / 2)}
        {!last && num(2 * i + 1, pw * 1.5)}
        <span className="absolute right-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-[rgb(0_0_0/.45)] px-2.5 text-xs font-medium leading-none text-white opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none [&_svg]:size-[14px]" style={last ? { right: pw + 12 } : undefined} aria-hidden data-testid="ps-chip"><Maximize2 />Fullscreen</span>
      </button>
    </div>
  )
}

/** Fullscreen page i: 0 = the front cover as the right page, else the spread. */
function FsPage({ b, i, w }: { b: SiteBook; i: number; w: number }) {
  if (i > 0) return <SiteSpread b={b} i={i} w={w} bare />
  const h = w / SPREAD_R[b.fmt]
  const pw = w / 2
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <div className="absolute inset-y-0 right-0 overflow-hidden bg-cover bg-center" style={{ width: pw, backgroundImage: `url(${src(b.cover)})`, boxShadow: "var(--page-shadow)" }}>
        <div className="absolute inset-x-0 px-3 text-center leading-none tracking-[-0.02em]" style={{ ...serif, color: b.ink, [b.place ?? "top"]: "9%", fontSize: Math.round(Math.min(pw, h) * 0.14) } as React.CSSProperties}><em>{b.title}</em></div>
      </div>
    </div>
  )
}

export function PhotographerSite() {
  const root = React.useRef<HTMLDivElement>(null)
  const [W, setW] = React.useState(1440)
  const [page, setPage] = React.useState<string>("home")
  const [fs, setFs] = React.useState<number | null>(null)
  const [shared, setShared] = React.useState(false)
  const opener = React.useRef<HTMLElement | null>(null)
  const toAbout = React.useRef(false)
  React.useLayoutEffect(() => { const el = root.current; if (!el) return; const r = () => setW(el.offsetWidth); r(); const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect() }, [])
  const scrollAbout = () => document.getElementById("ps-about")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  React.useLayoutEffect(() => {
    if (root.current) root.current.scrollTop = 0
    if (toAbout.current) { toAbout.current = false; scrollAbout() }
  }, [page])
  const show = (p: string) => { setPage(p); setShared(false) }
  const about = () => { if (page === "home") scrollAbout(); else { toAbout.current = true; show("home") } }
  const l = layout(W)
  const b = BOOKS.find((x) => x.id === page)
  const n = b ? b.spreads.length + 1 : 1
  const go = React.useCallback((d: number) => setFs((x) => (x === null ? x : Math.max(0, Math.min(n - 1, x + d)))), [n])
  const close = React.useCallback(() => { setFs(null); requestAnimationFrame(() => opener.current?.focus()) }, [])
  const open = (i: number, el: HTMLElement) => { opener.current = el; setFs(i) }
  return (
    // data-allow-border: the site's hairline rules are content (Designer Spec), not kit chrome
    <div ref={root} className="h-full overflow-y-auto bg-neutral-100 text-sm text-foreground [scrollbar-gutter:stable_both-edges]" style={{ fontFamily: "var(--font-ui)" }} data-testid="ps-site" data-allow-border>
      <LibStyle />
      <header className="mx-auto flex items-center" style={{ width: l.content, height: l.narrow ? 56 : 72 }} data-testid="ps-mast">
        <button type="button" className={cn(l.narrow ? "text-lg" : "text-xl", "leading-none text-[#232223]", focus)} style={serif} onClick={() => show("home")} data-testid="ps-home-link">{AUTHOR}</button>
        <nav className="ml-auto flex" style={{ gap: l.narrow ? 20 : 28 }}>
          <button type="button" className={navItem} aria-current="page" onClick={() => show("home")} data-testid="ps-nav-books">Books</button>
          <button type="button" className={navItem} onClick={about} data-testid="ps-nav-about">About</button>
        </nav>
      </header>
      <main className="mx-auto" style={{ width: l.content }}>
        {b ? <BookPage b={b} l={l} shared={shared} onShare={() => setShared(true)} onOpen={open} onBook={show} /> : <Home l={l} onBook={show} />}
        <footer className={cn("flex border-t text-xs leading-[1.45] text-[#535152]", RULE)} style={{ padding: "20px 0 28px" }} data-testid="ps-foot"><span>© 2026 {AUTHOR}</span><span className="ml-auto">Made with Photobooks</span></footer>
      </main>
      {b && fs !== null && <Fullscreen i={fs} n={n} title={b.title} ratio={SPREAD_R[b.fmt]} onGo={go} onClose={close} render={(i, w) => <FsPage b={b} i={i} w={w} />} />}
    </div>
  )
}

function Home({ l, onBook }: { l: L; onBook: (id: string) => void }) {
  const box = l.narrow ? 360 : 340
  return (
    <div data-testid="ps-home">
      <div className="max-w-[720px]" style={{ padding: l.narrow ? "32px 0 40px" : "56px 0 64px" }}>
        <p className={cn(l.narrow ? "text-2xl" : "text-3xl", "text-balance tracking-[-0.005em] text-[#232223]")} style={serif} data-testid="ps-lead">Lakes, coasts and the people I travel with.</p>
        <p className="mt-3 text-base tabular-nums text-[#535152]">6 photobooks · 2023–2026</p>
      </div>
      <div className="grid items-end" style={{ gridTemplateColumns: `repeat(${l.cols}, ${l.col}px)`, columnGap: 32, rowGap: l.narrow ? 56 : 72, paddingBottom: 96 }} data-testid="ps-shelf">
        {BOOKS.map((x) => (
          <button key={x.id} type="button" className="lib-book flex flex-col text-left" onClick={() => onBook(x.id)} data-testid="ps-book" data-book={x.id}>
            <div className="flex w-full items-end justify-center" style={{ height: box }}><div className="lib-obj">{cover(x, Math.min(box, (l.col - 8) / RATIO[x.fmt]))}</div></div>
            <div className="mt-5 text-xl text-[#232223]" style={serif}>{x.title}</div>
            <div className="mt-0.5 tabular-nums text-[#535152]">{x.year} · {pages(x)} pages</div>
          </button>
        ))}
      </div>
      <section id="ps-about" className={cn("grid border-t", RULE)} style={{ padding: "48px 0 56px", gridTemplateColumns: l.narrow ? "1fr" : "400px 1fr", columnGap: 80, rowGap: 16 }} data-testid="ps-about">
        <div className={eyebrow} style={{ paddingTop: 4 }}>About</div>
        <p className="max-w-[56ch] text-base leading-[1.6]">
          Small photobooks about trips: mountain lakes, coasts, roads and cities, and the people on the way. Based in Tbilisi.<br />
          <span className="text-[#535152]">Contact:</span> <a href="mailto:hello@aleksandr.photos" className={cn("text-[#232223] hover:underline", focus)}>hello@aleksandr.photos</a>
        </p>
      </section>
    </div>
  )
}

function BookPage({ b, l, shared, onShare, onOpen, onBook }: { b: SiteBook; l: L; shared: boolean; onShare: () => void; onOpen: (i: number, el: HTMLElement) => void; onBook: (id: string) => void }) {
  const oh = l.narrow ? Math.min(360, l.content / RATIO[b.fmt]) : Math.min(500, (l.content - 560) / RATIO[b.fmt])
  const sw = l.narrow ? l.content : l.content - 80
  const next = BOOKS[(BOOKS.indexOf(b) + 1) % BOOKS.length]
  const link = `https://aleksandr.photos/${b.id}`
  const share = () => { try { void navigator.clipboard?.writeText(link).catch(() => {}) } catch { /* file:// */ } onShare() }
  const text = (
    <div key="text">
      <button type="button" className={cn("flex h-8 w-fit items-center gap-1 text-sm text-[#535152] transition-colors hover:text-[#232223] [&_svg]:size-4", focus)} style={{ marginBottom: l.narrow ? 12 : 24 }} onClick={() => onBook("home")} data-testid="ps-all-books"><ArrowLeft />All books</button>
      <div className={eyebrow}>{b.year}</div>
      <h1 className={cn(l.narrow ? "text-2xl" : "text-3xl", "mt-3 tracking-[-0.005em] text-[#232223]")} style={serif} data-testid="ps-title">{b.title}</h1>
      <p className="mt-4 max-w-[44ch] text-base leading-[1.6]">{b.statement}</p>
      <dl className={cn("mt-7 grid grid-cols-[96px_1fr] border-t text-sm [&>*]:border-b [&>*]:border-[color:rgb(57_55_56/.12)] [&>*]:py-2.25", RULE)} data-testid="ps-facts">
        {([["size", "Size", SIZE[b.fmt]], ["pages", "Pages", pages(b)], ["binding", "Binding", "Hardcover"], ["year", "Year", b.year]] as const).map(([k, dt, dd]) => (
          <React.Fragment key={k}><dt className="text-[#535152]">{dt}</dt><dd className="tabular-nums text-[#393738]" data-fact={k}>{dd}</dd></React.Fragment>
        ))}
      </dl>
      <div className="mt-7 flex gap-2">
        <button type="button" className={cn(pill, "bg-[#232223] text-[#F2F2F2] hover:bg-[#3A3839]", focus)} onClick={(e) => onOpen(0, e.currentTarget)} data-testid="ps-read"><Maximize2 />Read in fullscreen</button>
        <button type="button" className={cn(pill, quietBtn, focus)} onClick={share} data-testid="ps-share"><Share2 />{shared ? "Link copied" : "Share"}</button>
      </div>
      {shared && <div className="mt-2 text-xs text-[#535152]" role="status" data-testid="ps-share-link">{link}</div>}
    </div>
  )
  const obj = (
    <div key="obj" className="flex items-end justify-center" style={{ height: l.narrow ? oh : 520 }}>
      <button type="button" className="group cursor-zoom-in outline-hidden" aria-label="Open fullscreen" onClick={(e) => onOpen(0, e.currentTarget)} data-testid="ps-cover">
        <div className="rounded-xs group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[#3A3839]">{cover(b, oh)}</div>
      </button>
    </div>
  )
  return (
    <div data-testid="ps-book-page">
      <div className="grid items-center" style={{ gridTemplateColumns: l.narrow ? "1fr" : "400px 1fr", columnGap: 80, rowGap: 32, padding: l.narrow ? "16px 0 56px" : "40px 0 96px" }}>
        {l.narrow ? [obj, text] : [text, obj]}
      </div>
      <div className={cn(eyebrow, "text-center")}>Inside the book</div>
      <div className="flex flex-col items-center" style={{ gap: l.narrow ? 40 : 96, padding: l.narrow ? "24px 0 72px" : "32px 0 120px" }} data-testid="ps-spreads">
        {b.spreads.map((_, k) => <SiteSpread key={k} b={b} i={k + 1} w={sw} onOpen={(el) => onOpen(k + 1, el)} />)}
      </div>
      <button type="button" className={cn("lib-book flex w-full items-center border-t text-left", RULE)} style={{ padding: "48px 0 40px", gap: l.narrow ? 20 : 32, flexWrap: l.narrow ? "wrap" : undefined }} onClick={() => onBook(next.id)} data-testid="ps-next">
        <div className={cn(eyebrow, "w-[120px] shrink-0")}>Next book</div>
        <div className="lib-obj">{cover(next, 120)}</div>
        <div><div className="text-xl text-[#232223]" style={serif}>{next.title}</div><div className="tabular-nums text-[#535152]">{next.year} · {pages(next)} pages</div></div>
      </button>
    </div>
  )
}

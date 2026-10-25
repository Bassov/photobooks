import { DemoCredits } from "./Credits"
import * as React from "react"
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, Shapes, MousePointerClick, Image as ImageIcon, Search, X, NotebookText, MonitorPlay, Layers, Play } from "lucide-react"
import { Link } from "react-aria-components"
import { UNSAFE_PortalProvider } from "react-aria"
import { cn } from "@/lib/utils"
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle"
import { Badge } from "@/components/uui/Badge"
import { Kbd } from "@/components/app/ui"
import { SearchField, SearchFieldGroup, SearchFieldInput, SearchFieldClear } from "@/components/ui/searchfield"
import { Tabs, TabList, Tab } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectPopover, SelectListBox, SelectItem } from "@/components/ui/select"
import { PAGES, GROUPS, SCREENS, MILESTONES, pageIndex, screenIndex, screenOf, featuresOn, type Page, type Screen } from "./pages"
import { href } from "./router"
import { FEATURES } from "@/features/registry"
import type { FeatureDef } from "@/features/types"
import { SCREEN_DEFS } from "@/features/screen-demos"

const navLink = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground outline-hidden data-[hovered]:bg-field data-[hovered]:text-foreground data-[current]:bg-sel data-[current]:font-medium data-[current]:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring [&_svg]:size-4"
const card = "rounded-xl bg-card outline-hidden data-[hovered]:bg-field data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring"

export function KitBar({ current, screen, section }: { current?: string; screen?: string; section?: "index" | "components" }) {
  const sec = section ?? (current || screen ? "index" : (typeof location !== "undefined" && location.hash.startsWith("#/components") ? "components" : "index"))
  const i = current ? pageIndex(current) : -1
  const prev = i > 0 ? PAGES[i - 1] : null, next = i >= 0 && i < PAGES.length - 1 ? PAGES[i + 1] : null
  const si = screen ? screenIndex(screen) : -1
  const ps = si > 0 ? SCREENS[si - 1] : null, ns = si >= 0 && si < SCREENS.length - 1 ? SCREENS[si + 1] : null
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-chrome px-5">
      <Link href={href.index} className="flex items-center gap-2 rounded-md outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
        <span className="grid size-7 place-items-center rounded-md bg-field text-foreground"><BookOpen className="size-3.5" /></span>
        <span className="text-base font-semibold tracking-[-0.01em]">Photobooks</span>
        <span className="text-sm text-muted-foreground">UI kit</span>
      </Link>
      <span className="mx-2 h-5 w-px" />
      <Link href={href.index} className={navLink} data-nav="index" data-current={sec === "index" || undefined} aria-current={sec === "index" ? "page" : undefined}><LayoutGrid />Screens</Link>
      <Link href={href.components} className={navLink} data-nav="components" data-current={sec === "components" || undefined} aria-current={sec === "components" ? "page" : undefined}><Shapes />Components</Link>
      <div className="ml-auto flex items-center gap-1.5">
        {i >= 0 && (
          <>
            {prev ? <Link href={href.feature(prev.slug)} className={navLink} data-nav="prev" aria-label={`Previous: ${prev.slug}`}><ChevronLeft /><span className="max-w-[200px] truncate font-mono text-xs">{prev.slug}</span></Link> : <span className={cn(navLink, "opacity-40")}><ChevronLeft />start</span>}
            <span className="tabular-nums text-xs text-muted-foreground" data-testid="page-counter">{i + 1} / {PAGES.length}</span>
            {next ? <Link href={href.feature(next.slug)} className={navLink} data-nav="next" aria-label={`Next: ${next.slug}`}><span className="max-w-[200px] truncate font-mono text-xs">{next.slug}</span><ChevronRight /></Link> : <span className={cn(navLink, "opacity-40")}>end<ChevronRight /></span>}
            <span className="mx-1.5 h-5 w-px" />
          </>
        )}
        {si >= 0 && (
          <>
            {ps ? <Link href={href.screen(ps.id)} className={navLink} data-nav="prev-screen" aria-label={`Previous screen: ${ps.title}`}><ChevronLeft /><span className="max-w-[220px] truncate text-xs">{ps.title}</span></Link> : <span className={cn(navLink, "opacity-40")}><ChevronLeft />start</span>}
            <span className="tabular-nums text-xs text-muted-foreground" data-testid="screen-counter">Screen {si + 1} / {SCREENS.length}</span>
            {ns ? <Link href={href.screen(ns.id)} className={navLink} data-nav="next-screen" aria-label={`Next screen: ${ns.title}`}><span className="max-w-[220px] truncate text-xs">{ns.title}</span><ChevronRight /></Link> : <span className={cn(navLink, "opacity-40")}>end<ChevronRight /></span>}
            <span className="mx-1.5 h-5 w-px" />
          </>
        )}
      </div>
    </header>
  )
}

export function KindBadge({ kind, size = "sm" }: { kind: Page["kind"]; size?: "sm" | "md" }) {
  return kind === "interactive"
    ? <Badge size={size} color="gray" type="pill-color" icon={<MousePointerClick />}>interactive</Badge>
    : <Badge size={size} color="gray" type="pill-color" icon={<ImageIcon />}>static</Badge>
}

/* ------------------------------------------------------------------ index state (restored when coming back) */
type Filter = "all" | "interactive" | "static"
type IndexState = { q: string; filter: Filter; milestone: string; collapsed: string[]; y: number; last?: string }
const IDX_KEY = "photobooks-kit-index-v4"
let idxMemory: IndexState = { q: "", filter: "all", milestone: "all", collapsed: [], y: 0 }
function loadIndex(): IndexState {
  try { const raw = sessionStorage.getItem(IDX_KEY); if (raw) idxMemory = { ...idxMemory, ...JSON.parse(raw) } } catch { /* storage unavailable: keep in memory */ }
  return idxMemory
}
function saveIndex(p: Partial<IndexState>) {
  idxMemory = { ...idxMemory, ...p }
  try { sessionStorage.setItem(IDX_KEY, JSON.stringify(idxMemory)) } catch { /* ignore */ }
}
const onIndexRoute = () => /^#?\/?$/.test(location.hash)
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
/** v4.1: one shortcut notation — chords joined with “+”, alternatives by space or “ / ”; Ctrl renders as ⌘ on macOS. */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const msShort = (g: string) => g.split(" — ")[0]

/* ------------------------------------------------------------------ index: organised by app screens (v4) */
export function IndexPage() {
  const init = React.useMemo(loadIndex, [])
  const [q, setQ] = React.useState(init.q)
  const [filter, setFilter] = React.useState<Filter>(init.filter)
  const [milestone, setMilestone] = React.useState(init.milestone)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(init.collapsed))

  React.useEffect(() => saveIndex({ q, filter, milestone, collapsed: [...collapsed] }), [q, filter, milestone, collapsed])
  // restore scroll position (and focus the last opened row) before paint
  React.useLayoutEffect(() => {
    window.scrollTo(0, init.y)
    if (init.last) document.querySelector<HTMLElement>(`[data-feature-link="${CSS.escape(init.last)}"], [data-screen-link="${CSS.escape(init.last)}"]`)?.focus({ preventScroll: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  React.useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (onIndexRoute()) saveIndex({ y: Math.round(window.scrollY) }) }) }
    window.addEventListener("scroll", on, { passive: true })
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on) }
  }, [])
  // "/" focuses search
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) { e.preventDefault(); const el = document.querySelector<HTMLInputElement>("[data-testid=index-search-input]"); el?.focus(); el?.select() }
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])

  const needle = q.trim().toLowerCase()
  const narrowed = !!needle || filter !== "all" || milestone !== "all"
  const match = (p: Page) => (filter === "all" || p.kind === filter) && (milestone === "all" || p.group === milestone) && (!needle || `${p.slug} ${p.title}`.toLowerCase().includes(needle))
  const screenMatch = (s: Screen) => !needle || `${s.id} ${s.title}`.toLowerCase().includes(needle)
  const groups = GROUPS.map((g) => ({ ...g, shown: g.pages.filter(match), hit: screenMatch(g.screen) }))
    .filter((g) => g.shown.length || (!narrowed || (needle && g.hit && filter === "all" && milestone === "all")))
  const total = groups.reduce((n, g) => n + g.shown.length, 0)
  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allCollapsed = collapsed.size >= SCREENS.length
  const nInteractive = PAGES.filter((p) => p.kind === "interactive").length
  const remember = (last: string) => saveIndex({ last, y: Math.round(window.scrollY) })

  return (
    <div className="min-h-screen bg-background">
      <KitBar />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        <div className="flex items-end gap-8">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-2">Photobooks · UI/UX reference · style B · v4</div>
            <h1 className="heading text-3xl leading-tight">UI kit</h1>
            <p className="mt-2 max-w-[740px] text-base leading-relaxed text-muted-foreground">
              Organised by app screen. Each screen has a full live demo and lists the roadmap features that live on it; every feature keeps its own page (demo + UX notes) under its roadmap slug. Scope and status live in the roadmap, not here.
            </p>
          </div>
          <dl className="grid shrink-0 grid-cols-4 gap-2 text-center">
            {([[SCREENS.length, "screens"], [PAGES.length, "features"], [nInteractive, "interactive"], [PAGES.length - nInteractive, "static"]] as const).map(([n, l]) => (
              <div key={l} className="rounded-lg bg-card px-4 py-2 shadow-xs"><dt className="heading text-2xl tabular-nums">{n}</dt><dd className="text-xs text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
        </div>
        <Link href={href.demo} className="group mt-7 flex items-center gap-4 rounded-xl p-5 text-foreground shadow-xs outline-hidden data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-[#535152]" data-testid="demo-link" data-featured style={{ background: "#D7D7D7" }}>
          <span className="grid size-11 place-items-center rounded-lg bg-background shadow-xs"><Play className="size-5" /></span>
          <span className="min-w-0"><span className="block text-lg font-semibold">Interactive demo — the whole app, end to end</span><span className="block text-sm opacity-80">Welcome → library → create a book → edit → publish the site → print. Everything is clickable; state lives in memory.</span></span>
          <ChevronRight className="ml-auto size-5 opacity-80 transition-transform group-data-[hovered]:translate-x-0.5" />
        </Link>
        <Link href={href.components} className={cn(card, "group mt-3 flex items-center gap-4 p-4")}>
          <span className="grid size-10 place-items-center rounded-lg bg-background shadow-xs"><Shapes className="size-[18px]" /></span>
          <span className="min-w-0"><span className="block text-base font-semibold">Components</span><span className="block text-sm text-muted-foreground">Every ported component: variants and states, one Procreate-light theme</span></span>
          <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-data-[hovered]:translate-x-0.5" />
        </Link>

        <div className="sticky top-14 z-30 -mx-8 mt-8 flex items-center gap-3 bg-background/95 px-8 py-3 backdrop-blur" data-testid="index-toolbar">
          <Tabs selectedKey={filter} onSelectionChange={(k) => setFilter(String(k) as Filter)}>
            <TabList aria-label="Filter by kind" data-testid="index-filter">
              {([["all", "All"], ["interactive", "Interactive"], ["static", "Static"]] as const).map(([id, l]) => (
                <Tab key={id} id={id}>{l}</Tab>
              ))}
            </TabList>
          </Tabs>
          <Select aria-label="Milestone" selectedKey={milestone} onSelectionChange={(k) => k !== null && setMilestone(String(k))} className="w-[230px]" data-testid="milestone-filter">
            <SelectTrigger className="h-8 px-3 text-sm shadow-xs data-[focus-visible]:ring-offset-0"><Layers className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" /><SelectValue className="truncate" /></SelectTrigger>
            <SelectPopover><SelectListBox>
              <SelectItem id="all" textValue="All milestones">All milestones</SelectItem>
              {MILESTONES.map((m) => <SelectItem key={m} id={m} textValue={m}>{m}</SelectItem>)}
            </SelectListBox></SelectPopover>
          </Select>
          <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(SCREENS.map((g) => g.id)))} data-testid="toggle-all"
            className="h-8 rounded-md px-3 text-sm text-muted-foreground outline-hidden hover:bg-field hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite" data-testid="match-count">{narrowed ? `${total} of ${PAGES.length}` : ""}</span>
          <SearchField aria-label="Search screens and features by slug or title" value={q} onChange={setQ} className="w-72" data-testid="index-search">
            <SearchFieldGroup className="h-8 gap-1.5 px-3 py-0 shadow-xs data-[focus-within]:ring-offset-0">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <SearchFieldInput data-testid="index-search-input" placeholder="Search slug or title…" className="min-w-0 flex-1 bg-transparent px-0 py-0 text-sm" />
              {q ? <SearchFieldClear className="size-5 p-0.5"><X className="size-3.5" /></SearchFieldClear> : <Kbd className="shrink-0">/</Kbd>}
            </SearchFieldGroup>
          </SearchField>
        </div>

        {groups.map((g) => {
          const open = narrowed || !collapsed.has(g.screen.id)
          const id = `s-${g.screen.id}`
          const n = SCREENS.indexOf(g.screen) + 1
          return (
            <section key={g.screen.id} className="mt-8" data-screen={g.screen.id}>
              <div className="mb-2 flex items-center gap-2">
                <button type="button" onClick={() => toggle(g.screen.id)} aria-expanded={open} aria-controls={id} aria-label={`${open ? "Collapse" : "Expand"} ${g.screen.title}`} disabled={narrowed} data-testid="group-toggle"
                  className="grid size-7 place-items-center rounded-md outline-hidden hover:bg-field focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent">
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                </button>
                <Link href={href.screen(g.screen.id)} data-screen-link={g.screen.id} onPress={() => remember(g.screen.id)}
                  className="group flex min-w-0 items-baseline gap-2 rounded-md pr-2 outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
                  <span className="text-xs tabular-nums text-muted-foreground">{String(n).padStart(2, "0")}</span>
                  <h2 className="heading text-xl group-data-[hovered]:underline group-data-[hovered]:underline-offset-4">{g.screen.title}</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{g.pages.length === 0 ? "screen only" : g.shown.length === g.pages.length ? `${g.pages.length} ${g.pages.length === 1 ? "feature" : "features"}` : `${g.shown.length} / ${g.pages.length}`}</span>
                </Link>
                <Link href={href.screen(g.screen.id)} onPress={() => remember(g.screen.id)} data-testid="open-screen" className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-hidden data-[hovered]:bg-field data-[hovered]:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring [&_svg]:size-3.5"><MonitorPlay />Screen demo</Link>
              </div>
              {open && (
                <div id={id} className="overflow-hidden rounded-xl bg-card shadow-xs">
                  <div className="px-4 py-2 text-sm leading-relaxed text-muted-foreground">{g.screen.summary}</div>
                  {g.shown.map((p) => (
                    <Link key={p.slug} href={href.feature(p.slug)} data-feature-link={p.slug} onPress={() => remember(p.slug)}
                      className={cn("grid grid-cols-[290px_1fr_auto_auto] items-center gap-4 px-4 py-2 outline-hidden data-[hovered]:bg-field data-[focus-visible]:bg-field", init.last === p.slug && "bg-sel")}>
                      <span className="truncate font-mono text-sm font-medium">{p.slug}</span>
                      <span className="min-w-0 truncate text-sm text-foreground/85">{p.title}</span>
                      <span className="text-2xs tabular-nums text-muted-foreground" title={p.group}>{msShort(p.group)}</span>
                      <KindBadge kind={p.kind} />
                    </Link>
                  ))}
                  {g.pages.length === 0 && (
                    <Link href={href.screen(g.screen.id)} onPress={() => remember(g.screen.id)} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground outline-hidden data-[hovered]:bg-field data-[focus-visible]:bg-field">
                      No roadmap feature yet — the screen page has the demo and notes<ChevronRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </section>
          )
        })}
        {groups.length === 0 && (
          <div className="mt-12 text-center text-sm text-muted-foreground" data-testid="no-results">
            Nothing matches “{q}”. <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => { setQ(""); setFilter("all"); setMilestone("all") }}>Clear filters</button>
          </div>
        )}
        <footer className="mt-14 pt-5 text-xs leading-relaxed text-muted-foreground">
          Feature slugs and titles follow <span className="font-mono">docs/roadmap.md</span>; items without UI are not part of the kit. Screens group them by where they live in the app. Components: JollyUI (MIT) on React Aria Components (Apache-2.0). Photos: CC0, StockSnap.io; library demo photos from Wikimedia Commons (CC BY-SA 4.0) — <a href="#/credits" className="underline underline-offset-2" data-testid="footer-credits">Photo credits</a>. Shortcuts: <Kbd>/</Kbd> search, <Kbd>Esc</Kbd> clear, <Kbd>Alt</Kbd>+<Kbd>←</Kbd> <Kbd>→</Kbd> previous / next page.
        </footer>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ feature page */
const NOTES_KEY = "photobooks-kit-notes-open"
function useNotesOpen() {
  const [open, setOpen] = React.useState(() => { try { return localStorage.getItem(NOTES_KEY) !== "0" } catch { return true } })
  const set = (v: boolean) => { setOpen(v); try { localStorage.setItem(NOTES_KEY, v ? "1" : "0") } catch { /* ignore */ } }
  return [open, set] as const
}
function NoteCol({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="eyebrow mb-1">{title}</div>
      <div className="text-sm leading-relaxed text-foreground/90 [&_b]:font-semibold">{children}</div>
    </div>
  )
}
/** Compact, collapsible UX notes above the demo (the demo always gets the full width). */
export function UxNotes({ def }: { def: Pick<FeatureDef, "notes"> }) {
  const n = def.notes
  const [open, setOpen] = useNotesOpen()
  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-xs" aria-label="UX notes" data-testid="ux-notes" data-open={open}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="notes-toggle"
        className="flex w-full items-center gap-2 px-4 py-2 text-left outline-hidden hover:bg-field focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <NotebookText className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">UX notes</span>
        {!open && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{n.what}</span>}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className={cn("grid gap-x-6 gap-y-3 px-4 pb-3 pt-3", n.keys?.length ? "grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.15fr)_minmax(0,1.35fr)]" : "grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)]")} data-testid="notes-body">
          <NoteCol title="What">{n.what}</NoteCol>
          <NoteCol title="Where">{n.where}</NoteCol>
          <NoteCol title="Why">{n.why}</NoteCol>
          {!!n.keys?.length && <NoteCol title="Keys">
            {n.keys?.length ? (
              <div className="flex flex-col gap-1">
                {n.keys.map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="flex shrink-0 flex-wrap gap-0.5">{k.split(" ").map((x, j) => x === "/" ? <span key={j} className="px-0.5 text-muted-foreground">/</span> : <span key={j} className="inline-flex items-center gap-0.5">{x.split(/\+(?=.)/).map((y, i) => <React.Fragment key={i}>{i > 0 && <span className="text-2xs text-muted-foreground">+</span>}<Kbd>{y === "Ctrl" && IS_MAC ? "⌘" : y}</Kbd></React.Fragment>)}</span>)}</span>
                    <span className="text-xs text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </NoteCol>}
          <NoteCol title="Edge cases">
            {n.edge?.length ? <ul className="ml-4 list-disc space-y-0.5 text-xs marker:text-muted-foreground">{n.edge.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="text-muted-foreground">—</span>}
          </NoteCol>
        </div>
      )}
    </section>
  )
}

function PrevNextCard({ page, dir }: { page: Page | null; dir: "prev" | "next" }) {
  if (!page) return <div className="flex-1" />
  return (
    <Link href={href.feature(page.slug)} data-nav={`footer-${dir}`} className={cn(card, "group flex flex-1 items-center gap-3 p-4", dir === "next" && "flex-row-reverse text-right")}>
      {dir === "prev" ? <ChevronLeft className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      <span className="min-w-0">
        <span className="block text-2xs text-muted-foreground">{dir === "prev" ? "Previous" : "Next"} · {screenOf(page.screen)?.title}</span>
        <span className="block truncate font-mono text-sm font-medium">{page.slug}</span>
        <span className="block truncate text-xs text-muted-foreground">{page.title}</span>
      </span>
    </Link>
  )
}

/* Demo frame: overlays (dialogs, toasts, popovers) portal into the frame so they stay inside the demo */
export function DemoBox({ auto, h, children, className }: { auto?: boolean; h?: number; children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLElement>(null)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  return (
    <>
    <section ref={ref} className={cn("kit-demo relative isolate overflow-hidden rounded-xl bg-chrome shadow-sm [transform:translateZ(0)]", className)} style={auto ? undefined : { height: h ?? 640 }} data-testid="demo">
      {ready && <UNSAFE_PortalProvider getContainer={() => ref.current}>{children}</UNSAFE_PortalProvider>}
    </section>
    {ready && <DemoCredits frame={ref} />}
    </>
  )
}

export function FeaturePage({ slug }: { slug: string }) {
  const idx = pageIndex(slug)
  React.useEffect(() => { window.scrollTo(0, 0) }, [slug])
  const def = FEATURES[slug]
  if (idx < 0 || !def) return (
    <div className="min-h-screen bg-background"><KitBar />
      <main className="mx-auto max-w-[720px] px-8 py-24 text-center">
        <h1 className="heading text-2xl" data-testid="not-found">No UI reference page for <span className="font-mono">{slug}</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">The kit only covers roadmap items with real UI/UX.</p>
        <Link href={href.index} className="mt-4 inline-block text-sm text-foreground underline-offset-2 data-[hovered]:underline">Back to the index</Link>
      </main>
    </div>
  )
  const page = PAGES[idx]
  const Demo = def.Demo
  return (
    <div className="min-h-screen bg-background">
      <KitBar current={slug} />
      <main className="mx-auto max-w-[1440px] px-6 pb-16 pt-5">
        <div className="mb-4 flex items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href={href.index} data-nav="crumb-index" className="rounded outline-hidden data-[hovered]:text-foreground data-[hovered]:underline">Index</Link>
              <ChevronRight className="size-3" /><Link href={href.screen(page.screen)} data-nav="crumb-screen" className="rounded outline-hidden data-[hovered]:text-foreground data-[hovered]:underline">{screenOf(page.screen)?.title}</Link>
              <span className="mx-1 text-muted-foreground">·</span><span>{page.group}</span>
            </div>
            <h1 className="mt-2 font-mono text-2xl font-semibold leading-tight tracking-[-0.01em]" data-testid="feature-title">{page.slug}</h1>
            <p className="heading mt-0.5 text-lg text-foreground/85" data-testid="feature-subtitle">{page.title}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Link href={href.screen(page.screen)} data-nav="screen" data-testid="on-screen" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-card px-3 text-xs shadow-xs outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring [&_svg]:size-3.5"><MonitorPlay className="text-muted-foreground" />On screen: <b className="font-semibold">{screenOf(page.screen)?.title}</b></Link>
              <KindBadge kind={page.kind} size="md" />
            </div>
            <span className="select-all font-mono text-2xs text-muted-foreground" title="Reference this page from a roadmap item">UI ref: uikit#/feature/{page.slug}</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <UxNotes def={def} />
          <DemoBox key={page.slug} auto={def.auto} h={def.h}><Demo /></DemoBox>
        </div>
        <nav className="mt-8 flex gap-4" aria-label="Neighbouring pages">
          <PrevNextCard page={idx > 0 ? PAGES[idx - 1] : null} dir="prev" />
          <div className="flex flex-col gap-2">
            <Link href={href.screen(page.screen)} className={cn(card, "flex flex-1 items-center px-5 text-sm")} data-nav="footer-screen"><MonitorPlay className="mr-2 size-4" />Screen</Link>
            <Link href={href.index} className={cn(card, "flex flex-1 items-center px-5 text-sm")} data-nav="footer-index"><LayoutGrid className="mr-2 size-4" />Index</Link>
          </div>
          <PrevNextCard page={idx < PAGES.length - 1 ? PAGES[idx + 1] : null} dir="next" />
        </nav>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ screen page (v4): full live demo + the features on it */
function ScreenCard({ s, dir }: { s: Screen | null; dir: "prev" | "next" }) {
  if (!s) return <div className="flex-1" />
  return (
    <Link href={href.screen(s.id)} data-nav={`footer-${dir}-screen`} className={cn(card, "group flex flex-1 items-center gap-3 p-4", dir === "next" && "flex-row-reverse text-right")}>
      {dir === "prev" ? <ChevronLeft className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      <span className="min-w-0"><span className="block text-2xs text-muted-foreground">{dir === "prev" ? "Previous screen" : "Next screen"}</span><span className="block truncate text-base font-semibold">{s.title}</span></span>
    </Link>
  )
}
export function ScreenPage({ id }: { id: string }) {
  React.useEffect(() => { window.scrollTo(0, 0) }, [id])
  const si = screenIndex(id)
  const def = SCREEN_DEFS[id]
  if (si < 0 || !def) return (
    <div className="min-h-screen bg-background"><KitBar />
      <main className="mx-auto max-w-[720px] px-8 py-24 text-center">
        <h1 className="heading text-2xl" data-testid="not-found">No screen <span className="font-mono">{id}</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">Screens: {SCREENS.map((s) => s.id).join(", ")}.</p>
        <Link href={href.index} className="mt-4 inline-block text-sm text-foreground underline-offset-2 data-[hovered]:underline">Back to the index</Link>
      </main>
    </div>
  )
  const scr = SCREENS[si]
  const feats = featuresOn(id)
  const from = def.from ? FEATURES[def.from] : undefined
  const Demo = def.Demo ?? from?.Demo
  const h = def.h ?? from?.h ?? 680
  return (
    <div className="min-h-screen bg-background">
      <KitBar screen={id} />
      <main className="mx-auto max-w-[1440px] px-6 pb-16 pt-5">
        <div className="mb-4 flex items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href={href.index} data-nav="crumb-index" className="rounded outline-hidden data-[hovered]:text-foreground data-[hovered]:underline">Screens</Link>
              <ChevronRight className="size-3" /><span>Screen {si + 1} of {SCREENS.length}</span>
            </div>
            <h1 className="heading mt-2 text-2xl leading-tight" data-testid="screen-title">{scr.title}</h1>
            <p className="mt-1 max-w-[860px] text-base text-foreground/80" data-testid="screen-summary">{scr.summary}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge size="md" color="gray" type="pill-color" icon={<MonitorPlay />}>{feats.length ? `${feats.length} ${feats.length === 1 ? "feature" : "features"}` : "screen only"}</Badge>
            <span className="select-all font-mono text-2xs text-muted-foreground">UI ref: uikit#/screen/{scr.id}</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <UxNotes def={def} />
          {def.from && <div className="-mb-1 text-xs text-muted-foreground">Live demo of the screen, as shown on <Link href={href.feature(def.from)} className="font-mono underline-offset-2 data-[hovered]:underline">{def.from}</Link>.</div>}
          {Demo && <DemoBox key={id} h={h}><Demo /></DemoBox>}
        </div>
        <section className="mt-8" aria-label="Features on this screen">
          <h2 className="heading mb-2 flex items-baseline gap-2 text-xl">Features on this screen<span className="font-sans text-xs tabular-nums text-muted-foreground">{feats.length}</span></h2>
          {feats.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3" data-testid="screen-features">
              {feats.map((p) => (
                <Link key={p.slug} href={href.feature(p.slug)} data-feature-link={p.slug} className={cn(card, "group flex flex-col gap-1 p-4")}>
                  <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">{p.slug}</span><KindBadge kind={p.kind} /></span>
                  <span className="truncate text-sm text-foreground/85">{p.title}</span>
                  <span className="text-2xs text-muted-foreground">{p.group}</span>
                </Link>
              ))}
            </div>
          ) : <div className="rounded-xl px-4 py-5 text-sm text-muted-foreground" data-testid="screen-features-empty">No roadmap item covers this screen yet. It is specified here (demo + notes); add a roadmap item before building it.</div>}
        </section>
        <nav className="mt-8 flex gap-4" aria-label="Neighbouring screens">
          <ScreenCard s={si > 0 ? SCREENS[si - 1] : null} dir="prev" />
          <Link href={href.index} className={cn(card, "flex items-center px-5 text-sm")} data-nav="footer-index"><LayoutGrid className="mr-2 size-4" />Index</Link>
          <ScreenCard s={si < SCREENS.length - 1 ? SCREENS[si + 1] : null} dir="next" />
        </nav>
      </main>
    </div>
  )
}


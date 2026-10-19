import * as React from "react"
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, Moon, Sun, Shapes, MousePointerClick, Image as ImageIcon, Search, X, NotebookText } from "lucide-react"
import { Link } from "react-aria-components"
import { UNSAFE_PortalProvider } from "react-aria"
import { cn } from "@/lib/utils"
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle"
import { Badge } from "@/components/uui/Badge"
import { Kbd } from "@/components/app/ui"
import { SearchField, SearchFieldGroup, SearchFieldInput, SearchFieldClear } from "@/components/ui/searchfield"
import { Tabs, TabList, Tab } from "@/components/ui/tabs"
import { PAGES, GROUPS, pageIndex, type Page } from "./pages"
import { href } from "./router"
import { setTheme, useTheme } from "./theme"
import { FEATURES } from "@/features/registry"
import type { FeatureDef } from "@/features/types"

const navLink = "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground outline-hidden data-[hovered]:bg-accent data-[hovered]:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring [&_svg]:size-4"
const card = "rounded-xl border bg-card shadow-xs outline-hidden data-[hovered]:border-ring/50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring"

export function ThemeToggle() {
  const theme = useTheme()
  return (
    <ToggleButtonGroup selectionMode="single" disallowEmptySelection selectedKeys={[theme]} onSelectionChange={(k) => { const v = [...k][0]; if (v) setTheme(v as "b" | "b-dark") }}
      aria-label="Theme" className="gap-0.5 rounded-md bg-muted p-0.5 dark:bg-black/25" data-testid="theme-toggle">
      {([["b", Sun, "Light"], ["b-dark", Moon, "Dark"]] as const).map(([id, I, l]) => (
        <Toggle key={id} id={id} size="sm" aria-label={l} className="h-7 gap-1.5 px-2 text-xs text-muted-foreground data-[hovered]:bg-transparent data-[hovered]:text-foreground data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm dark:data-[selected]:bg-accent [&_svg]:size-3.5">
          <I />{l}
        </Toggle>
      ))}
    </ToggleButtonGroup>
  )
}

export function KitBar({ current }: { current?: string }) {
  const i = current ? pageIndex(current) : -1
  const prev = i > 0 ? PAGES[i - 1] : null, next = i >= 0 && i < PAGES.length - 1 ? PAGES[i + 1] : null
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-chrome/95 px-5 backdrop-blur">
      <Link href={href.index} className="flex items-center gap-2.5 rounded-md outline-hidden data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-xs"><BookOpen className="size-3.5" /></span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Photobooks</span>
        <span className="text-[13px] text-muted-foreground">UI kit</span>
      </Link>
      <span className="mx-2 h-5 w-px bg-border" />
      <Link href={href.index} className={navLink} data-nav="index"><LayoutGrid />Index</Link>
      <Link href={href.components} className={navLink} data-nav="components"><Shapes />Components</Link>
      <div className="ml-auto flex items-center gap-1.5">
        {i >= 0 && (
          <>
            {prev ? <Link href={href.feature(prev.slug)} className={navLink} data-nav="prev" aria-label={`Previous: ${prev.slug}`}><ChevronLeft /><span className="max-w-[200px] truncate font-mono text-xs">{prev.slug}</span></Link> : <span className={cn(navLink, "opacity-40")}><ChevronLeft />start</span>}
            <span className="tabular-nums text-xs text-muted-foreground" data-testid="page-counter">{i + 1} / {PAGES.length}</span>
            {next ? <Link href={href.feature(next.slug)} className={navLink} data-nav="next" aria-label={`Next: ${next.slug}`}><span className="max-w-[200px] truncate font-mono text-xs">{next.slug}</span><ChevronRight /></Link> : <span className={cn(navLink, "opacity-40")}>end<ChevronRight /></span>}
            <span className="mx-1.5 h-5 w-px bg-border" />
          </>
        )}
        <ThemeToggle />
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
type IndexState = { q: string; filter: Filter; collapsed: string[]; y: number; last?: string }
const IDX_KEY = "photobooks-kit-index"
let idxMemory: IndexState = { q: "", filter: "all", collapsed: [], y: 0 }
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

/* ------------------------------------------------------------------ index */
export function IndexPage() {
  const init = React.useMemo(loadIndex, [])
  const [q, setQ] = React.useState(init.q)
  const [filter, setFilter] = React.useState<Filter>(init.filter)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set(init.collapsed))

  React.useEffect(() => saveIndex({ q, filter, collapsed: [...collapsed] }), [q, filter, collapsed])
  // restore scroll position (and focus the last opened row) before paint
  React.useLayoutEffect(() => {
    window.scrollTo(0, init.y)
    if (init.last) document.querySelector<HTMLElement>(`[data-feature-link="${CSS.escape(init.last)}"]`)?.focus({ preventScroll: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
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
  const match = (p: Page) => (filter === "all" || p.kind === filter) && (!needle || `${p.slug} ${p.title}`.toLowerCase().includes(needle))
  const groups = GROUPS.map((g) => ({ ...g, shown: g.pages.filter(match) })).filter((g) => g.shown.length)
  const total = groups.reduce((n, g) => n + g.shown.length, 0)
  const toggle = (name: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(name)) n.delete(name); else n.add(name); return n })
  const allCollapsed = collapsed.size >= GROUPS.length
  const nInteractive = PAGES.filter((p) => p.kind === "interactive").length

  return (
    <div className="min-h-screen bg-background">
      <KitBar />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        <div className="flex items-end gap-8">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-2">Photobooks · UI/UX reference · style B</div>
            <h1 className="heading text-[34px] leading-tight">UI kit</h1>
            <p className="mt-2 max-w-[740px] text-[14.5px] leading-relaxed text-muted-foreground">
              Live UI/UX references for roadmap items that have a user interface: one page per item, named by the item slug, built on the ported JollyUI (React Aria) components with short UX notes. Scope and status live in the roadmap, not here.
            </p>
          </div>
          <dl className="grid shrink-0 grid-cols-3 gap-2 text-center">
            {([[PAGES.length, "pages"], [nInteractive, "interactive"], [PAGES.length - nInteractive, "static"]] as const).map(([n, l]) => (
              <div key={l} className="rounded-lg border bg-card px-4 py-2.5 shadow-xs"><dt className="heading text-2xl tabular-nums">{n}</dt><dd className="text-xs text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
        </div>
        <Link href={href.components} className={cn(card, "group mt-7 flex items-center gap-4 p-4")}>
          <span className="grid size-10 place-items-center rounded-lg border bg-background shadow-xs"><Shapes className="size-[18px]" /></span>
          <span className="min-w-0"><span className="block text-[14px] font-semibold">Components</span><span className="block text-[13px] text-muted-foreground">Every ported component: variants and states, light and dark theme</span></span>
          <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-data-[hovered]:translate-x-0.5" />
        </Link>

        <div className="sticky top-14 z-30 -mx-8 mt-8 flex items-center gap-3 border-b bg-background/95 px-8 py-3 backdrop-blur" data-testid="index-toolbar">
          <Tabs selectedKey={filter} onSelectionChange={(k) => setFilter(String(k) as Filter)}>
            <TabList aria-label="Filter by kind" data-testid="index-filter">
              {([["all", "All"], ["interactive", "Interactive"], ["static", "Static"]] as const).map(([id, l]) => (
                <Tab key={id} id={id}>{l}</Tab>
              ))}
            </TabList>
          </Tabs>
          <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(GROUPS.map((g) => g.name)))} data-testid="toggle-all"
            className="h-8 rounded-md px-2.5 text-[13px] text-muted-foreground outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite" data-testid="match-count">{needle || filter !== "all" ? `${total} of ${PAGES.length}` : ""}</span>
          <SearchField aria-label="Search pages by slug or title" value={q} onChange={setQ} className="w-80" data-testid="index-search">
            <SearchFieldGroup className="h-8 gap-1.5 px-2.5 py-0 shadow-xs data-[focus-within]:ring-offset-0">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <SearchFieldInput data-testid="index-search-input" placeholder="Search slug or title…" className="min-w-0 flex-1 bg-transparent px-0 py-0 text-[13px]" />
              {q ? <SearchFieldClear className="size-5 p-0.5"><X className="size-3.5" /></SearchFieldClear> : <Kbd className="shrink-0">/</Kbd>}
            </SearchFieldGroup>
          </SearchField>
        </div>

        {groups.map((g) => {
          const open = !!needle || !collapsed.has(g.name)
          const id = `g-${g.name.split(" ")[0]}`
          return (
            <section key={g.name} className="mt-8" data-group={g.name}>
              <h2 className="mb-2.5">
                <button type="button" onClick={() => toggle(g.name)} aria-expanded={open} aria-controls={id} disabled={!!needle} data-testid="group-toggle"
                  className="flex items-center gap-2 rounded-md py-0.5 pr-2 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default">
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                  <span className="heading text-[20px]">{g.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{g.shown.length === g.pages.length ? g.pages.length : `${g.shown.length} / ${g.pages.length}`}</span>
                </button>
              </h2>
              {open && (
                <div id={id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
                  {g.shown.map((p) => (
                    <Link key={p.slug} href={href.feature(p.slug)} data-feature-link={p.slug} onPress={() => saveIndex({ last: p.slug, y: Math.round(window.scrollY) })}
                      className={cn("grid grid-cols-[300px_1fr_auto] items-center gap-4 border-b px-4 py-2.5 outline-hidden last:border-b-0 data-[hovered]:bg-accent/40 data-[focus-visible]:bg-accent/60", init.last === p.slug && "bg-accent/25")}>
                      <span className="truncate font-mono text-[12.5px] font-medium">{p.slug}</span>
                      <span className="min-w-0 truncate text-[13px] text-foreground/85">{p.title}</span>
                      <KindBadge kind={p.kind} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )
        })}
        {total === 0 && (
          <div className="mt-12 text-center text-[13.5px] text-muted-foreground" data-testid="no-results">
            No pages match “{q}”. <button type="button" className="underline" onClick={() => { setQ(""); setFilter("all") }}>Clear search</button>
          </div>
        )}
        <footer className="mt-14 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
          Order and grouping follow <span className="font-mono">docs/roadmap.md</span>; items without UI are not part of the kit. Components: JollyUI (MIT) on React Aria Components (Apache-2.0). Photos: CC0, StockSnap.io. Shortcuts: <Kbd>/</Kbd> search, <Kbd>Esc</Kbd> clear, <Kbd>Alt</Kbd>+<Kbd>←</Kbd> <Kbd>→</Kbd> previous / next page.
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
      <div className="text-[12.5px] leading-relaxed text-foreground/90 [&_b]:font-semibold">{children}</div>
    </div>
  )
}
/** Compact, collapsible UX notes above the demo (the demo always gets the full width). */
export function UxNotes({ def }: { def: FeatureDef }) {
  const n = def.notes
  const [open, setOpen] = useNotesOpen()
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-label="UX notes" data-testid="ux-notes" data-open={open}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="notes-toggle"
        className="flex w-full items-center gap-2 px-4 py-2 text-left outline-hidden hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <NotebookText className="size-4 text-muted-foreground" />
        <span className="text-[13px] font-semibold">UX notes</span>
        {!open && <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">{n.what}</span>}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className={cn("grid gap-x-6 gap-y-3 border-t px-4 pb-3.5 pt-3", n.keys?.length ? "grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.15fr)_minmax(0,1.35fr)]" : "grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)]")} data-testid="notes-body">
          <NoteCol title="What">{n.what}</NoteCol>
          <NoteCol title="Where">{n.where}</NoteCol>
          <NoteCol title="Why">{n.why}</NoteCol>
          {!!n.keys?.length && <NoteCol title="Keys">
            {n.keys?.length ? (
              <div className="flex flex-col gap-1">
                {n.keys.map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="flex shrink-0 flex-wrap gap-0.5">{k.split(" ").map((x, j) => <Kbd key={j}>{x}</Kbd>)}</span>
                    <span className="text-[12px] text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </NoteCol>}
          <NoteCol title="Edge cases">
            {n.edge?.length ? <ul className="ml-4 list-disc space-y-0.5 text-[12px] marker:text-muted-foreground">{n.edge.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="text-muted-foreground">—</span>}
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
        <span className="block text-[11px] text-muted-foreground">{dir === "prev" ? "Previous" : "Next"} · {page.group}</span>
        <span className="block truncate font-mono text-[13px] font-medium">{page.slug}</span>
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
    <section ref={ref} className={cn("kit-demo relative isolate overflow-hidden rounded-xl border bg-chrome shadow-sm [transform:translateZ(0)]", className)} style={auto ? undefined : { height: h ?? 640 }} data-testid="demo">
      {ready && <UNSAFE_PortalProvider getContainer={() => ref.current}>{children}</UNSAFE_PortalProvider>}
    </section>
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
        <p className="mt-2 text-[13px] text-muted-foreground">The kit only covers roadmap items with real UI/UX.</p>
        <Link href={href.index} className="mt-4 inline-block text-[13px] underline">Back to the index</Link>
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
              <ChevronRight className="size-3" /><span>{page.group}</span>
            </div>
            <h1 className="mt-1.5 font-mono text-[24px] font-semibold leading-tight tracking-[-0.01em]" data-testid="feature-title">{page.slug}</h1>
            <p className="heading mt-0.5 text-[17px] text-foreground/85" data-testid="feature-subtitle">{page.title}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <KindBadge kind={page.kind} size="md" />
            <span className="select-all font-mono text-[11px] text-muted-foreground" title="Reference this page from a roadmap item">UI ref: uikit#/feature/{page.slug}</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <UxNotes def={def} />
          <DemoBox auto={def.auto} h={def.h}><Demo /></DemoBox>
        </div>
        <nav className="mt-8 flex gap-4" aria-label="Neighbouring pages">
          <PrevNextCard page={idx > 0 ? PAGES[idx - 1] : null} dir="prev" />
          <Link href={href.index} className={cn(card, "flex items-center px-5 text-[13px]")} data-nav="footer-index"><LayoutGrid className="mr-2 size-4" />Index</Link>
          <PrevNextCard page={idx < PAGES.length - 1 ? PAGES[idx + 1] : null} dir="next" />
        </nav>
      </main>
    </div>
  )
}

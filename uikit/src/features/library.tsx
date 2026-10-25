/* v6 (F5/F7 port): welcome → library. Grayscale, tone-only surfaces, primary buttons are text only.
   Demo photos live in public/photos/hi; their attribution is kit chrome (#/credits, built from PHOTO-CREDITS.md), never part of the screen design. */
import { PhotoCaption } from "@/kit/Credits"
import * as React from "react"
import { Search, ChevronDown, BookOpen, Folder, Settings, HardDrive, MoreHorizontal, FolderOpen, Pencil, Copy, Trash2, Info, FolderSync } from "lucide-react"
import { Button as AriaButton } from "react-aria-components"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { TextField, Input } from "@/components/ui/textfield"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { AlertDialog, IconButton } from "@/components/app/ui"
import { P } from "@/data"
import { FolderPicker } from "./screens"
import { CreateBookDialog } from "./create-book"

export const hiPhoto = (id: string) => `photos/hi/${id}.jpg`
const serif = { fontFamily: "var(--font-heading)" } as const

const CSS = `
@keyframes lib-drift { from { transform: scale(1.03) translate(0,0) } to { transform: scale(1.09) translate(-1.2%,-.6%) } }
@keyframes lib-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
.lib-rise { animation: lib-rise 1s cubic-bezier(.2,.7,.2,1) both }
.lib-book { outline: none }
.lib-book .lib-obj { transition: filter .35s cubic-bezier(.2,.7,.2,1) }
.lib-book:hover .lib-obj { filter: drop-shadow(0 18px 18px rgb(35 34 35 / .28)) }
.lib-book:hover .lib-floor { opacity: 1 }
.lib-floor { opacity: 0; transition: opacity .35s }
.lib-book:focus-visible .lib-obj { outline: 2px solid #3A3839; outline-offset: 4px; border-radius: 4px }
@media (prefers-reduced-motion: reduce) { .lib-rise, .lib-drift { animation: none !important } .lib-book .lib-obj, .lib-floor { transition: none } }
`
export const LibStyle = () => <style>{CSS}</style>

export type Fmt = "portrait" | "landscape" | "square"
const RATIO: Record<Fmt, number> = { portrait: 4 / 5, landscape: 5 / 4, square: 1 }

/** A finished-book object: full-bleed cover photo, spine shading, page block, Lora italic title + spaced-caps subtitle. */
export function BookObject({ src, pos = "50% 50%", title, sub, fmt = "portrait", h, ink = "#2E2C2D", place = "top" }: { src?: string; pos?: string; title: string; sub?: string; fmt?: Fmt; h: number; ink?: string; place?: "top" | "bottom" }) {
  const w = h * RATIO[fmt]
  const s = h / 540
  return (
    <div className="relative" style={{ width: w, height: h }} data-testid="book-object" data-format={fmt}>
      <div className="absolute rounded-r-[3px]" style={{ top: 6 * s + 2, bottom: 6 * s + 2, left: 10 * s, right: -Math.max(4, 7 * s), background: "repeating-linear-gradient(90deg,#F4F4F4 0 1px,#DBDBDB 1px 2px)", boxShadow: `0 ${40 * s}px ${60 * s}px -${36 * s}px rgb(35 34 35/.55)` }} />
      <div className="absolute inset-0 overflow-hidden rounded-[2px_4px_4px_2px]" style={{ background: "#E8E8E8", boxShadow: `0 1px 2px rgb(35 34 35/.25), 0 ${30 * s}px ${60 * s}px -${30 * s}px rgb(35 34 35/.6)` }}>
        {src && <div className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${src})`, backgroundPosition: pos }} />}
        <div className="absolute inset-y-0 left-0" style={{ width: Math.max(8, 18 * s), background: "linear-gradient(90deg, rgb(0 0 0/.28), rgb(0 0 0/.06) 45%, rgb(255 255 255/.28) 70%, rgb(0 0 0/.05))" }} />
        <div className="absolute inset-x-0 px-3 text-center" style={{ color: ink, [place]: "9%" } as React.CSSProperties}>
          <div className="leading-none tracking-[-0.02em]" style={{ ...serif, fontSize: Math.round(Math.min(w, h) * .14) }}><em>{title}</em></div>
          {sub && <div className="uppercase" style={{ marginTop: "0.6em", fontSize: Math.max(8, Math.round(h * .022)), letterSpacing: "0.3em" }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

export function Mark() {
  return <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground"><div className="grid size-6 place-items-center rounded-md bg-field text-foreground"><BookOpen className="size-3.5" /></div>Photobooks</div>
}

const big = "h-12 rounded-full px-7 text-md shadow-ink"

/** Welcome: the only first-run screen. One text-only primary action opens the folder picker. */
export function WelcomeScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden text-foreground" style={{ background: "linear-gradient(180deg,#E1E1E1 0%,#D9D9D9 55%,#C8CACB 100%)" }} data-testid="welcome">
      <LibStyle />
      <div className="absolute inset-y-0 left-[33%] right-0 overflow-hidden" style={{ WebkitMaskImage: "linear-gradient(90deg,transparent 0%,rgb(0 0 0/.35) 22%,#000 46%)", maskImage: "linear-gradient(90deg,transparent 0%,rgb(0 0 0/.35) 22%,#000 46%)" }}>
        <div className="lib-drift absolute inset-0 bg-cover" style={{ backgroundImage: `url(${hiPhoto("c18")})`, backgroundPosition: "74% 62%", animation: "lib-drift 34s ease-in-out infinite alternate", transformOrigin: "80% 60%" }} />
      </div>
      <header className="absolute inset-x-0 top-0 flex items-center px-14 py-9"><Mark /></header>
      <div className="absolute left-14 top-1/2 w-[min(780px,46%)] -translate-y-1/2">
        <div className="lib-rise text-xs uppercase tracking-[0.22em] text-muted-foreground">Welcome to Photobooks</div>
        <h1 className="lib-rise mt-5 leading-[0.94] tracking-[-0.04em]" style={{ ...serif, fontSize: "clamp(56px, 6.3vw, 112px)", animationDelay: ".1s" }}>A quiet place<br /><em>for your books.</em></h1>
        <p className="lib-rise mt-7 max-w-[440px] text-lead leading-7 text-muted-foreground" style={{ animationDelay: ".25s" }}>One folder on your disk where all your books are saved — your library. Choose where it lives.</p>
        <div className="lib-rise mt-10" style={{ animationDelay: ".4s" }}><Button className={big} onPress={onCreate} data-testid="create-library">Create Library</Button></div>
        <p className="lib-rise mt-4 pl-1 text-sm text-muted-foreground" style={{ animationDelay: ".5s" }}>You’ll choose a folder on your disk.</p>
      </div>
      {/* v0.9 §1: approved caption — plain text, top-right over the photo, no capsule */}
      <PhotoCaption id="c18" testid="screen-credit" className="absolute top-6 right-6" />
    </div>
  )
}

/** Library top bar: brand · library location + Change · settings. */
export function LibraryBar({ path, missing, onChange, tools, onSettings }: { path: string; missing?: boolean; onChange: () => void; tools?: React.ReactNode; onSettings?: () => void }) {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-6 bg-chrome px-6" data-testid="library-bar">
      <Mark />
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" data-testid="library-card">
        {missing ? <HardDrive className="size-4 shrink-0 text-warning" /> : <Folder className="size-4 shrink-0" />}
        <span className="truncate font-mono text-xs text-foreground" title={path} data-testid="library-path">{path}</span>
        {missing && <span className="font-medium text-warning-fg">· folder not found</span>}
        <Button variant="ghost" size="xs" className="h-6 rounded-full px-2.5 text-sm font-medium text-muted-foreground data-[hovered]:bg-field data-[hovered]:text-foreground" onPress={onChange} data-testid="change-library">Change library folder…</Button>
      </div>
      <div className="ml-auto flex items-center gap-2.5">{tools}<IconButton label="Settings" data-testid="home-settings" onPress={onSettings}><Settings /></IconButton></div>
    </header>
  )
}

/** Empty library: an example finished book + one text-only action. */
export function LibraryEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative flex min-h-[520px] flex-1 items-center justify-center px-10 pb-10" style={{ gap: "clamp(48px, 6vw, 110px)" }} data-testid="home-empty">
      <figure className="lib-rise shrink-0" aria-label="Example book" data-testid="example-book">
        <BookObject src={hiPhoto("c18b")} pos="60% 55%" title="Fog" sub="Autumn · 2025" h={440} />
        <figcaption className="mt-6 flex items-baseline gap-x-3 text-2xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>Example</span>
          <PhotoCaption id="c18b" testid="screen-credit" className="normal-case tracking-normal" />
        </figcaption>
      </figure>
      <div className="lib-rise max-w-[420px]" style={{ animationDelay: ".15s" }}>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Your library is ready</div>
        <h1 className="mt-4 text-[clamp(44px,4vw,64px)] leading-[0.98] tracking-[-0.035em]" style={serif}>Your first story<br /><em>starts here.</em></h1>
        <p className="mt-5 max-w-[380px] text-subhead leading-7 text-muted-foreground [text-wrap:pretty]">Create a book, then add a folder of photos in the editor and arrange the spreads your way.</p>
        <Button className={cn(big, "mt-8")} onPress={onCreate} data-testid="new-book">Create book</Button>
      </div>
    </div>
  )
}

export type SortKey = "edited" | "title" | "created"
const SORTS: { id: SortKey; label: string }[] = [{ id: "edited", label: "Last edited" }, { id: "title", label: "Title" }, { id: "created", label: "Created" }]
/* v6.1 quiet controls: #D7D7D7 field on #E1E1E1 chrome — tone only, no border, no black */
const quiet = "h-9 rounded-full bg-field text-sm text-foreground outline-hidden transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3A3839]"
export function LibSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className={cn(quiet, "flex w-56 items-center gap-2 px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#3A3839]")} data-testid="lib-search">
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onChange("") }} placeholder="Search books" aria-label="Search books by title" className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" data-testid="lib-search-input" />
    </label>
  )
}
export function LibSort({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const cur = SORTS.find((x) => x.id === value)!
  return (
    <MenuTrigger>
      <AriaButton className={cn(quiet, "inline-flex cursor-default items-center gap-1.5 px-3.5 data-[hovered]:bg-accent data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-[#3A3839]")} aria-label={`Sort books: ${cur.label}`} data-testid="lib-sort">
        <span className="text-muted-foreground">Sort:</span> {cur.label}<ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </AriaButton>
      <MenuPopover placement="bottom end" className="min-w-44">
        <Menu selectionMode="single" selectedKeys={[value]} onAction={(k) => onChange(k as SortKey)} data-testid="lib-sort-menu">
          {SORTS.map((x) => <MenuItem key={x.id} id={x.id} textValue={x.label}>{x.label}</MenuItem>)}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
}
export type LibBook = { id: string; src?: string; pos?: string; title: string; sub?: string; fmt: Fmt; spreads: number; edited: string; created?: number; ink?: string; place?: "top" | "bottom"; status?: "published" }
export const LIB_BOOKS: LibBook[] = [
  { id: "l1", created: 3, src: hiPhoto("c13"), pos: "30% 40%", title: "Börnste", sub: "Morning fog · 2021", fmt: "portrait", spreads: 24, edited: "2 hours ago" },
  { id: "l2", created: 6, src: hiPhoto("r2"), title: "Zoutelande", sub: "North Sea · 2022", fmt: "landscape", spreads: 16, edited: "yesterday", ink: "#F5F5F5", place: "bottom", status: "published" },
  { id: "l3", created: 1, src: hiPhoto("x-tatra"), pos: "45% 50%", title: "Czorsztyn", sub: "April mist · 2018", fmt: "portrait", spreads: 12, edited: "Oct 18" },
  { id: "l4", created: 8, src: hiPhoto("r7"), pos: "40% 50%", title: "Les Arcs", sub: "Winter · 2024", fmt: "square", spreads: 20, edited: "Oct 9", ink: "#F5F5F5", place: "bottom" },
  { id: "l5", created: 2, src: hiPhoto("c25"), pos: "40% 50%", title: "Komargorod", sub: "The pond", fmt: "portrait", spreads: 10, edited: "Sep 30" },
  { id: "l6", created: 5, src: hiPhoto("r8"), pos: "50% 55%", title: "Santorini", sub: "Summer · 2017", fmt: "landscape", spreads: 18, edited: "Sep 12" },
  { id: "l7", created: 4, src: hiPhoto("r6"), pos: "55% 50%", title: "Brzeźnica", sub: "Sunrise", fmt: "portrait", spreads: 10, edited: "Aug 27", ink: "#F5F5F5", place: "bottom" },
  { id: "l8", created: 7, src: hiPhoto("x-valley"), pos: "35% 50%", title: "Synevyr", sub: "Valley · 2021", fmt: "portrait", spreads: 14, edited: "Aug 3", ink: "#F5F5F5" },
]
/** Photo ids used by the demo library screens — listed on the kit credits page. */
export const LIB_PHOTO_IDS = ["c18", "c18b", "c13", "r2", "x-tatra", "r7", "c25", "r8", "r6", "x-valley"]
const OTHER: Record<string, LibBook[]> = {
  "~/Pictures/Family": [
    { id: "f1", src: P("p15").src, title: "Grandma’s 80th", sub: "March · 2025", fmt: "portrait", spreads: 14, edited: "Mar 3", ink: "#F5F5F5" },
    { id: "f2", src: P("p19").src, title: "Kids", sub: "2024", fmt: "landscape", spreads: 20, edited: "Jan 12", ink: "#F5F5F5", place: "bottom" },
  ],
}
export const LIBRARY_PATH = "~/Pictures/Photobooks"

export function BookTile({ b, H = 236, onOpen, menu, title }: { b: LibBook; H?: number; onOpen?: () => void; menu?: React.ReactNode; title?: React.ReactNode }) {
  return (
    <div className="group pt-8" data-testid="book-card">
      <button type="button" onClick={onOpen} className="lib-book block w-full cursor-pointer" aria-label={`Open ${b.title}, ${b.spreads * 2} pages`} data-testid="book-cover">
        <div className="relative flex items-end justify-center" style={{ height: H + 12 }}>
          <div className="lib-floor pointer-events-none absolute bottom-[-6px] left-1/2 h-6 w-[70%] -translate-x-1/2 rounded-[50%]" style={{ background: "radial-gradient(closest-side, rgb(35 34 35/.22), transparent)" }} />
          <div className="lib-obj relative"><BookObject src={b.src} pos={b.pos} title={b.title} sub={b.sub} fmt={b.fmt} h={b.fmt === "portrait" ? H : b.fmt === "square" ? H * .86 : H * .74} ink={b.ink} place={b.place} />
            {b.status === "published" && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-field/90 px-1.5 py-0.5 text-2xs font-medium leading-none text-foreground shadow-sm" data-testid="book-published"><span className="size-1.5 rounded-full bg-success" />Published</span>}
          </div>
        </div>
      </button>
      {/* v0.9.1 P2: "…" absolute right-0 on caption (= cover face right); title padded so it never collides */}
      <div className="relative mx-auto mt-5" style={{ width: (b.fmt === "portrait" ? H : b.fmt === "square" ? H * .86 : H * .74) * RATIO[b.fmt ?? "portrait"] }} data-testid="book-caption">
        <div className={cn("min-w-0", menu && "pr-8")} data-testid="book-title-row">
          {title ?? <div className="truncate text-left text-base font-medium text-foreground">{b.title}</div>}
        </div>
        <div className="mt-0.5 text-left text-xs tabular-nums text-muted-foreground" data-testid="book-meta">{b.spreads * 2} pages · edited {b.edited}</div>
        {menu && <div className="absolute right-0 top-0" data-testid="book-menu-slot">{menu}</div>}
      </div>
    </div>
  )
}

/** The library (Home): top bar with the folder + Change, then empty state, missing state or the book grid. */
export function HomeScreen({ empty = false, onOpenBook, banner, libState = "ok", initialPath = LIBRARY_PATH }: { empty?: boolean; onOpenBook?: (b: LibBook) => void; banner?: React.ReactNode; libState?: "ok" | "missing"; initialPath?: string }) {
  const [books, setBooks] = React.useState<LibBook[]>(empty ? [] : LIB_BOOKS)
  const [path, setPath] = React.useState(initialPath)
  const [state, setState] = React.useState(libState)
  const [changed, setChanged] = React.useState<string | null>(null)
  const [confirmChange, setConfirmChange] = React.useState(false)
  const [picking, setPicking] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<LibBook | null>(null)
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("edited")
  const shown = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const list = books.filter((b) => !q || b.title.toLocaleLowerCase().includes(q))
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === "created") return [...list].sort((a, b) => (b.created ?? 99) - (a.created ?? 99))
    return list // books are kept in last-edited order
  }, [books, query, sort])
  const lastRemoving = React.useRef<LibBook | null>(null)
  if (removing) lastRemoving.current = removing
  const switchTo = (p: string) => {
    setPicking(false)
    if (p === path) return
    const prev = path
    setPath(p); setState("ok")
    setBooks(p === initialPath ? (empty ? [] : LIB_BOOKS) : OTHER[p] ?? [])
    setChanged(prev)
  }
  const rename = (id: string, v: string) => { setBooks((x) => x.map((y) => (y.id === id ? { ...y, title: v || y.title } : y))); setRenaming(null) }
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-app text-foreground" data-testid="home">
      <LibStyle />
      <LibraryBar path={path} missing={state === "missing"} onChange={() => setConfirmChange(true)} tools={state === "ok" && books.length > 0 ? <><LibSearch value={query} onChange={setQuery} /><LibSort value={sort} onChange={setSort} /></> : null} />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ background: "radial-gradient(1200px 800px at 50% 30%, #D6D6D6, #C8CACB 75%)" }}>
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-12">
          {(banner || changed) && <div className="pt-6">
            {banner}
            {changed && (
              <div className="flex items-center gap-2 rounded-lg bg-chrome px-4 py-2 text-sm" role="status" data-testid="library-changed">
                <Info className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">Library folder is now <b className="font-semibold">{path}</b>. Books in <span className="font-mono text-xs">{changed}</span> are still there — switch back any time.</span>
                <Button variant="ghost" size="xs" className="px-3 text-xs" onPress={() => switchTo(changed)}>Switch back</Button>
              </div>
            )}
          </div>}
          <div className="flex items-end justify-between pb-2 pt-10">
            <div className="flex items-baseline gap-3"><h2 className="text-display leading-none tracking-[-0.025em]" style={serif}>Your books</h2>{(state === "missing" || books.length >= 1) && <span className="text-sm text-muted-foreground" data-testid="book-count">{state === "missing" ? "—" : `${books.length} ${books.length === 1 ? "book" : "books"}`}</span>}</div>
            {state === "ok" && books.length > 0 && <div className="flex items-center gap-2.5">
              <Button className="h-10 rounded-full px-6 text-base shadow-ink-sm" onPress={() => setCreating(true)} data-testid="new-book">Create book</Button>
            </div>}
          </div>
          {state === "missing" ? (
            <div className="mx-auto mt-16 flex max-w-[440px] flex-col items-center text-center" data-testid="library-missing">
              <FeaturedIcon size="xl" theme="soft" color="warning" className="mb-6"><HardDrive /></FeaturedIcon>
              <div className="heading text-xl">Can’t find your library folder</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground"><span className="font-mono text-xs">{path}</span> isn’t available. If it is on an external drive, connect the drive and try again. Nothing was deleted.</p>
              <div className="mt-5 flex gap-2"><Button size="md" className="rounded-full px-5" onPress={() => setState("ok")} data-testid="library-retry">Try again</Button><Button variant="outline" size="md" className="rounded-full px-5" onPress={() => setConfirmChange(true)}>Change folder…</Button></div>
            </div>
          ) : books.length === 0 ? (
            <LibraryEmpty onCreate={() => setCreating(true)} />
          ) : (
            shown.length === 0 ? (
            <div className="mt-20 text-center text-sm text-muted-foreground" data-testid="lib-no-results">No books match “{query.trim()}”. <button type="button" className="underline underline-offset-2" onClick={() => setQuery("")}>Clear search</button></div>
            ) :
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-10 gap-y-2 pb-12" data-testid="book-grid">
              {shown.map((b) => (
                <BookTile key={b.id} b={b} onOpen={() => onOpenBook?.(b)}
                  title={renaming === b.id ? (
                    <TextField aria-label="Book title" defaultValue={b.title} autoFocus onKeyDown={(e) => { if (e.key === "Enter") rename(b.id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setRenaming(null) }} onBlur={(e) => rename(b.id, (e.target as HTMLInputElement).value)}>
                      <Input className="h-7 w-full px-2 text-sm" data-testid="rename-input" />
                    </TextField>
                  ) : undefined}
                  menu={
                    <MenuTrigger>
                      <IconButton label="Book actions" size="sm" tooltip={false} className="size-8 reveal-on-hover opacity-0 group-hover:opacity-100 data-[focus-visible]:opacity-100 aria-expanded:opacity-100" data-testid="book-menu"><MoreHorizontal /></IconButton>
                      <MenuPopover placement="bottom end" className="w-44">
                        <Menu className="[&_svg]:size-4 [&_svg]:text-muted-foreground" onAction={(k) => { if (k === "open") onOpenBook?.(b); if (k === "rename") setRenaming(b.id); if (k === "dup") setBooks((x) => [{ ...b, id: `d${Date.now()}`, title: `${b.title} (copy)`, edited: "just now", status: undefined }, ...x]); if (k === "rm") setRemoving(b) }}>
                          <MenuItem id="open"><FolderOpen />Open</MenuItem>
                          <MenuItem id="rename"><Pencil />Rename</MenuItem><MenuItem id="dup"><Copy />Duplicate</MenuItem>
                          <MenuSeparator /><MenuItem id="rm" variant="destructive"><Trash2 />Remove…</MenuItem>
                        </Menu>
                      </MenuPopover>
                    </MenuTrigger>
                  } />
              ))}
            </div>
          )}
        </div>
      </main>
      <CreateBookDialog isOpen={creating} onCancel={() => setCreating(false)} onCreate={(ttl, book) => {
        const t0 = ttl.trim() || "Untitled book"
        const fmt = book.w === book.h ? "square" : book.w > book.h ? "landscape" : "portrait"
        setBooks((b) => [{ id: `n${Date.now()}`, title: t0, fmt, spreads: 10, edited: "just now" }, ...b]); setCreating(false)
      }} />
      <AlertDialog isOpen={!!removing} title={<>Remove “{(removing ?? lastRemoving.current)?.title}”?</>} confirmLabel="Remove book"
        onCancel={() => setRemoving(null)} onConfirm={() => { setBooks((x) => x.filter((y) => y.id !== removing!.id)); setRemoving(null) }}>
        The book is removed from your library folder. Photos stay on disk, untouched.
      </AlertDialog>
      <AlertDialog isOpen={confirmChange} tone="neutral" icon={<FolderSync />} title="Change the library folder?" confirmLabel="Choose folder…"
        onCancel={() => setConfirmChange(false)} onConfirm={() => { setConfirmChange(false); setPicking(true) }}>
        Photobooks works with one library at a time. Your books stay in <span className="font-mono text-sm text-foreground/80">{path}</span> — nothing is moved or deleted. Pick another folder to use it as the library (an empty folder starts a new one). Change it back to see these books again.
      </AlertDialog>
      <FolderPickerLazy isOpen={picking} onCancel={() => setPicking(false)} onPick={switchTo} />
    </div>
  )
}

function FolderPickerLazy(p: { isOpen: boolean; onPick: (path: string) => void; onCancel: () => void }) { return <FolderPicker {...p} title="Choose the library folder" /> }

/** First run: Welcome → system folder picker → empty library. */
export function FirstRun() {
  const [stage, setStage] = React.useState<"welcome" | "picker" | "home">("welcome")
  const [path, setPath] = React.useState(LIBRARY_PATH)
  if (stage === "home") return <HomeScreen empty initialPath={path} />
  return (
    <>
      <WelcomeScreen onCreate={() => setStage("picker")} />
      <FolderPicker isOpen={stage === "picker"} title="Choose where your library lives" onCancel={() => setStage("welcome")} onPick={(p) => { setPath(p); setStage("home") }} />
    </>
  )
}

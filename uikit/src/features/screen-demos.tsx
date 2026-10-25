/* Kit v4: screen-level demos and notes (#/screen/<id>). A screen either reuses its most representative feature demo
   (`from`) or has its own full demo (first run, Home, Settings, Unsupported browser). */
import * as React from "react"
import { Link as AriaLink } from "react-aria-components"
import {
  BookOpen, HardDrive, FolderOpen, FolderSync, Globe, Printer, KeyRound, ExternalLink, Copy, Check, Info,
  MonitorSmartphone, ShieldOff, RotateCw, AppWindow, Image as ImageIcon, Sparkles, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Badge } from "@/components/uui/Badge"
import { Segmented } from "@/components/app/controls"
import { AlertDialog } from "@/components/app/ui"
import { Scenarios } from "./parts"
import { makeDoc, SAMPLE_BOOK } from "@/sandbox/model"
import type { Node, Book } from "@/sandbox/store"
import { Std } from "./parts"
import { setInspectorOpen } from "@/sandbox/inspectorState"

/** v0.7.1: ONE editor — the sandbox studio (all v0.5.3 features) in the v0.7 design. Each scenario = its own initial state (keyed remount). */
type EInit = { node?: Node; mode?: "pages" | "masters"; book?: Partial<Book>; cur?: number; pick?: number }
const BOOK_DEMO: Partial<Book> = { w: 14.8, h: 21, preset: "A5" }
const E7: [string, string, EInit][] = [
  ["photo", "Photo", { cur: 2, pick: 0 }], ["cover", "Cover", { node: { k: "cover" } }], ["endpaper", "Endpaper", { node: { k: "endpaper", w: "front" } }],
  ["masters", "Masters", { mode: "masters", node: { k: "master", id: "A" } }], ["book", "Book settings", { node: { k: "book" }, cur: 1 }],
  ["landscape", "Landscape book", { node: { k: "book" }, cur: 1, book: { w: 29.7, h: 21, preset: "A4" } }], ["none", "Nothing selected", { node: { k: "none" }, cur: 1 }],
]
const FULL = { handles: true, swap: true, drop: true, multiDrop: true, crop: true, multi: true, marquee: true, textEdit: true }
const demoDoc = () => makeDoc([...SAMPLE_BOOK, SAMPLE_BOOK[3], SAMPLE_BOOK[5]])
function EditorScreen() {
  const [v, setV] = React.useState("photo")
  const i = E7.find((x) => x[0] === v)![2]
  React.useEffect(() => { setInspectorOpen(true) }, [v]) // each scenario starts with all panels open (inspector state is shared/persisted)
  return <div className="flex h-full flex-col" data-scenario={v}><Scenarios items={E7.map(([id, l]) => [id, l])} value={v} onChange={setV} />
    <div className="min-h-0 flex-1"><Std key={v} init={demoDoc} features={FULL} cur={i.cur ?? 1} pick={i.pick} node={i.node} mode={i.mode} book={{ ...BOOK_DEMO, ...i.book }} /></div></div>
}
import { FolderPicker, LIBRARY } from "./screens"
import { HomeScreen, FirstRun } from "./library"
import type { Notes } from "./types"
import { useTheme } from "@/kit/theme"

export type ScreenDef = { Demo?: React.ComponentType; from?: string; notes: Notes; h?: number }

/* ---------------------------------------------------------------- first run → library folder → empty library (v6: ./library) */

/* ---------------------------------------------------------------- settings */
const SECTIONS = [["library", "Library", HardDrive], ["hosting", "Hosting", KeyRound], ["site", "Site", Globe], ["print", "Print presets", Printer], ["interface", "Interface", SlidersHorizontal]] as const
export function SettingsScreen(props: { bookCount?: number; libraryPath?: string } = {}) {
  const { bookCount, libraryPath } = props
  const [sec, setSec] = React.useState<string>("library")
  const [path, setPath] = React.useState(libraryPath ?? LIBRARY.path)
  const [confirm, setConfirm] = React.useState(false)
  const [pick, setPick] = React.useState(false)
  const [prev, setPrev] = React.useState<string | null>(null)
  React.useEffect(() => { if (libraryPath) setPath(libraryPath) }, [libraryPath])
  const booksLive = bookCount ?? (path === LIBRARY.path ? LIBRARY.books : 0)
  const row = "flex min-h-13 items-center gap-4 px-4 py-2" // v0.9.1: no card border; tone via chrome surface only
  const rule = <div className="mx-4 h-px shrink-0" style={{ background: "rgb(0 0 0 / 0.06)" }} aria-hidden />
  return (
    <div className="grid h-full grid-cols-[220px_1fr] bg-background" data-testid="settings">
      <nav className="flex flex-col gap-0.5 border-r bg-chrome p-3">
        <div className="mb-3 flex items-center gap-2 px-2 pt-1"><div className="grid size-6 place-items-center rounded-md bg-field text-foreground"><BookOpen className="size-3" /></div><span className="text-base font-semibold">Settings</span></div>
        {SECTIONS.map(([id, l, I]) => (
          <button key={id} type="button" aria-current={sec === id ? "page" : undefined} onClick={() => setSec(id)} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring", sec === id && "bg-accent font-medium")}><I className="size-4 text-muted-foreground" />{l}</button>
        ))}
      </nav>
      <main className="min-h-0 overflow-auto px-8 py-6">
        <h1 className="heading text-2xl">{SECTIONS.find((s) => s[0] === sec)![1]}</h1>
        {sec === "library" ? (
          <>
            <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">Photobooks keeps every book in one folder on your disk — your library. To use a different library, change the folder.</p>
            <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="library-settings">
              <div className={row}>
                <FeaturedIcon color="gray" theme="outline" size="md"><HardDrive /></FeaturedIcon>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">Library folder</div><div className="truncate font-mono text-xs text-muted-foreground" data-testid="library-path">{path}</div></div>
                <Button variant="outline" size="sm" className="gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-4" onPress={() => setConfirm(true)} data-testid="change-library"><FolderSync />Change library folder…</Button>
              </div>
              {rule}
              <div className={row}><div className="min-w-0 flex-1 text-sm">Books</div><span className="text-sm tabular-nums text-muted-foreground" data-testid="settings-book-count">{booksLive}</span></div>
              {rule}
              <div className={row}><div className="min-w-0 flex-1 text-sm">Folder access</div><Badge color="success" dot>Allowed · read and write</Badge></div>
              {rule}
              <div className={row}><div className="min-w-0 flex-1 text-sm">Preview cache<div className="text-xs text-muted-foreground">Rebuilt automatically if cleared</div></div><span className="text-sm tabular-nums text-muted-foreground">212 MB</span></div>
            </div>
            {prev && <div className="mt-4 flex max-w-[640px] items-center gap-2 rounded-lg bg-chrome px-4 py-2 text-sm" role="status" data-testid="library-changed"><Info className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1">Now using <b className="font-semibold">{path}</b>. Your books in <span className="font-mono text-xs">{prev}</span> were not moved.</span><Button variant="ghost" size="xs" className="px-3 text-xs" onPress={() => { setPath(prev); setPrev(null) }}>Switch back</Button></div>}
          </>
        ) : (
          <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome">
            {(sec === "hosting" ? [["Provider", "Cloudflare R2 + Pages"], ["Account", "aleksandr.photos"], ["Token", "Scoped to one bucket · stored on this computer"]]
              : sec === "site" ? [["Site title", "Aleksandr’s photobooks"], ["Author", "Aleksandr Basov"]]
              : sec === "print" ? [["Default profile", "Saal Digital · 30×30 layflat"], ["Custom profiles", "2"], ["Home printer", "A4 duplex · short edge"]]
              : [["Units", "Millimetres"], ["Thumbnail size", "96 px"], ["Density", "Comfortable"]]).map(([k, v], i, arr) => (
              <React.Fragment key={k}>
                {i > 0 && rule}
                <div className={row}><div className="min-w-0 flex-1 text-sm">{k}</div><span className="text-sm text-muted-foreground">{v}</span></div>
              </React.Fragment>
            ))}
          </div>
        )}
      </main>
      <AlertDialog isOpen={confirm} tone="neutral" icon={<FolderSync />} title="Change the library folder?" confirmLabel="Choose folder…" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setPick(true) }}>
        Your books stay in <span className="font-mono text-sm text-foreground/80">{path}</span> — nothing is moved or deleted. Photobooks will show the books in the folder you pick instead (an empty folder starts a new library). Change it back any time to see these books again.
      </AlertDialog>
      <FolderPicker isOpen={pick} title="Choose the library folder" onCancel={() => setPick(false)} onPick={(p) => { setPick(false); if (p !== path) { setPrev(path); setPath(p) } }} />
    </div>
  )
}

/* ---------------------------------------------------------------- unsupported browser */
export const CHROMIUM_BROWSERS: { name: string; url: string; note?: string }[] = [
  { name: "Microsoft Edge", url: "https://www.microsoft.com/edge" },
  { name: "Brave", url: "https://brave.com/download/", note: "turn on brave://flags/#file-system-access-api" },
  { name: "Arc", url: "https://arc.net/" },
  { name: "Opera", url: "https://www.opera.com/" },
  { name: "Vivaldi", url: "https://vivaldi.com/" },
]
const CHROME_URL = "https://www.google.com/chrome/"
const extLink = "inline-flex items-center gap-1.5 rounded outline-hidden data-[hovered]:underline data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring"
function CopyLink({ className }: { className?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button variant="outline" size="lg" className={cn(" gap-1.5 px-4 shadow-xs [&_svg]:size-4", className)} data-testid="copy-link"
   onPress={() => { navigator.clipboard?.writeText("https://photobooks.app/").catch(() => { }); setDone(true); setTimeout(() => setDone(false), 1800) }}>
      {done ? <Check /> : <Copy />}{done ? "Link copied" : "Copy link"}
    </Button>
  )
}
function Unsupported({ variant }: { variant: "other" | "no-api" | "mobile" }) {
  const mobile = variant === "mobile"
  const title = variant === "no-api" ? "Folder access is turned off in this browser" : mobile ? "Photobooks needs a desktop computer" : "This browser isn’t supported"
  const body = variant === "no-api"
    ? <>This is a Chromium browser, but direct folder access (the File System Access API) isn’t available here. It may be switched off by a browser flag or by your organisation, or the page isn’t opened over a secure connection.</>
    : mobile
      ? <>Photobooks edits books and photos right in folders on your disk. Phones and tablets — Chrome on Android and every browser on iPhone and iPad — can’t give a website that kind of folder access.</>
      : <>Photobooks saves your books straight into a folder on your disk and reads photos from their folders. That needs direct folder access (the File System Access API), which only Chromium-based desktop browsers have. You’re using <b className="font-semibold text-foreground">Firefox</b>.</>
  return (
    <div className={cn("flex w-full flex-col", mobile ? "px-5 py-6" : "max-w-[560px]")} data-testid="unsupported">
      <FeaturedIcon size={mobile ? "lg" : "xl"} theme="soft" color="warning" className="mb-5">{variant === "no-api" ? <ShieldOff /> : mobile ? <MonitorSmartphone /> : <AppWindow />}</FeaturedIcon>
      <h1 className={cn("heading leading-tight", mobile ? "text-xl" : "text-2xl")} data-testid="unsupported-title">{title}</h1>
      <p className={cn("mt-2 leading-relaxed text-muted-foreground", mobile ? "text-sm" : "text-base")}>{body}</p>
      {mobile ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Open it on a Mac, Windows or Linux computer in <b className="font-semibold text-foreground">Google Chrome</b>, Edge or another Chromium browser.</p>
          <CopyLink className="mt-5 w-full" />
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Published Photobooks sites open on any phone — only the editor needs a computer.</p>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {variant === "no-api" && <Button size="lg" className="gap-1.5 px-4 shadow-sm [&_svg]:size-4">Reload after turning it on</Button>}
            <AriaLink href={CHROME_URL} target="_blank" rel="noopener noreferrer" data-testid="get-chrome" className={cn(buttonVariants({ variant: variant === "no-api" ? "outline" : "default", size: "sm" }), "h-10 gap-1.5 px-4 shadow-sm [&_svg]:size-4")}>Get Google Chrome<ExternalLink /></AriaLink>
            {variant === "other" && <CopyLink />}
          </div>
          <div className="mt-7 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">{variant === "no-api" ? "Turn folder access back on" : "Other Chromium browsers work too"}</div>
            {variant === "no-api" ? (
              <ul className="space-y-1.5 px-4 py-3 text-sm leading-relaxed">
                <li><b className="font-semibold">Brave:</b> open <span className="font-mono text-xs">brave://flags/#file-system-access-api</span>, set it to Enabled, relaunch.</li>
                <li><b className="font-semibold">Managed computer:</b> ask your admin to allow <span className="font-mono text-xs">FileSystemAccess</span> for this site.</li>
                <li><b className="font-semibold">Embedded or http:</b> open <span className="font-mono text-xs">https://photobooks.app</span> directly in a tab.</li>
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3" data-testid="browser-list">
                {CHROMIUM_BROWSERS.map((b) => (
                  <li key={b.name} className="min-w-0 text-sm"><AriaLink href={b.url} target="_blank" rel="noopener noreferrer" className={extLink}>{b.name}<ExternalLink className="size-3 text-muted-foreground" /></AriaLink>{b.note && <span className="block truncate text-2xs text-muted-foreground">{b.note}</span>}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Nothing is uploaded — Photobooks runs entirely in your browser, on your own folders. Published Photobooks sites open in every browser.</p>
        </>
      )}
    </div>
  )
}
function UnsupportedBrowser() {
  const [v, setV] = React.useState("other")
  return (
    <div className="flex h-full flex-col">
      <Scenarios items={[["other", "Firefox / Safari"], ["no-api", "Chromium, API off"], ["mobile", "Phone / tablet"]]} value={v} onChange={setV} />
      <div className="relative min-h-0 flex-1 overflow-auto bg-background text-foreground" data-testid="unsupported-stage">
        <div className="absolute left-5 top-4 flex items-center gap-2"><div className="grid size-6 place-items-center rounded-md bg-field text-foreground"><BookOpen className="size-3" /></div><span className="text-base font-semibold">Photobooks</span></div>
        {v === "mobile" ? (
          <div className="grid min-h-full place-items-center py-10">
            <div data-allow-border="device bezel" className="h-[520px] w-[300px] overflow-hidden rounded-device border-[6px] border-neutral-800 bg-background shadow-lg"><div className="mx-auto mt-1.5 h-4 w-24 rounded-full bg-neutral-800" /><Unsupported variant="mobile" /></div>
          </div>
        ) : (
          <div className="grid min-h-full place-items-center px-8 py-14"><Unsupported variant={v as "other" | "no-api"} /></div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- registry: screen id (src/kit/screens.json) → demo + notes */
export const SCREEN_DEFS: Record<string, ScreenDef> = {
  "first-run": {
    Demo: FirstRun,
    h: 760,
    notes: {
      what: "One welcome screen — overline “Welcome to Photobooks”, “A quiet place / for your books.”, one text-only Create Library button — then the system folder picker, then the empty library. The app has exactly one library: the folder chosen here.",
      where: "First launch, or whenever no library folder is set (cleared site data).",
      why: "One folder holds every book; the user never manages a list of libraries. No default path and no Continue step: the picker is the decision.",
      keys: [["Enter", "Create Library when focused"]],
      edge: ["Picker cancelled → back to the welcome screen, nothing saved", "Folder with existing books → the library opens with them", "The chosen path then lives in the library top bar with a Change control", "Reduced motion: the photo drift and rise-in are off", "Unsupported browser → this screen is never shown (see unsupported-browser)"],
    },
  },
  home: {
    Demo: () => <HomeScreen />,
    h: 900, // v0.7.1: tall enough for the second row of books (was 760, clipped)
    notes: {
      what: "The library. Top bar: the Photobooks mark, the library folder (folder icon · mono path) with Change, then quiet Search books (title filter) and Sort (Last edited · Title · Created) in #D7D7D7 fields, and Settings. Below, “Your books” with a count, a text-only Create book button and the books as realistic book objects (4:5 default, landscape 5:4, square) with spine shading, a page edge, a Lora italic title and spaced-caps subtitle, plus a meta line “N spreads · edited …”. Empty library: an example cover “Fog”, “Your library is ready”, “Your first story / starts here.” and Create book.",
      where: "App start screen after the library folder is set.",
      why: "Books read as books; one library keeps the model simple. Hover deepens the shadow only — covers never lift.",
      keys: [["Enter", "open the focused book"], ["Esc", "cancel rename"]],
      edge: ["Change → confirm (books stay in the old folder) → picker → banner with “Switch back”", "Library folder missing (drive unplugged) → Can’t find your library folder: Try again / Change folder… (see recents-home)", "Removing a book never touches photos", "A new book without photos shows a blank paper cover with its title", "Cover photos are demo content; their credits are on the kit Photo credits page, not in the screen"],
    },
  },
  import: {
    from: "editor-shell-filmstrip",
    notes: {
      what: "Photos enter a book only as folders: “Add folder…” (directory picker) or a folder dropped on the editor / filmstrip. There is no file picker and no import of loose files.",
      where: "Editor empty state, the filmstrip dock, Ctrl+O.",
      why: "A book references photo folders on disk; whole folders keep relinking, re-import and “moved folder” recovery simple and predictable.",
      keys: [["Ctrl+O", "Add folder…"]],
      edge: ["Loose files dropped → nothing imported; status “Drop a folder — Photobooks adds folders, not single photos”", "Folder + loose files dropped together → folder added, loose files ignored (said in the status line)", "Subfolders included; non-image files skipped with one summary line; HEIC gets its own message", "Same folder added twice → no duplicates", "Folder moved later → relink by folder (missing-assets-relink)"],
    },
  },
  editor: { Demo: EditorScreen, h: 820, from: "spread-list-panel", notes: { what: "The main book editor (v0.7): header with the book title (opens Book settings), Pages / Masters list (Cover · Endpaper · page 1 · spreads · last page · Endpaper), dotted canvas with page numbers under the spread, Photos filmstrip, and an inspector that always shows the current selection. Keys: [ spreads, \\ photos, ] inspector, ⌘/Ctrl+. or Tab on the canvas hides all panels, Esc deselects.", where: "Opening a book from Home.", why: "Everything needed to lay out a book on one screen.", edge: ["Each feature below is a part of this screen; open it for the focused demo"] } },
  "editor-chrome": { from: "autosave", notes: { what: "The chrome and states every editor view shares: toolbar, save indicator and autosave, folder-access and single-editor dialogs, tokens, icons and the single Procreate-light theme.", where: "Top bar, dialogs over the editor, the whole UI.", why: "Consistent states and one visual language.", edge: ["Access lost / denied and “open in another tab” are scenarios of permissions-locks-ux"] } },
  "free-layout": { from: "free-frames", notes: { what: "Free layout tools: rulers, guides, grids, snapping, frames with handles, numeric inspector, stacking, lock and multi-select.", where: "Editor canvas + inspector when free layout is on.", why: "Layouts beyond templates.", edge: ["All in mm; snapping can be held off with Alt"] } },
  "text-styles": { from: "parent-spreads", notes: { what: "Text and reuse: captions, live captions, frame styles, own templates, parent spreads with grids, guides, overrides and page numbers.", where: "Editor: text tool, Styles, Parents section of the spread list.", why: "A consistent book with little repetition.", edge: ["Editing a parent shows a banner; Done returns to the spread"] } },
  presentation: { from: "presentation-mode", notes: { what: "Full-screen presentation of the book.", where: "Top bar → Present.", why: "See the book as a reader will.", keys: [["← →", "previous / next spread"], ["Esc", "exit"]], edge: ["Missing photos show placeholders"] } },
  "print-prep": { from: "preflight-panel", notes: { what: "Print-aware editing: DPI badge, bleed / trim / safe overlays, preflight panel with fixes, cover editor.", where: "Editor with a print profile set.", why: "Catch print problems before export.", edge: ["Warnings never block editing"] } },
  "print-export": { from: "pdf-export", notes: { what: "Print outputs: PDF, JPEG spreads, text parity, package report, booklet imposition, cover PDF.", where: "Export → Print.", why: "Files a print shop (or a home printer) accepts.", edge: ["Export waits until missing photos are resolved"] } },
  "showcase-site": { from: "site-viewer", notes: { what: "The public showcase site: book grid, viewer, lightbox; and the preview from the editor. v8: redesigned in the library style — books as objects, title + author line, page navigation, Fullscreen and Share; the old site theme switcher is gone.", where: "The exported / published site; Preview site in the editor.", why: "Books as a website.", edge: ["Fullscreen fits the book to the window with 32 px padding", "The site works in every browser — only the editor needs Chromium"] } },
  publish: { from: "in-app-publish", notes: { what: "Export the site to a folder, choose web image sizes, deploy manually or with the Publish button.", where: "Top bar → Publish; Export → Site.", why: "Update the site with one button.", edge: ["The export target is a folder chosen with the directory picker"] } },
  settings: {
    Demo: SettingsScreen,
    notes: {
      what: "App settings. Library: the one library folder with “Change library folder…”, access status and cache. Also Hosting, Site, Print presets, Interface (units, thumbnail size, density).",
      where: "Home header → Settings icon; editor menu → Settings.",
      why: "The single place to change where books live.",
      edge: ["Change library folder… confirms first: books stay in the old folder, nothing is moved or deleted", "Picking the current folder again is a no-op", "An empty folder starts a new library; a folder with books opens them", "There is no “add a second library” — only changing the folder"],
    },
  },
  "unsupported-browser": {
    Demo: UnsupportedBrowser,
    notes: {
      what: "Shown instead of the app when the browser can’t give folder access: a clear title, one-sentence reason (Photobooks needs direct folder access), “Get Google Chrome”, links to other Chromium browsers (Edge, Brave, Arc, Opera, Vivaldi) and Copy link.",
      where: "Before the app boots, on every editor route (deep links included). The published showcase site is not gated.",
      why: "Firefox and Safari have no File System Access API (showDirectoryPicker); without it Photobooks can’t keep books in a folder on disk, so failing late (on the first save) would lose work.",
      keys: [["Tab", "reach Get Google Chrome, Copy link, browser links"]],
      edge: [
        <>Detect by feature, not user agent: <span className="font-mono">typeof showDirectoryPicker === "function" && isSecureContext && self === top</span>; the UA (userAgentData.brands) is used only to name the browser in the copy</>,
        "Chromium with the API off (Brave by default, admin policy, http or a cross-origin iframe) → “Folder access is turned off” with how to turn it on and Reload",
        "Phones and tablets (Android Chrome has no directory picker; every iOS/iPadOS browser is WebKit) → “Photobooks needs a desktop computer” + Copy link",
        "No “continue anyway”: there is no in-memory fallback mode in v4",
        "Check runs before IndexedDB or permission prompts, so nothing is half-created; light and dark follow prefers-color-scheme",
      ],
    },
  },
}

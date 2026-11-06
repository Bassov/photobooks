/* #/demo editor and its parts. Each part can mount alone through <PartStudio> with an explicit book / doc / spread / selection / node / mode. */
import * as React from "react"
import type { ComponentProps } from "react"
import { Settings, FolderPlus, Printer, Eye, ImageOff, Download, CircleCheck, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { photos as ALL_PHOTOS } from "@/data"
import { Std } from "@/features/parts"
import { TopBar, Dock, FilmChips, SpreadsPanel, StatusLine, EditorFrame } from "@/sandbox/chrome"
import { ContextInspector } from "@/sandbox/context-inspector"
import { Viewport } from "@/sandbox/viewport"
import { useStudio, StudioProvider, BOOK0, type Book, type Features, type Node } from "@/sandbox/store"
import { reflowDoc, type Doc } from "@/sandbox/model"
import { useCoverPhoto, useCoverText, useMasters, setEditorExtras } from "@/sandbox/v7"
import type { View } from "@/sandbox/store"
import { FolderPicker } from "@/features/screens"
import { useSession, blankDoc, blankExtras, type Extras } from "./session"
import { PrintCustomsCtx, profileById } from "./printProfiles"
import { ExportSiteDialog, PrintDialog, PublishDialog, RelinkDialog, useExportRun, type ExportPhase, type ExportStep } from "./dialogs"
import { DemoSitePreview } from "./site"
import type { SiteState } from "@/features/site-viewer"
import { SLOT } from "./layout"

/** The editor features #/demo enables. `overrides`: Ctrl/⌘+Shift+click a parent item or guide on a spread to make a local copy. Guides on a master are edited in the Masters view (see Viewport).
 *  `stack`: pages stack on the pasteboard as in prod (Q3). */
export const DEMO_FEATURES: Features = { handles: true, swap: true, drop: true, multiDrop: true, crop: true, multi: true, marquee: true, textEdit: true, overrides: true, stack: true }

/** Writes the studio state back into the session book (doc, size, cover, masters). */
export function DocSpy({ id }: { id: string }) {
  const { S, set } = useSession()
  const st = useStudio()
  const cov = useCoverPhoto(), ct = useCoverText(), ms = useMasters()
  React.useEffect(() => {
    const doc = reflowDoc(st.doc, st.book, BOOK0) // store in base geometry: StudioProvider reflows init docs from BOOK0
    // v0.8.1 (P1-1): the whole editor state is kept per book — doc, size, cover photo + texts, masters (incl. grids)
    set({ books: S.books.map((b) => (b.id === id ? { ...b, doc, book: st.book, extras: { cover: cov, coverText: ct, masters: ms }, missing: [...st.missing] } : b)) })
  }, [st.doc, st.book, st.missing, id, cov, ct, ms])
  return null
}
const idsKey = (ids: Iterable<string>) => [...ids].sort().join()
/** Session → studio: photos the session marks missing (`__demo.missing()`) show hatched until relinked. */
export function MissingSync({ id }: { id: string }) {
  const { S } = useSession()
  const st = useStudio()
  const miss = S.books.find((b) => b.id === id)?.missing
  React.useEffect(() => { if (miss && idsKey(miss) !== idsKey(st.missing)) st.setMissing(new Set(miss)) }, [miss])
  return null
}
/** Dock chip + Relink dialog: shown only while photos are missing. Rescan matches by folder; Resolve relinks the matches; Skip keeps hatched frames. */
export function RelinkControl() {
  const st = useStudio()
  const [open, setOpen] = React.useState(false)
  const [picking, setPicking] = React.useState(false)
  const [found, setFound] = React.useState<ReadonlySet<string>>(new Set())
  const missing = [...st.missing]
  if (!missing.length) return null
  const close = () => { setOpen(false); setFound(new Set()) }
  return <>
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-xs text-ink-warning [&_svg]:size-3.5" onPress={() => setOpen(true)} data-testid="demo-relink"><ImageOff />{missing.length} missing · Relink…</Button>
    {open && <RelinkDialog missing={missing} found={found} onSkip={close} onRescan={() => setPicking(true)}
      onResolve={() => {
        const rest = new Set(missing.filter((m) => !found.has(m)))
        st.setMissing(rest); st.setStatus(`Relinked ${found.size} photo${found.size === 1 ? "" : "s"}`); close()
      }} />}
    <FolderPicker isOpen={picking} title="Rescan a folder for missing photos" onCancel={() => setPicking(false)} onPick={(p) => {
      setPicking(false)
      /* kit stand-in for the worker hash scan: the library folder holds the originals, any other folder matches nothing */
      const hit = p.endsWith("/Photobooks") ? new Set(missing) : new Set<string>()
      setFound(hit); st.setStatus(hit.size ? `Found ${hit.size} of ${missing.length} in “${p}”` : `No matches in “${p}”`)
    }} />
  </>
}
/** Filmstrip dock "Add folder…" button + folder picker (adds all kit photos not yet in the gallery). */
export function AddFolder() {
  const st = useStudio()
  const [open, setOpen] = React.useState(false)
  return <>
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-xs leading-[normal] [&_svg]:size-3.5 data-[hovered]:bg-field data-[pressed]:bg-field data-[hovered]:text-foreground" onPress={() => setOpen(true)} data-testid="demo-add-folder"><FolderPlus />Add folder…</Button>
    <FolderPicker isOpen={open} title="Add a photo folder" onCancel={() => setOpen(false)} onPick={(p) => {
      setOpen(false)
      const add = ALL_PHOTOS.map((x) => x.id).filter((x) => !st.doc.gallery.includes(x))
      st.update((d) => ({ ...d, gallery: [...d.gallery, ...add] }), `Import folder ${p}`)
      /* v0.9 §3: no floating toast for photo-folder events — quiet status only */
      st.setStatus(add.length ? `Added ${add.length} photo${add.length > 1 ? "s" : ""} from “${p}”` : `“${p}” has no new photos`)
    }} />
  </>
}
/** #/demo filmstrip dock (photos only; KS13: Unplaced · sort · Add folder… as prod). Needs a studio (Std or PartStudio). */
export function PhotosDock() { return <Dock right={<><RelinkControl /><FilmChips /><AddFolder /></>} /> }

/** KS1 (M11 widened): the top bar toggles snap and grid only, as prod; guides (Ctrl+;) and rulers (Shift+R) stay on their keys. */
const DEMO_VIEWS: ComponentProps<typeof TopBar>["views"] = ["snap", "grid"]
/** KS1: the #/demo canvas opens with no guides, rulers or bleed / trim / safe lines. KS13: the filmstrip starts on Added order (prod default). */
const DEMO_VIEW: Partial<View> = { guides: false, rulers: false, overlays: false, sort: "added" }
const quiet = { background: "#D7D7D7" } as const
export type ExportPill = { phase: ExportPhase; p: number }
const PILL = {
  idle: { Icon: Download, label: "Export site", title: "Export site", say: "" },
  done: { Icon: CircleCheck, label: "Exported", title: "Site exported", say: "Site exported" },
  failed: { Icon: TriangleAlert, label: "Failed", title: "Site export failed", say: "Site export failed" },
}
/** Export site pill (Designer static-export §1): the rest content is a hidden sizer in the same grid cell as the live content,
 *  so every state keeps the rest width; running fills a ::before layer (scaleX) under "NN%". Icon-only below 1280 px. */
function ExportSitePill({ phase, p, onPress }: ExportPill & { onPress?: () => void }) {
  const st = useStudio()
  const s = phase === "run"
    ? { Icon: Download, label: `${p}%`, title: `Exporting site · ${p}%`, say: `Exporting site, ${Math.floor(p / 10) * 10}%` }
    : PILL[phase]
  const cell = "col-start-1 row-start-1 flex items-center gap-1.5"
  const fill = "before:absolute before:inset-0 before:origin-left before:bg-control before:[transform:scaleX(var(--p))] before:[transition:transform_160ms_linear] motion-reduce:before:[transition:none]"
  // the jolly Button has no title prop: a display:contents wrapper carries it without adding a box to the bar
  return <>
    <span className="contents" title={s.title}>
      <Button variant="ghost" size="sm" isDisabled={st.doc.spreads.length === 0} className={cn("relative inline-grid h-8 justify-items-center overflow-hidden rounded-full px-3 text-sm font-medium [&_svg]:size-4", phase === "run" && fill)}
        style={{ ...quiet, "--p": p / 100 } as React.CSSProperties} onPress={onPress} aria-label="Export site" data-state={phase === "run" ? "running" : phase} data-testid="demo-export-site">
        <span aria-hidden className={cn(cell, "invisible")}><Download /><span className="max-[1280px]:hidden">Export site</span></span>
        <span className={cn(cell, "relative tabular-nums")}><s.Icon /><span className="max-[1280px]:hidden">{s.label}</span></span>
      </Button>
    </span>
    <span role="status" className="sr-only" data-testid="demo-export-site-status">{s.say}</span>
  </>
}
/** #/demo editor top bar: tools, history, view toggles (snap, grid), zoom, save, title (→ Book settings) and Preview · Settings · Export site · Print · Publish. */
export function EditorTopBar({ title, onLibrary, onPreview, onSettings, exportSite = { phase: "idle", p: 0 }, onExportSite, onPrint, onPublish }: {
  title: string; onLibrary?: () => void; onPreview?: () => void; onSettings?: () => void; exportSite?: ExportPill; onExportSite?: () => void; onPrint?: () => void; onPublish?: () => void
}) {
  const right = (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onPreview} data-testid="demo-preview"><Eye />Preview</Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onSettings} data-testid="demo-editor-settings" aria-label="Settings"><Settings /></Button>
      <ExportSitePill {...exportSite} onPress={onExportSite} />
      <span className="contents" title="Print"><Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onPrint} data-testid="demo-print" aria-label="Print"><Printer /></Button></span>
      <Button variant="ghost" size="sm" className="e7-sec h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onPublish} data-testid="demo-publish">Publish</Button>
    </div>
  )
  return <TopBar title={title} onLibrary={onLibrary} views={DEMO_VIEWS} right={right} />
}

/** The whole #/demo editor for one session book. */
export function DemoEditor({ id, initialDialog = null, initialPreview = false }: { id: string; initialDialog?: null | "publish" | "print"; initialPreview?: boolean | Partial<SiteState> }) {
  const { S, set } = useSession()
  const b = S.books.find((x) => x.id === id)!
  React.useState(() => { setEditorExtras(b.extras ?? blankExtras(b.title)); return 0 }) // restore before Std mounts (Std keep)
  const [dlg, setDlg] = React.useState<null | "publish" | "print" | "export">(initialDialog)
  const [preview, setPreview] = React.useState(!!initialPreview)
  const openSite = () => { const oid = S.open; set({ books: S.books.map((x) => (x.id === oid ? { ...x, published: true } : x)), stage: "site", back: "editor", siteEntry: "catalog" }) }
  // the export run lives here, not in the dialog: Hide closes the dialog and the pill keeps running
  const ex = useExportRun()
  const [exStep, setExStep] = React.useState<ExportStep>("opts")
  const openExport = () => { setExStep(ex.phase === "idle" ? "opts" : ex.phase); ex.seen(); setDlg("export") }
  const others = S.books.filter((x) => x.published && x.id !== id).map((x) => x.title)
  return (
    <div className="h-full" data-testid="demo-editor"><PrintCustomsCtx.Provider value={S.printProfiles}>
      <Std keep init={() => b.doc ?? blankDoc()} book={b.book} cur={0} features={DEMO_FEATURES} view={DEMO_VIEW} missing={b.missing} left={<SpreadsPanel reorder actions />}
        top={<EditorTopBar title={b.title} onLibrary={() => set({ stage: "library", open: null })} onPreview={() => setPreview(true)} onSettings={() => set({ stage: "settings", back: "editor" })} exportSite={{ phase: ex.phase, p: ex.p }} onExportSite={openExport} onPrint={() => setDlg("print")} onPublish={() => setDlg("publish")} />}
        dock={<PhotosDock />}
        overlay={<><DocSpy id={id} /><MissingSync id={id} />
          {preview && <DemoSitePreview id={id} onExit={() => setPreview(false)} initial={typeof initialPreview === "object" ? initialPreview : undefined} />}
          {dlg === "publish" && <PublishDialog title={b.title} onClose={() => setDlg(null)} onOpenSite={openSite} />}{dlg === "print" && <PrintDialog book={b.book} spreads={b.doc?.spreads.length ?? 10} title={b.title} profile={profileById(b.doc?.print?.profile ?? b.printProfile, S.printProfiles)} onClose={() => setDlg(null)} />}
          {dlg === "export" && <ExportSiteDialog title={b.title} otherBooks={others} initialStep={exStep} run={ex} onHide={() => setDlg(null)} />}</>} />
    </PrintCustomsCtx.Provider></div>
  )
}

/* ---------------------------------------------------------------- standalone mounting */
export type PartState = {
  /** book document (base geometry); default: blank #/demo book */ doc?: Doc | (() => Doc)
  /** page size; default BOOK0 */ book?: Partial<Book>
  /** current spread index; default 0 (cover) */ cur?: number
  /** selected frame ids on the current spread; default [] */ sel?: string[]
  /** inspector node: { k: "book" } = Book settings, { k: "cover" }, { k: "endpaper", w }, … ; default null */ node?: Node
  /** "pages" | "masters"; default "pages" */ mode?: "pages" | "masters"
  /** default DEMO_FEATURES */ features?: Features
}
/** A studio with #/demo features around any editor part. */
export function PartStudio({ doc, book, cur = 0, sel, node, mode, features = DEMO_FEATURES, children }: PartState & { children: React.ReactNode }) {
  return <StudioProvider init={doc ?? (() => blankDoc())} book={book} cur={cur} sel={sel} node={node} mode={mode} features={features}>{children}</StudioProvider>
}
const box = "relative flex h-full min-h-0 flex-col overflow-hidden bg-chrome"
/** Filmstrip (the #/demo photos dock) alone. */
export function FilmstripPart(p: PartState) { return <PartStudio {...p}><div className={box} data-testid="part-filmstrip"><div className="flex-1" /><PhotosDock /></div></PartStudio> }
/** Spread list (left panel) alone. */
export function SpreadListPart(p: PartState) { return <PartStudio {...p}><div className={box} style={{ width: SLOT.left }} data-testid="part-spreads"><SpreadsPanel reorder actions /></div></PartStudio> }
/** Editor top bar alone. */
export function TopBarPart({ title = "Untitled book", ...p }: PartState & { title?: string }) { return <PartStudio {...p}><div data-testid="part-topbar"><EditorTopBar title={title} /></div></PartStudio> }
/** Inspector alone. view "frame" selects frame `frame` (index on spread `cur`), "spread" clears selection, "book" opens Book settings. */
export function InspectorPart({ view = "spread", frame = 0, ...p }: PartState & { view?: "frame" | "spread" | "book"; frame?: number }) {
  return <PartStudio {...p} node={view === "book" ? { k: "book" } : p.node}><InspectorPick view={view} frame={frame} /><div className={box} style={{ width: SLOT.right }} data-testid="part-inspector"><ContextInspector /></div></PartStudio>
}
function InspectorPick({ view, frame }: { view: string; frame: number }) {
  const st = useStudio()
  React.useEffect(() => { if (view === "frame") { const f = st.doc.spreads[st.cur]?.frames[frame]; if (f) st.setSel([f.id]) } }, [])
  return null
}
/** Canvas (pasteboard + spread + status line) alone, in the editor shell with no panels. */
export function CanvasPart(p: PartState) { return <PartStudio {...p}><div className="h-full" data-testid="part-canvas"><EditorFrame canvas={<Viewport><StatusLine /></Viewport>} /></div></PartStudio> }

/* ---------------------------------------------------------------- Stage 3: the editor in context for feature pages */
export type EditorSlots = { left?: boolean; right?: boolean; dock?: boolean }
/** The #/demo editor (top bar, spread list, canvas, inspector, photos dock, DEMO_FEATURES) at its real EditorFrame slot sizes,
 *  seeded with an explicit studio state. `slots` hides panels the page is not about (the canvas always stays). */
export function EditorView({ title = "Lake trip", slots = {}, pick, crop, view, extras, overlay, exportSite, ...p }: PartState & {
  title?: string; slots?: EditorSlots; pick?: number | number[]; crop?: boolean; view?: Partial<View>; extras?: Partial<Extras>; overlay?: React.ReactNode; exportSite?: ExportPill
}) {
  React.useState(() => { setEditorExtras({ ...blankExtras(title), ...extras }); return 0 })
  return (
    <div className="h-full" data-testid="editor-view">
      <Std keep init={p.doc ?? (() => blankDoc())} book={p.book} cur={p.cur ?? 0} sel={p.sel} node={p.node} mode={p.mode} features={p.features ?? DEMO_FEATURES} view={view} pick={pick}
        top={<EditorTopBar title={title} exportSite={exportSite} />}
        left={slots.left === false ? false : <SpreadsPanel reorder actions />}
        right={slots.right === false ? false : undefined}
        dock={slots.dock === false ? false : <PhotosDock />}
        overlay={<>{crop && <CropOn />}{overlay}</>} />
    </div>
  )
}
function CropOn() {
  const st = useStudio()
  React.useEffect(() => { const t = setTimeout(() => { if (st.sel[0]) st.setCropId(st.sel[0]) }, 0); return () => clearTimeout(t) }, [st.sel[0]])
  return null
}

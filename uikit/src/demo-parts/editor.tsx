/* #/demo editor and its parts. Each part can mount alone through <PartStudio> with an explicit book / doc / spread / selection / node / mode. */
import * as React from "react"
import { Settings, FolderPlus, Printer, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { photos as ALL_PHOTOS } from "@/data"
import { Std } from "@/features/parts"
import { TopBar, Dock, SpreadsPanel, StatusLine, EditorFrame } from "@/sandbox/chrome"
import { ContextInspector } from "@/sandbox/context-inspector"
import { Viewport } from "@/sandbox/viewport"
import { useStudio, StudioProvider, BOOK0, type Book, type Features, type Node } from "@/sandbox/store"
import { reflowDoc, type Doc } from "@/sandbox/model"
import { useCoverPhoto, useCoverText, useMasters, setEditorExtras } from "@/sandbox/v7"
import type { View } from "@/sandbox/store"
import { FolderPicker, BOOKS } from "@/features/screens"
import { SiteViewer } from "@/features/site-viewer"
import { useSession, blankDoc, blankExtras, coverOf, fmtOf, type Extras } from "./session"
import { PrintDialog, PublishDialog } from "./dialogs"
import { SiteCover } from "./site"
import { SLOT } from "./layout"

/** The editor features #/demo enables. */
export const DEMO_FEATURES: Features = { handles: true, swap: true, drop: true, multiDrop: true, crop: true, multi: true, marquee: true, textEdit: true }

/** Writes the studio state back into the session book (doc, size, cover, masters). */
export function DocSpy({ id }: { id: string }) {
  const { S, set } = useSession()
  const st = useStudio()
  const cov = useCoverPhoto(), ct = useCoverText(), ms = useMasters()
  React.useEffect(() => {
    const doc = reflowDoc(st.doc, st.book, BOOK0) // store in base geometry: StudioProvider reflows init docs from BOOK0
    // v0.8.1 (P1-1): the whole editor state is kept per book — doc, size, cover photo + texts, masters (incl. grids)
    set({ books: S.books.map((b) => (b.id === id ? { ...b, doc, book: st.book, extras: { cover: cov, coverText: ct, masters: ms } } : b)) })
  }, [st.doc, st.book, id, cov, ct, ms])
  return null
}
/** Filmstrip dock "Add folder…" button + folder picker (adds all kit photos not yet in the gallery). */
export function AddFolder() {
  const st = useStudio()
  const [open, setOpen] = React.useState(false)
  return <>
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-xs [&_svg]:size-3.5" onPress={() => setOpen(true)} data-testid="demo-add-folder"><FolderPlus />Add folder…</Button>
    <FolderPicker isOpen={open} title="Add a photo folder" onCancel={() => setOpen(false)} onPick={(p) => {
      setOpen(false)
      const add = ALL_PHOTOS.map((x) => x.id).filter((x) => !st.doc.gallery.includes(x))
      st.update((d) => ({ ...d, gallery: [...d.gallery, ...add] }), `Import folder ${p}`)
      /* v0.9 §3: no floating toast for photo-folder events — quiet status only */
      st.setStatus(add.length ? `Added ${add.length} photo${add.length > 1 ? "s" : ""} from “${p}”` : `“${p}” has no new photos`)
    }} />
  </>
}
/** #/demo filmstrip dock (photos only + Add folder…). Needs a studio (Std or PartStudio). */
export function PhotosDock() { return <Dock right={<AddFolder />} /> }

/** #/demo editor top bar: tools, history, snap / grid, zoom, save, title (→ Book settings) and Preview · Settings · Print · Publish. */
export function EditorTopBar({ title, onLibrary, onPreview, onSettings, onPrint, onPublish }: {
  title: string; onLibrary?: () => void; onPreview?: () => void; onSettings?: () => void; onPrint?: () => void; onPublish?: () => void
}) {
  const quiet = { background: "#D7D7D7" } as const
  const right = (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onPreview} data-testid="demo-preview"><Eye />Preview</Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onSettings} data-testid="demo-editor-settings" aria-label="Settings"><Settings /></Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onPrint} data-testid="demo-print"><Printer />Print</Button>
      <Button variant="ghost" size="sm" className="e7-sec h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={onPublish} data-testid="demo-publish">Publish</Button>
    </div>
  )
  return <TopBar title={title} onLibrary={onLibrary} right={right} />
}

/** The whole #/demo editor for one session book. */
export function DemoEditor({ id, initialDialog = null, initialPreview = false }: { id: string; initialDialog?: null | "publish" | "print"; initialPreview?: boolean }) {
  const { S, set } = useSession()
  const b = S.books.find((x) => x.id === id)!
  React.useState(() => { setEditorExtras(b.extras ?? blankExtras(b.title)); return 0 }) // restore before Std mounts (Std keep)
  const [dlg, setDlg] = React.useState<null | "publish" | "print">(initialDialog)
  const [preview, setPreview] = React.useState(initialPreview)
  const card = { ...BOOKS[0], id: b.id, title: b.title, cover: coverOf(b) ?? "", spreads: b.doc?.spreads.length ?? 10, format: fmtOf(b.book), status: "draft" as const }
  const openSite = () => { const oid = S.open; set({ books: S.books.map((x) => (x.id === oid ? { ...x, published: true } : x)), stage: "site", back: "editor", siteEntry: "catalog" }) }
  return (
    <div className="h-full" data-testid="demo-editor">
      <Std keep init={() => b.doc ?? blankDoc()} book={b.book} cur={0} features={DEMO_FEATURES}
        top={<EditorTopBar title={b.title} onLibrary={() => set({ stage: "library", open: null })} onPreview={() => setPreview(true)} onSettings={() => set({ stage: "settings", back: "editor" })} onPrint={() => setDlg("print")} onPublish={() => setDlg("publish")} />}
        dock={<PhotosDock />}
        overlay={<><DocSpy id={id} />
          {preview && <div className="fixed inset-0 z-[80]" data-testid="book-preview"><SiteViewer single onClose={() => setPreview(false)} books={[card]} initial={{ page: "book", book: b.id }} cover={(w) => <SiteCover w={w} />} /></div>}
          {dlg === "publish" && <PublishDialog title={b.title} onClose={() => setDlg(null)} onOpenSite={openSite} />}{dlg === "print" && <PrintDialog book={b.book} spreads={b.doc?.spreads.length ?? 10} title={b.title} onClose={() => setDlg(null)} />}</>} />
    </div>
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
export function SpreadListPart(p: PartState) { return <PartStudio {...p}><div className={box} style={{ width: SLOT.left }} data-testid="part-spreads"><SpreadsPanel /></div></PartStudio> }
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
export function EditorView({ title = "Lake trip", slots = {}, pick, crop, view, extras, overlay, ...p }: PartState & {
  title?: string; slots?: EditorSlots; pick?: number | number[]; crop?: boolean; view?: Partial<View>; extras?: Partial<Extras>; overlay?: React.ReactNode
}) {
  React.useState(() => { setEditorExtras({ ...blankExtras(title), ...extras }); return 0 })
  return (
    <div className="h-full" data-testid="editor-view">
      <Std keep init={p.doc ?? (() => blankDoc())} book={p.book} cur={p.cur ?? 0} sel={p.sel} node={p.node} mode={p.mode} features={p.features ?? DEMO_FEATURES} view={view} pick={pick}
        top={<EditorTopBar title={title} />}
        left={slots.left === false ? false : undefined}
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

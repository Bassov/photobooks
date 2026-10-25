/* M0 Foundation + M1 Editor skeleton — shown as they should look in style B. */
import { pagesName } from "@/sandbox/v7"
import * as React from "react"
import { FolderOpen, Loader2, RotateCw, ImagePlus, FileWarning, Images, Plus, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/uui/Badge"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Progress } from "@/components/ui/progress"
import { Kbd, PhotoThumb } from "@/components/app/ui"
import { P, photos } from "@/data"
import { useStudio } from "@/sandbox/store"
import { emptyDoc, spread, SAMPLE_BOOK } from "@/sandbox/model"
import { TopBar, SpreadsPanel, Dock, Filmstrip, TemplateThumb, applyTemplate } from "@/sandbox/chrome"
import { InspectorPanel, EmptyInspector } from "@/sandbox/inspector"
import { Std } from "./parts"
import type { FeatureDef } from "./types"

/* ---------------------------------------------------------------- m0-photo-card */
function PhotoCardDemo() {
  const [st, setSt] = React.useState<"empty" | "loading" | "ok" | "rotated" | "error">("empty")
  const [hover, setHover] = React.useState(false)
  const [filesHint, setFilesHint] = React.useState(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setHover(false)
    // v4: folders only. A dropped folder opens; loose files get a hint instead of being imported.
    const entries = [...e.dataTransfer.items].map((it) => it.webkitGetAsEntry?.()).filter(Boolean)
    if (entries.length && entries.every((x) => !x!.isDirectory)) { setFilesHint(true); return }
    setFilesHint(false); open("ok")
  }
  const open = (next: "ok" | "rotated" | "error") => { setSt("loading"); setTimeout(() => setSt(next), 900) }
  const p = st === "rotated" ? P("p12") : P("p01")
  return (
    <div className="grid h-full grid-cols-[1fr_300px] bg-background">
      <div className="flex flex-col items-center justify-center gap-5 p-8">
        {st === "empty" && (
          <div onDragOver={(e) => { e.preventDefault(); setHover(true) }} onDragLeave={() => setHover(false)} onDrop={onDrop}
            className={cn("flex w-[460px] flex-col items-center gap-4 rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors", hover ? " bg-select/5" : "")}>
            <FeaturedIcon theme="outline" size="lg"><FolderOpen /></FeaturedIcon>
            <div><div className="heading text-xl">Add a photo folder</div><p className="mt-1 text-sm text-muted-foreground">Choose or drop the folder with your photos (JPEG, PNG, WebP). Nothing is uploaded — previews are decoded in a worker.</p></div>
            <div className="flex gap-2"><Button size="md" className="gap-1.5 px-4 shadow-sm [&_svg]:size-4" onPress={() => open("ok")} data-testid="open-photo">Add folder…</Button></div>
            {filesHint && <p className="text-sm text-muted-foreground" role="status" data-testid="files-hint">Photobooks adds whole folders. Drop the folder that holds these photos instead.</p>}
          </div>
        )}
        {st === "loading" && (
          <div className="w-[520px] overflow-hidden rounded-xl border bg-card shadow-md">
            <div className="grid aspect-[3/2] place-items-center bg-muted"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
            <div className="space-y-2 p-4"><div className="h-3 w-40 animate-pulse rounded bg-muted" /><div className="h-3 w-64 animate-pulse rounded bg-muted" /></div>
          </div>
        )}
        {(st === "ok" || st === "rotated") && (
          <div className="w-[520px] overflow-hidden rounded-xl border bg-card shadow-md" data-testid="photo-card">
            <div className="grid place-items-center bg-canvas" style={{ height: 300 }}>
              <img src={p.src} alt="" className="max-h-[300px] max-w-full object-contain" />
            </div>
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">{p.name}</div>
                <div className="text-xs tabular-nums text-muted-foreground">{p.w} × {p.h} px · 4.8 MB · JPEG · sRGB</div>
              </div>
              {st === "rotated" ? <Badge color="brand" icon={<RotateCw />}>EXIF orientation 6 → rotated 90°</Badge> : <Badge color="success" dot>Orientation 1</Badge>}
            </div>
          </div>
        )}
        {st === "error" && (
          <div className="flex w-[460px] items-start gap-4 rounded-xl border bg-card p-5 shadow-md" role="alert">
            <FeaturedIcon color="error" theme="soft"><FileWarning /></FeaturedIcon>
            <div className="min-w-0 flex-1"><div className="text-base font-semibold">Can’t read “scan_0042.heic”</div><p className="mt-1 text-sm text-muted-foreground">HEIC isn’t supported yet. The rest of the folder was added; export this one as JPEG from Photos and add the folder again.</p>
              <Button variant="outline" size="sm" className="mt-3 px-3 text-sm shadow-xs" onPress={() => setSt("empty")}>Choose another folder</Button></div>
          </div>
        )}
      </div>
      <aside className="flex flex-col gap-2 border-l bg-chrome p-4">
        <div className="eyebrow mb-1">Scenarios</div>
        <Button variant="outline" size="sm" className="justify-start text-sm shadow-xs" onPress={() => setSt("empty")}>Empty · drop zone</Button>
        <Button variant="outline" size="sm" className="justify-start text-sm shadow-xs" onPress={() => open("ok")}>Folder → landscape JPEG</Button>
        <Button variant="outline" size="sm" className="justify-start text-sm shadow-xs" onPress={() => open("rotated")} data-testid="open-rotated">Folder → EXIF-rotated portrait</Button>
        <Button variant="outline" size="sm" className="justify-start text-sm shadow-xs" onPress={() => open("error")}>Folder with a HEIC file</Button>
        <div className="mt-auto text-xs leading-relaxed text-muted-foreground">State: <b className="text-foreground">{st}</b>. Dropping a folder on the empty zone adds it (simulated); loose files show a hint instead.</div>
      </aside>
    </div>
  )
}

/* ---------------------------------------------------------------- editor-shell-filmstrip: progressive import */
function useImporter() {
  const st = useStudio()
  const [n, setN] = React.useState(-1)
  const start = () => {
    setN(0)
    let i = 0
    const t = setInterval(() => {
      i++; setN(i)
      st.update((d) => ({ ...d, gallery: photos.slice(0, i).map((p) => p.id) }), "Import")
      if (i >= 20) { clearInterval(t); setTimeout(() => setN(-1), 600); st.setStatus("20 photos added · ~/Pictures/Summer 2025") }
    }, 140)
  }
  return { n, start }
}
const ImportCtx = React.createContext<{ n: number; start: () => void }>({ n: -1, start: () => { } })
function ImportProvider({ children }: { children: React.ReactNode }) { const imp = useImporter(); return <ImportCtx.Provider value={imp}>{children}</ImportCtx.Provider> }
function ImportDock() {
  const imp = React.useContext(ImportCtx)
  const st = useStudio()
  return (
    <Dock left={imp.n >= 0 ? (
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Progress aria-label="Importing" value={imp.n} maxValue={20} className="w-32" barClassName="h-1 bg-secondary" /><span className="tabular-nums">Reading {imp.n} of 20{imp.n > 0 && imp.n <= 20 ? ` · ${photos[imp.n - 1].name}` : ""}</span></div>
    ) : <span className="text-xs text-muted-foreground">{st.doc.gallery.length ? `${st.doc.gallery.length} photos` : "No photos yet"}</span>}>
      {imp.n >= 0 && imp.n < 20 ? (
        <div className="flex gap-2 overflow-hidden p-1 pb-2">
          {photos.slice(0, Math.max(imp.n, 0)).map((p) => <PhotoThumb key={p.id} src={p.src} w={p.w} h={p.h} className="rounded-xs" />)}
          {Array.from({ length: 20 - Math.max(imp.n, 0) }, (_, i) => <div key={i} className="h-(--thumb) w-[110px] shrink-0 animate-pulse rounded-xs bg-muted" />)}
        </div>
      ) : <Filmstrip />}
    </Dock>
  )
}
function ImportEmpty() {
  const st = useStudio()
  const imp = React.useContext(ImportCtx)
  if (st.doc.gallery.length || imp.n >= 0) return null
  return (
    <div className="absolute left-1/2 top-1/2 z-30 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-center shadow-lg">
      <FeaturedIcon size="lg" theme="outline" className="mx-auto mb-4"><Images /></FeaturedIcon>
      <div className="heading text-lg">Add a photo folder</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Add the folder with your photos, or drop it here. Thumbnails appear while the rest is still being read.</p>
      <Button size="md" className="mt-4 gap-1.5 px-4 shadow-sm [&_svg]:size-4" onPress={imp.start} data-testid="add-folder">Add folder…</Button>
    </div>
  )
}
function ImportDemoWrap() {
  return <Std init={() => ({ ...emptyDoc(4), gallery: [] })} features={{ drop: true }} cur={0} pager={false} wrap={ImportProvider}
    right={<InspectorPanel frame={<EmptyInspector hint="Add a photo folder to start. Its photos appear in the filmstrip as they are read." />} />}
    dock={<ImportDock />} canvasExtra={<ImportEmpty />} />
}

/* ---------------------------------------------------------------- spread-templates-ui: start a book */
function StartBook() {
  return <Std init={() => emptyDoc(1)} cur={0} features={{ drop: true }} top={<TopBar exportPrimary={false} />} dock={<Dock templates defaultTab="templates" />} canvasExtra={<StartCard />}
    left={<SpreadsPanel actions />} />
}
function StartCard() {
  const st = useStudio()
  const [n, setN] = React.useState(8)
  const [done, setDone] = React.useState(false)
  if (done) return null
  return (
    <div className="absolute left-1/2 top-1/2 z-30 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-5 shadow-lg" data-testid="start-card">
      <div className="heading text-lg">Start a book</div>
      <p className="mt-1 text-sm text-muted-foreground">How many spreads? You can add or remove them any time.</p>
      <div className="mt-3 flex gap-1.5">
        {[4, 8, 12, 20].map((k) => <Button key={k} variant="outline" size="sm" aria-pressed={n === k} className={cn("flex-1 text-sm shadow-xs", n === k && " bg-accent font-semibold")} onPress={() => setN(k)}>{k}</Button>)}
      </div>
      <div className="mt-4 text-xs text-muted-foreground">Starting layout</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {["t-pair", "t-hero2", "t-full"].map((t) => <TemplateThumb key={t} id={t} width={118} className="w-full" />)}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="md" className="px-3" onPress={() => setDone(true)}>Empty book</Button>
        <Button size="md" className="px-4 shadow-sm" data-testid="start-create" onPress={() => {
          st.update((d) => ({ ...d, spreads: Array.from({ length: n }, (_, i) => spread(SAMPLE_BOOK[i % SAMPLE_BOOK.length][0])) }), `New book · ${n} spreads`)
          st.setStatus(`${n} spreads created · pick a template per spread below`); setDone(true)
        }}>Create {n} spreads</Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- zoom-image-tiers: dev HUD */
function TierHud() {
  const st = useStudio()
  const z = st.view.zoom
  const tiers = [["thumb", 256], ["preview", 1024], ["large", 2048], ["full", 0]] as const
  const active = z < 0.6 ? 0 : z < 1.6 ? 1 : z < 3 ? 2 : 3
  return (
    <div className="absolute right-3 top-3 z-30 w-[230px] rounded-lg border bg-popover/95 p-3 text-xs shadow-md" data-testid="tier-hud">
      <div className="mb-2 flex items-center gap-1.5 font-semibold"><Gauge className="size-3.5" />Image tier · dev overlay</div>
      {tiers.map(([n, px], i) => (
        <div key={n} className={cn("flex items-center gap-2 rounded-md px-2 py-1", i === active && "bg-select/15 font-medium text-foreground")}>
          <span className={cn("size-1.5 rounded-full", i === active ? "bg-select" : "bg-border")} />{n}<span className="ml-auto tabular-nums text-muted-foreground">{px ? `${px} px` : "original"}</span>
        </div>
      ))}
      <div className="mt-2 text-muted-foreground">Zoom {Math.round(z * 100)}% · Ctrl+wheel / Ctrl+= to change</div>
    </div>
  )
}

/* ---------------------------------------------------------------- template-unplace-notice */
function UnplaceNotice() {
  return <Std cur={4} features={{ drop: true }} dock={<Dock templates defaultTab="templates" />} canvasExtra={<UnplaceHint />} />
}
function UnplaceHint() {
  const st = useStudio()
  return (
    <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-sm">
      {pagesName(st.cur)} have 5 photos. Pick “Full bleed” below →
      <Button size="xs" variant="outline" className="px-2 text-xs shadow-xs" onPress={() => applyTemplate(st, "t-full")} data-testid="apply-full">Apply</Button>
    </div>
  )
}

/* ---------------------------------------------------------------- add-spread-camera */
function AddSpread() {
  return <Std features={{ stack: true, drop: true }} top={<TopBar exportPrimary={false} />} cur={0} view={{ zoom: 1 }} left={<SpreadsPanel actions />} pager={false} canvasExtra={<AddSpreadFab />} />
}
function AddSpreadFab() {
  const st = useStudio()
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); add() } }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  })
  const add = () => {
    const i = st.cur + 1
    st.update((d) => ({ ...d, spreads: [...d.spreads.slice(0, i), spread("t-pair"), ...d.spreads.slice(i)] }), "Add spread")
    st.setCur(i); st.setStatus(`${pagesName(i)} added after the current ones · zoom kept at ${Math.round(st.view.zoom * 100)}%`)
  }
  return (
    <div className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-md">
      <Button size="sm" className="gap-1.5 px-3 text-sm shadow-sm [&_svg]:size-4" onPress={add} data-testid="fab-add">Add spread</Button><Kbd>Ctrl+↵</Kbd>
      <span className="px-2 text-xs tabular-nums text-muted-foreground">zoom {Math.round(st.view.zoom * 100)}%</span>
    </div>
  )
}

/* ---------------------------------------------------------------- filmstrip-file-name */
function FileNames() {
  return <Std left={false} view={{ thumb: 100 }} features={{ drop: true }} right={<InspectorPanel frame={<FileNameInfo />} />} />
}
function FileNameInfo() {
  const st = useStudio()
  const id = st.filmSel[0] ?? "p02"
  const p = P(id)
  return (
    <div className="p-4 text-sm">
      <div className="eyebrow mb-2">Selected photo</div>
      <img src={p.src} alt="" className="h-28 w-full rounded-md object-cover" />
      <dl className="mt-3 grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Label</dt><dd className="truncate font-medium">{p.name}</dd>
        <dt className="text-muted-foreground">Asset id</dt><dd className="truncate font-mono text-2xs text-muted-foreground">sha256-{(id + "9f3c1ab0e4d2").slice(0, 12)}…</dd>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">The filmstrip label is the original file name (<span className="font-mono">File.name</span>), not the sanitised id. Click a photo in the filmstrip.</p>
    </div>
  )
}

/* ---------------------------------------------------------------- registry */
export const M0M1: Record<string, FeatureDef> = {
  "m0-photo-card": {
    Demo: PhotoCardDemo, h: 560,
    notes: {
      what: "First vertical slice: the user adds a photo folder and sees its first photo as a correctly rotated preview with size and format. v4: photos only ever come in by folder — there is no single-file picker.",
      where: "Start screen before the editor exists; later the photo card in the inspector (#/screen/import).",
      why: "Exercises the whole file → worker → preview path and removes the main fear up front: photos are not uploaded anywhere.",
      keys: [["Enter", "open the folder picker when the button is focused"]],
      edge: ["EXIF orientation 5–8: a badge says the photo was rotated automatically", "HEIC and broken files inside the folder: a clear error; the rest of the folder still comes in", "Loose files dropped instead of a folder: nothing is imported; a hint says to drop the folder that holds them", "Huge 100 MP files: decoded in a worker, the UI never freezes"],
    },
  },
  "editor-shell-filmstrip": {
    Demo: ImportDemoWrap,
    notes: {
      what: "Editor layout: top bar, spreads on the left, canvas, filmstrip at the bottom, inspector on the right. Import is by folder only (Add folder… or drop a folder) and progressive: placeholders are replaced by thumbnails as files are read.",
      where: "The main book screen. Empty state: an “Add a photo folder” card in the middle of the canvas.",
      why: "The user sees results immediately instead of waiting for the whole folder; the filmstrip is the single source of photos.",
      keys: [["Ctrl+O", "add folder"]],
      edge: ["Press “Add folder…” to see the progress and the quiet status line", "A folder without images → empty state with a hint", "Subfolders are included; non-image files are skipped with one summary line", "Adding a second folder appends its photos; a folder already in the book is not added twice", "Loose files dropped → not imported; status says to drop a folder instead (see filmstrip-resize-drop)", "A file that fails to read does not stop the import — status reports how many were skipped"],
    },
  },
  "pasteboard-workspace": {
    Demo: () => <Std features={{ stack: true, drop: true }} cur={0} pager={false} />,
    notes: {
      what: "All spreads are stacked on a neutral pasteboard; the active one is outlined and labelled.",
      where: "Central editor area; the list on the left is synced with scrolling.",
      why: "The book reads as a whole: rhythm and empty spots are visible without paging one by one.",
      keys: [["Ctrl+wheel", "zoom"], ["← →", "previous / next spread"]],
      edge: ["Clicking a thumbnail on the left scrolls to that spread", "40+ spreads are virtualised (outside this demo)"],
    },
  },
  "spread-templates-ui": {
    Demo: StartBook,
    notes: {
      what: "A “Start a book” card: how many spreads and a starting template; then the Templates tab in the dock changes the layout of the current spread.",
      where: "Empty book → centre of the canvas; Templates tab in the bottom dock.",
      why: "A quick start instead of a blank page; the template can always be changed.",
      keys: [["Ctrl+↵", "add spread"]],
      edge: ["“Empty book” closes the card without creating spreads", "A template with fewer frames sends extra photos back to the filmstrip (see template-unplace-notice)"],
    },
  },
  "camera-zoom-pan": {
    Demo: () => <Std features={{ drop: true }} view={{ zoom: 1 }} top={<TopBar tools={["select", "hand"]} views={[]} />} />,
    notes: {
      what: "Canvas camera: Fit, fixed zoom levels, wheel zoom around the cursor, pan with the Hand tool or Space.",
      where: "Zoom menu on the right of the top bar; Hand tool in the centre.",
      why: "Check crops and small captions without losing your place.",
      keys: [["Ctrl+wheel", "zoom around the cursor"], ["Ctrl+=", "zoom in"], ["Ctrl+-", "zoom out"], ["Ctrl+0", "fit spread"], ["Space+drag", "pan"], ["H", "Hand tool"]],
      edge: ["Above 100% the wheel without Ctrl pans", "Returning to Fit resets the offset"],
    },
  },
  "zoom-image-tiers": {
    Demo: () => <Std features={{ drop: true }} canvasExtra={<TierHud />} top={<TopBar views={[]} />} />,
    notes: {
      what: "As you zoom, the editor swaps the preview for a larger tier; a dev overlay shows the active tier.",
      where: "Canvas; the overlay exists only in dev builds (never visible in the product).",
      why: "Sharp images without loading originals at small zoom — saves memory and keeps things smooth.",
      keys: [["Ctrl+=", "zoom in and watch the tier change"]],
      edge: ["While the new tier decodes, the previous one stays (no flashing)", "The original loads only at ≥ 300%"],
    },
  },
  "drag-place-replace": {
    Demo: () => <Std features={{ drop: true }} />,
    notes: {
      what: "Drag a photo from the filmstrip onto a frame: an empty frame says “Release to place”, a filled one “Release to replace”. The replaced photo returns to the filmstrip without its check mark.",
      where: "Filmstrip at the bottom → canvas. The status line at the bottom left confirms the action.",
      why: "The core action of the product; it must be obvious and reversible.",
      keys: [["Enter", "pick up a photo with the keyboard (RAC DnD), then Tab to a frame and Enter"], ["Esc", "cancel the drag"]],
      edge: ["A check mark in the filmstrip = the photo is already in the book", "Low-res badge on small photos", "Keyboard drag and drop is provided by React Aria"],
    },
  },
  "drag-swap-unplace": {
    Demo: () => <Std features={{ swap: true, drop: true }} />,
    notes: {
      what: "Drag a photo from one frame onto another — the photos swap; drop it on the filmstrip — the frame empties and the photo goes back to the gallery.",
      where: "Canvas and filmstrip; the status line gives a hint during the drag.",
      why: "Rearranging is the most frequent action after the first layout.",
      keys: [["Esc", "cancel"]],
      edge: ["Dropping on the same frame does nothing", "Empty target frame: the photo simply moves"],
    },
  },
  "filmstrip-file-name": {
    Demo: FileNames,
    notes: {
      what: "The original file name sits under the thumbnail (including non-Latin and long names with an ellipsis); the asset id is only shown in details.",
      where: "Filmstrip at large thumbnail sizes; the inspector shows both values.",
      why: "Users look for photos by the name their camera or phone gave them, not by a hash.",
      edge: ["Long names are truncated with an ellipsis; the full name is in the tooltip / inspector", "Identical names from different folders are told apart by folder"],
    },
  },
  "template-unplace-notice": {
    Demo: UnplaceNotice,
    notes: {
      what: "If the new template holds fewer photos, the extra ones go back to the filmstrip and a polite status says how many.",
      where: "Templates tab in the dock; status at the bottom left of the canvas (aria-live=polite).",
      why: "Photos never disappear silently — the user understands what happened and can undo.",
      keys: [["Ctrl+Z", "restore the previous template with its photos"]],
      edge: ["Nothing unplaced — the status just names the template", "No toasts: this is not an error"],
    },
  },
  "add-spread-camera": {
    Demo: AddSpread,
    notes: {
      what: "“Add spread” inserts a spread after the current one, keeps the zoom level and scrolls to it after layout.",
      where: "Button in the spreads panel and a floating button; Ctrl+Enter.",
      why: "The camera does not jump — the user keeps their place in the book.",
      keys: [["Ctrl+↵", "add spread"]],
      edge: ["Adding at the end scrolls to the bottom", "Zoom is preserved (the value is shown next to the button)"],
    },
  },
}

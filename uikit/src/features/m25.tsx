/* M2.5 Design foundation */
import * as React from "react"
import * as Icons from "lucide-react"
import { Moon, Sun, Images, AlertTriangle, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Progress } from "@/components/ui/progress"
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle"
import { IconButton, PhotoThumb } from "@/components/app/ui"
import { useStudio } from "@/sandbox/store"
import { emptyDoc, makeDoc } from "@/sandbox/model"
import { TopBar, Dock, SaveStatus, floatBar } from "@/sandbox/chrome"
import { Toolbar } from "@/components/ui/toolbar"
import { Separator } from "@/components/ui/separator"
import { InspectorPanel, EmptyInspector, PhotoSection, GeometrySection, useSelected } from "@/sandbox/inspector"
import { setTheme, useTheme } from "@/kit/theme"
import { photos } from "@/data"
import { Std, Dev, SpecCard, WithScenarios } from "./parts"
import { HomeScreen, RelinkDialog, DialogHead } from "./screens"
import { AppModal } from "@/components/app/ui"
import type { FeatureDef } from "./types"

function GeoTab() { const { f } = useSelected(); return f ? <><PhotoSection /><GeometrySection rotation={false} /></> : <EmptyInspector /> }

/* ---------------------------------------------------------------- design-tokens specimen */
function useVar(name: string, dep: unknown) {
  const [v, setV] = React.useState("")
  React.useEffect(() => { setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim()) }, [name, dep])
  return v
}
function Swatch({ v, theme }: { v: string; theme: string }) {
  const val = useVar(`--${v}`, theme)
  return (
    <div className="flex flex-col gap-1">
      <div className="h-10 rounded-md border shadow-xs" style={{ background: `var(--${v})` }} />
      <span className="font-mono text-[11px]">{v}</span><span className="font-mono text-[10.5px] text-muted-foreground">{val}</span>
    </div>
  )
}
function TokensSpecimen() {
  const theme = useTheme()
  const roles = ["background", "chrome", "canvas", "paper", "card", "popover", "foreground", "muted-foreground", "primary", "primary-foreground", "secondary", "muted", "accent", "border", "input", "ring", "select", "guide", "success", "warning", "destructive"]
  return (
    <div className="flex flex-col gap-5 p-5" data-testid="specimen">
      <div className="flex items-center gap-3">
        <div className="heading text-xl">?specimen</div><span className="text-xs text-muted-foreground">dev/test-only page · tokens resolve live from CSS variables</span>
        <ToggleButtonGroup selectionMode="single" disallowEmptySelection selectedKeys={[theme]} onSelectionChange={(k) => { const v = [...k][0]; if (v) setTheme(v as "b") }} aria-label="Theme" className="ml-auto gap-0.5 rounded-md bg-muted p-0.5 dark:bg-black/25">
          <Toggle id="b" size="sm" className="h-7 gap-1.5 px-2 text-xs data-[selected]:bg-background data-[selected]:shadow-sm dark:data-[selected]:bg-accent [&_svg]:size-3.5"><Sun />B</Toggle>
          <Toggle id="b-dark" size="sm" className="h-7 gap-1.5 px-2 text-xs data-[selected]:bg-background data-[selected]:shadow-sm dark:data-[selected]:bg-accent [&_svg]:size-3.5"><Moon />B-dark</Toggle>
        </ToggleButtonGroup>
      </div>
      <div><div className="eyebrow mb-2">Semantic colour roles</div><div className="grid grid-cols-7 gap-3">{roles.map((r) => <Swatch key={r} v={r} theme={theme} />)}</div></div>
      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
        <div><div className="eyebrow mb-2">Type scale · Inter (UI) + Lora (headings), self-hosted woff2 latin + cyrillic</div>
          <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-4">
            <span className="heading text-[32px] leading-tight">A week by the sea · 32</span><span className="heading text-[26px]">Summer by the sea · 26</span><span className="heading text-[18px]">Section heading · 18</span>
            <span className="text-[15px]">Body 15 · Drag a photo onto a frame</span><span className="text-[13.5px]">UI 13.5 · Inspector labels and values</span><span className="text-xs text-muted-foreground">Caption 12 · 6000 × 4000 px · 14 Jul</span><span className="eyebrow">Eyebrow 11</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div><div className="eyebrow mb-2">Radius</div><div className="flex gap-3">{["sm", "md", "lg", "xl", "2xl"].map((r) => <div key={r} className="flex flex-col items-center gap-1"><div className="size-12 border bg-card shadow-xs" style={{ borderRadius: `var(--radius-${r})` }} /><span className="text-[10.5px] text-muted-foreground">{r}</span></div>)}</div></div>
          <div><div className="eyebrow mb-2">Elevation</div><div className="flex gap-3">{["xs", "sm", "md", "lg"].map((s) => <div key={s} className={cn("grid size-14 place-items-center rounded-lg border bg-card text-[10.5px] text-muted-foreground", { xs: "shadow-xs", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg" }[s])}>{s}</div>)}</div></div>
          <div><div className="eyebrow mb-2">Spacing · 4 px base</div><div className="flex items-end gap-2">{[1, 2, 3, 4, 6, 8, 12].map((n) => <div key={n} className="flex flex-col items-center gap-1"><div className="w-3 rounded-sm bg-select/60" style={{ height: n * 4 }} /><span className="text-[10px] tabular-nums text-muted-foreground">{n * 4}</span></div>)}</div></div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- icon set */
const ICONS: [string, keyof typeof Icons][] = [["undo", "Undo2"], ["redo", "Redo2"], ["zoom in", "ZoomIn"], ["zoom out", "ZoomOut"], ["fit", "Maximize"], ["add spread", "Plus"], ["duplicate", "Copy"], ["delete", "Trash2"], ["grid", "Grid3x3"], ["guides", "Crosshair"], ["rulers", "Ruler"], ["text", "Type"], ["image", "Image"], ["lock", "Lock"], ["eye", "Eye"], ["warning", "AlertTriangle"], ["info", "Info"], ["check", "Check"], ["present", "Presentation"], ["export", "Download"], ["settings", "Settings"], ["chevron", "ChevronRight"], ["folder", "FolderOpen"], ["snap", "Magnet"]]
function IconSet() {
  const [size, setSize] = React.useState(16)
  return (
    <Dev>
      <SpecCard title="Icon primitive · 24 icons (tree-shaken lucide)">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">Size token
          <ToggleButtonGroup selectionMode="single" disallowEmptySelection selectedKeys={[String(size)]} onSelectionChange={(k) => setSize(Number([...k][0]))} aria-label="Icon size" className="gap-0.5 rounded-md bg-muted p-0.5 dark:bg-black/25">
            {[14, 16, 20].map((s) => <Toggle key={s} id={String(s)} size="sm" className="h-6 px-2 text-xs data-[selected]:bg-background data-[selected]:shadow-sm dark:data-[selected]:bg-accent">{s}</Toggle>)}
          </ToggleButtonGroup>
          <span className="ml-auto">stroke 2 · currentColor · decorative = aria-hidden</span>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {ICONS.map(([n, k]) => { const I = Icons[k] as React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; return <div key={n} className="flex flex-col items-center gap-1.5 rounded-lg border bg-background py-3"><I size={size} aria-hidden /><span className="text-[10.5px] text-muted-foreground">{n}</span></div> })}
        </div>
      </SpecCard>
    </Dev>
  )
}

/* ---------------------------------------------------------------- editor-chrome-toolbar */
function ChromeToolbar() {
  return <Std features={{ drop: true, handles: true }} top={<TopBar views={["snap", "grid", "guides", "rulers"]} />} dock={<Dock templates />} pager={false} canvasExtra={<CameraBar />} right={<InspectorPanel frame={<GeoTab />} />} />
}
function CameraBar() {
  const st = useStudio()
  return (
    <Toolbar aria-label="Camera" className={cn(floatBar, "absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 px-0.5 py-0.5")} data-testid="camera-bar">
      <IconButton label="Previous spread (←)" size="sm" isDisabled={st.cur === 0} onPress={() => st.setCur(st.cur - 1)} placement="top"><Icons.ChevronLeft /></IconButton>
      <span className="px-1.5 text-xs tabular-nums text-muted-foreground"><span className="font-medium text-foreground">Spread {st.cur + 1}</span> of {st.doc.spreads.length}</span>
      <IconButton label="Next spread (→)" size="sm" isDisabled={st.cur >= st.doc.spreads.length - 1} onPress={() => st.setCur(st.cur + 1)} placement="top"><Icons.ChevronRight /></IconButton>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <IconButton label="Zoom out (Ctrl+-)" size="sm" onPress={() => st.setView({ zoom: Math.max(0.25, st.view.zoom / 1.25) })} placement="top"><Icons.ZoomOut /></IconButton>
      <span className="w-10 text-center text-xs tabular-nums">{Math.round(st.view.zoom * 100)}%</span>
      <IconButton label="Zoom in (Ctrl+=)" size="sm" onPress={() => st.setView({ zoom: Math.min(8, st.view.zoom * 1.25) })} placement="top"><Icons.ZoomIn /></IconButton>
      <IconButton label="Fit spread (Ctrl+0)" size="sm" onPress={() => st.setView({ zoom: 1 })} placement="top"><Icons.Maximize /></IconButton>
    </Toolbar>
  )
}

/* ---------------------------------------------------------------- editor-chrome-states */
function ChromeStates() {
  return (
    <WithScenarios items={[["empty", "Empty"], ["import", "Importing"], ["error", "Import error"], ["drag", "Drop targets"], ["placed", "Placed + selection"]]}
      render={(v) => <StateScene key={v} v={v} />} note="every state is built from tokens and primitives" />
  )
}
function StateScene({ v }: { v: string }) {
  const init = v === "empty" || v === "import" || v === "error" ? () => ({ ...emptyDoc(3), gallery: v === "empty" ? [] : photos.slice(0, 9).map((p) => p.id) }) : () => makeDoc()
  return <Std init={init} features={{ drop: true }} cur={v === "drag" ? 7 : v === "placed" ? 2 : 0} sel={[]} canvasExtra={<StateOverlay v={v} />}
    dock={v === "import" ? <Dock left={<div className="flex items-center gap-2.5 text-xs text-muted-foreground"><Progress aria-label="Importing" value={9} maxValue={20} className="w-32" barClassName="h-1 bg-secondary dark:bg-accent" />Reading 9 of 20 · IMG_4249.jpg</div>}><div className="flex gap-2 overflow-hidden p-1 pb-2">{photos.slice(0, 9).map((p) => <PhotoThumb key={p.id} src={p.src} w={p.w} h={p.h} className="rounded-[5px]" />)}{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-(--thumb) w-[110px] shrink-0 animate-pulse rounded-[5px] bg-muted" />)}</div></Dock> : undefined}
    right={<InspectorPanel frame={<GeoTab />} />} />
}
function StateOverlay({ v }: { v: string }) {
  const st = useStudio()
  React.useEffect(() => {
    if (v === "error") st.toast({ tone: "error", icon: <AlertTriangle />, title: "3 files couldn’t be read", description: "scan_0042.heic, broken.jpg, IMG_9999.tif — unsupported or damaged.", action: { label: "Show files" } }, 60000)
    if (v === "drag") { st.setDragging(["p17"]); st.setStatus("Dragging IMG_4333.jpg — empty frames are highlighted as drop targets") }
    if (v === "placed") { st.setSel([st.doc.spreads[2].frames[1].id]); st.setStatus("Placed ✓ marks in the filmstrip; selected frame has handles and a size label") }
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (v !== "empty") return null
  return (
    <div className="absolute left-1/2 top-1/2 z-30 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-center shadow-lg">
      <FeaturedIcon size="lg" theme="outline" className="mx-auto mb-4"><Images /></FeaturedIcon>
      <div className="heading text-lg">Start with your photos</div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">One empty / loading / error pattern for the whole editor: icon, title, one sentence, one primary action.</p>
      <Button size="sm" className="mt-4 h-9 px-3.5 shadow-sm">Add folder…</Button>
    </div>
  )
}

/* ---------------------------------------------------------------- project-screens-adoption */
function Screens() {
  return (
    <WithScenarios items={[["home", "Home"], ["empty", "Home · empty"], ["perm", "Permission"], ["lock", "Another tab"], ["missing", "Missing assets"], ["save", "Save indicator"]]}
      render={(v) => v === "home" ? <HomeScreen /> : v === "empty" ? <HomeScreen empty /> : <ScreenDialogs key={v} v={v} />} />
  )
}
function ScreenDialogs({ v }: { v: string }) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="relative h-full">
      <Std features={{ drop: true }} missing={v === "missing" ? ["p11"] : undefined} canvasExtra={v === "save" ? <SaveCycle /> : null} />
      {v === "perm" && <AppModal isOpen={open} width={460} isDismissable={false}><DialogHead icon={<FeaturedIcon color="warning" className="mt-0.5"><Icons.ShieldAlert /></FeaturedIcon>} title="Allow access to “Photobooks” again?" sub="Dialog + FeaturedIcon + Button primitives." /><div className="flex justify-end gap-2 border-t px-6 py-3.5"><Button variant="ghost" size="sm" className="h-9 px-3" onPress={() => setOpen(false)}>Read-only</Button><Button size="sm" className="h-9 px-4 shadow-sm" onPress={() => setOpen(false)}>Grant access</Button></div></AppModal>}
      {v === "lock" && <AppModal isOpen={open} width={460} isDismissable={false}><DialogHead icon={<FeaturedIcon className="mt-0.5"><Icons.Lock /></FeaturedIcon>} title="Open in another tab" sub="Only one tab can edit. Edit here and the other tab becomes read-only." /><div className="flex justify-end gap-2 border-t px-6 py-3.5"><Button variant="ghost" size="sm" className="h-9 px-3" onPress={() => setOpen(false)}>View only</Button><Button size="sm" className="h-9 px-4 shadow-sm" onPress={() => setOpen(false)}>Edit here</Button></div></AppModal>}
      {v === "missing" && <RelinkDialog isOpen={open} onClose={() => setOpen(false)} onResolve={() => setOpen(false)} rows={[{ id: "p11", status: "missing", folder: "~/Pictures/Summer 2025" }, { id: "p05", status: "modified", folder: "edited 12 Oct" }]} />}
    </div>
  )
}
function SaveCycle() {
  const st = useStudio()
// eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { const seq: ("dirty" | "saving" | "saved" | "error")[] = ["dirty", "saving", "saved", "error", "saved"]; let i = 0; const t = setInterval(() => { st.setSaveState(seq[i++ % seq.length]) }, 1200); return () => clearInterval(t) }, [])
  return <div className="absolute right-3 top-3 z-30 rounded-lg border bg-popover p-3 text-xs shadow-md">Save indicator cycles: <SaveStatus /></div>
}

/* ---------------------------------------------------------------- dark theme */
const LocalTheme = React.createContext<[string, (t: string) => void]>(["b-dark", () => { }])
function DarkTheme() {
  const pageTheme = useTheme()
  const [t, setT] = React.useState(pageTheme === "b" ? "b-dark" : "b")
  return (
    <LocalTheme.Provider value={[t, setT]}>
      <div data-theme={t} className="h-full bg-chrome text-foreground">
        <Std features={{ drop: true }} top={<TopBar views={["grid"]} right={<ThemeSwitch />} />} right={<InspectorPanel frame={<GeoTab />} />} />
      </div>
    </LocalTheme.Provider>
  )
}
function ThemeSwitch() {
  const [t, setT] = React.useContext(LocalTheme)
  return (
    <>
      <IconButton label={t === "b" ? "Dark theme" : "Light theme"} onPress={() => setT(t === "b" ? "b-dark" : "b")} data-testid="app-theme-toggle">{t === "b" ? <Moon /> : <Sun />}</IconButton>
      <Button size="sm" className="h-8 gap-1.5 px-2.5 text-[13px] shadow-sm [&_svg]:size-4"><Download />Export</Button>
    </>
  )
}

export const M25: Record<string, FeatureDef> = {
  "design-tokens": {
    Demo: TokensSpecimen, auto: true,
    notes: {
      what: "Semantic tokens (surfaces, text, accent, selection, drop target, statuses) on top of a primitive palette; Inter / Lora fonts are local woff2 files (Latin + Cyrillic).",
      where: "Dev page ?specimen; in the product — all chrome styling.",
      why: "One token edit changes the whole UI; zero third-party font requests.",
      keys: [["—", "B / B-dark switch right on the page"]],
      edge: ["prefers-reduced-motion turns animations off", "Book content colours are not tokens — the document defines them", "Raw colours outside the token file are not allowed"],
    },
  },
  "icon-set": {
    Demo: IconSet, auto: true,
    notes: {
      what: "One icon family (lucide, stroke 2, currentColor) mapped to editor actions, in three size tokens: 14 / 16 / 20.",
      where: "Every toolbar, menu and icon button of the editor.",
      why: "Icons of one style and size across the editor; the same action always has the same icon.",
      edge: ["An icon-only control always has an accessible label and a tooltip", "Decorative icons are aria-hidden", "Toggle the size token to compare 14 / 16 / 20"],
    },
  },
  "editor-chrome-toolbar": {
    Demo: ChromeToolbar,
    notes: {
      what: "Top bar (tools, history, view), CameraBar (paging and zoom) and the templates panel built from Toolbar / IconButton / Toggle / Segmented; tooltips show shortcuts.",
      where: "Top of the editor, floating bar at the bottom of the canvas, Templates tab in the dock.",
      why: "One primary button (Export), everything else is a quiet action; predictable keyboard navigation.",
      keys: [["V F T H", "tools"], ["Ctrl Z", "undo"], ["Shift S", "snapping"], ["Ctrl '", "grid"], ["Ctrl ;", "guides"], ["Shift R", "rulers"], ["Ctrl 0", "fit"]],
      edge: ["Hover the icons for tooltips with shortcuts", "Toolbar: Tab enters, arrow keys move focus", "e2e selectors use accessible names"],
    },
  },
  "editor-chrome-states": {
    Demo: ChromeStates,
    notes: {
      what: "One empty / loading / error pattern; the Placed badge, frame placeholders, drop targets, selection and focus all come from semantic tokens.",
      where: "Canvas, filmstrip, toasts.",
      why: "Users recognise states instantly and the UI does not drift into different styles.",
      edge: ["Import error — a toast listing the files with an action", "Drop targets highlight empty frames only", "Keyboard focus uses the ring colour, never to be confused with the select colour"],
    },
  },
  "project-screens-adoption": {
    Demo: Screens,
    notes: {
      what: "Home, access re-request, “open in another tab”, the save indicator and missing assets rebuilt on Dialog / EmptyState / Status / Badge.",
      where: "Scenario switcher above the demo.",
      why: "The project screens look and behave like the new editor.",
      edge: ["Empty Home — an EmptyState with two actions", "The save indicator cycles through all 4 states"],
    },
  },
  "dark-theme": {
    Demo: DarkTheme,
    notes: {
      what: "Dark values of the semantic tokens on [data-theme]; defaults to prefers-color-scheme, a switch in the top bar, the choice is stored in the browser.",
      where: "Moon / sun icon in the editor top bar. The demo starts in the theme opposite to the page theme.",
      why: "Working with photos in the evening and in dark surroundings; the pasteboard darkens, book pages do not.",
      keys: [["—", "the icon in the top bar switches the theme"]],
      edge: ["Paper stays light in both themes", "Screenshot tests and axe run in both themes"],
    },
  },
}

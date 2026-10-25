import { ContextInspector } from "@/sandbox/context-inspector"
/* M2.5 Design foundation */
import { pagesName } from "@/sandbox/v7"
import * as React from "react"
import * as Icons from "lucide-react"
import { Images, AlertTriangle, Download } from "lucide-react"
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
import { useTheme } from "@/kit/theme"
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
const rgbOf = (c: string) => {
  const cx = document.createElement("canvas").getContext("2d")
  if (!cx || !c || c.startsWith("var(")) return null
  cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data
  return d[3] < 255 ? null : [d[0], d[1], d[2]]
}
const lumOf = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
/** v4.2: each swatch shows its contrast against --background (text roles need 4.5, borders / focus 3.0). */
function Swatch({ v, theme }: { v: string; theme: string }) {
  const val = useVar(`--${v}`, theme)
  const bg = useVar("--background", theme)
  const a = rgbOf(val), b = rgbOf(bg)
  const cr = a && b && v !== "background" ? (Math.max(lumOf(a), lumOf(b)) + 0.05) / (Math.min(lumOf(a), lumOf(b)) + 0.05) : null
  return (
    <div className="flex flex-col gap-1">
      <div className="h-10 rounded-md border shadow-xs" style={{ background: `var(--${v})` }} />
      <span className="font-mono text-2xs">{v}</span><span className="font-mono text-2xs text-muted-foreground">{val}{cr ? ` · ${cr.toFixed(2)}:1` : ""}</span>
    </div>
  )
}
function TokensSpecimen() {
  const theme = useTheme()
  const roles = ["background", "chrome", "canvas", "paper", "card", "popover", "foreground", "muted-foreground", "primary", "primary-foreground", "secondary", "muted", "accent", "border", "input", "ring", "select", "guide", "success", "warning", "destructive", "success-fg", "warning-fg", "control", "bleed", "guide-solid", "parent", "parent-fg", "parent-soft", "parent-tint", "dpi-low", "dpi-warn"]
  return (
    <div className="flex flex-col gap-5 p-5" data-testid="specimen">
      <div className="flex items-center gap-3">
        <div className="heading text-xl">?specimen</div><span className="text-xs text-muted-foreground">dev/test-only page · tokens resolve live from CSS variables</span>
      </div>
      <div><div className="eyebrow mb-2">Semantic colour roles</div><div className="grid grid-cols-7 gap-3">{roles.map((r) => <Swatch key={r} v={r} theme={theme} />)}</div></div>
      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
        <div><div className="eyebrow mb-2">Type scale · Inter (UI) + Lora (headings), self-hosted woff2 latin + cyrillic</div>
          <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-4">
            <span className="heading text-3xl leading-tight">A week by the sea · 32</span><span className="heading text-2xl">Summer by the sea · 26</span><span className="heading text-xl">Dialog title · 21</span><span className="heading text-lg">Section heading · 18</span>
            <span className="text-base">Base 14 · Body, menu items, list rows</span><span className="text-sm">UI 13 · Inspector labels and values</span><span className="text-xs text-muted-foreground">Caption 12 · 6000 × 4000 px · 14 Jul</span><span className="text-2xs text-muted-foreground">Micro 11 · badges, ruler labels, chips</span><span className="eyebrow">Eyebrow 11</span>
            <span className="mt-2 text-xs text-muted-foreground">v4.1: only these tokens (text-2xs … text-3xl) are allowed; qa fails on text-[Npx]. Book content on the canvas is scaled with the zoom and is outside the UI scale.</span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div><div className="eyebrow mb-2">Radius</div><div className="flex gap-3">{["2xs", "xs", "sm", "md", "lg", "xl"].map((r) => <div key={r} className="flex flex-col items-center gap-1"><div className="size-12 border bg-card shadow-xs" style={{ borderRadius: `var(--radius-${r})` }} /><span className="text-2xs text-muted-foreground">{r}</span></div>)}</div></div>
          <div><div className="eyebrow mb-2">Elevation</div><div className="flex gap-3">{["xs", "sm", "md", "lg"].map((s) => <div key={s} className={cn("grid size-14 place-items-center rounded-lg border bg-card text-2xs text-muted-foreground", { xs: "shadow-xs", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg" }[s])}>{s}</div>)}</div></div>
          <div><div className="eyebrow mb-2">Control heights · xs 28 toolbar · sm 32 panel · md 36 dialog · lg 40 empty state / onboarding</div><div className="flex items-end gap-2">{["xs", "sm", "md", "lg"].map((k) => <div key={k} className="flex w-12 items-center justify-center rounded-md border bg-card text-2xs text-muted-foreground" style={{ height: `var(--control-${k})` }}>{k}</div>)}</div></div>
          <div><div className="eyebrow mb-2">Spacing · 4 px base (half-steps only for icon gaps, badges, dense rows)</div><div className="flex items-end gap-2">{[1, 2, 3, 4, 6, 8, 12].map((n) => <div key={n} className="flex flex-col items-center gap-1"><div className="w-3 rounded-sm bg-select/60" style={{ height: n * 4 }} /><span className="text-2xs tabular-nums text-muted-foreground">{n * 4}</span></div>)}</div></div>
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
          <ToggleButtonGroup selectionMode="single" disallowEmptySelection selectedKeys={[String(size)]} onSelectionChange={(k) => setSize(Number([...k][0]))} aria-label="Icon size" className="gap-0.5 rounded-md bg-muted p-0.5">
            {[14, 16, 20].map((s) => <Toggle key={s} id={String(s)} size="sm" className="h-(--control-xs) px-2 text-xs data-[selected]:bg-background data-[selected]:shadow-sm">{s}</Toggle>)}
          </ToggleButtonGroup>
          <span className="ml-auto">stroke 2 · currentColor · decorative = aria-hidden</span>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {ICONS.map(([n, k]) => { const I = Icons[k] as React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; return <div key={n} className="flex flex-col items-center gap-1.5 rounded-lg border bg-background py-3"><I size={size} aria-hidden /><span className="text-2xs text-muted-foreground">{n}</span></div> })}
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
      <span className="px-2 text-xs tabular-nums text-muted-foreground"><span className="font-medium text-foreground">{pagesName(st.cur)}</span> of {st.doc.spreads.length * 2}</span>
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
    dock={v === "import" ? <Dock left={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Progress aria-label="Importing" value={9} maxValue={20} className="w-32" barClassName="h-1 bg-secondary" />Reading 9 of 20 · IMG_4249.jpg</div>}><div className="flex gap-2 overflow-hidden p-1 pb-2">{photos.slice(0, 9).map((p) => <PhotoThumb key={p.id} src={p.src} w={p.w} h={p.h} className="rounded-xs" />)}{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-(--thumb) w-[110px] shrink-0 animate-pulse rounded-xs bg-muted" />)}</div></Dock> : undefined}
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
      <p className="mt-2 text-sm text-muted-foreground">One empty / loading / error pattern for the whole editor: icon, title, one sentence, one primary action.</p>
      <Button size="md" className="mt-4 px-4 shadow-sm">Add folder…</Button>
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
      {v === "perm" && <AppModal isOpen={open} width={460} isDismissable={false}><DialogHead icon={<FeaturedIcon color="warning" className="mt-0.5"><Icons.ShieldAlert /></FeaturedIcon>} title="Allow access to “Photobooks” again?" sub="Dialog + FeaturedIcon + Button primitives." /><div className="flex justify-end gap-2 border-t px-6 py-3"><Button variant="ghost" size="md" className="px-3" onPress={() => setOpen(false)}>Read-only</Button><Button size="md" className="px-4 shadow-sm" onPress={() => setOpen(false)}>Grant access</Button></div></AppModal>}
      {v === "lock" && <AppModal isOpen={open} width={460} isDismissable={false}><DialogHead icon={<FeaturedIcon className="mt-0.5"><Icons.Lock /></FeaturedIcon>} title="Open in another tab" sub="Only one tab can edit. Edit here and the other tab becomes read-only." /><div className="flex justify-end gap-2 border-t px-6 py-3"><Button variant="ghost" size="md" className="px-3" onPress={() => setOpen(false)}>View only</Button><Button size="md" className="px-4 shadow-sm" onPress={() => setOpen(false)}>Edit here</Button></div></AppModal>}
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

/* ---------------------------------------------------------------- v5: single Procreate-light theme */
function LightTheme() {
  return (
    <div className="h-full bg-chrome text-foreground" data-testid="light-theme">
      <Std features={{ drop: true, handles: true, multi: true }} top={<TopBar views={["grid"]} />} right={<ContextInspector />} />
    </div>
  )
}

export const M25: Record<string, FeatureDef> = {
  "design-tokens": {
    Demo: TokensSpecimen, auto: true,
    notes: {
      what: "Semantic tokens (surfaces, text, accent, selection, drop target, statuses) on top of a primitive palette; Inter / Lora fonts are local woff2 files (Latin + Cyrillic).",
      where: "Dev page ?specimen; in the product — all chrome styling.",
      why: "One token edit changes the whole UI; zero third-party font requests.",
      keys: [["—", "single Procreate-light theme (v5)"]],
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
      keys: [["V F T H", "tools"], ["Ctrl+Z", "undo"], ["Shift+S", "snapping"], ["Ctrl+'", "grid"], ["Ctrl+;", "guides"], ["Shift+R", "rulers"], ["Ctrl+0", "fit"]],
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
  "light-theme": {
    Demo: LightTheme,
    notes: {
      what: "One theme since v5 — Procreate light: canvas surround #C8CACB, one chrome tone #E1E1E1 for bars, panels and cards (since v6.1), controls #D7D7D7, white only for paper, text #393738. Since v6 it is fully grayscale: primary buttons are ink #232223 with #F2F2F2 text (hover #3A3839), selected objects get a 2 px #393738 outline and focus a 2 px #3A3839 ring — there is no blue anywhere.",
      where: "The whole UI. There is no theme toggle and no dark theme.",
      why: "Depth comes from tone steps, not white-on-white cards and borders; book pages stay pure white so photos are judged on paper.",
      keys: [["—", "no theme switch"]],
      edge: ["Paper stays #ffffff", "Secondary text #535152 keeps ≥ 4.5:1 on every surface, the surround included", "No accent colour: links are #393738 with an underline; primary buttons carry text only, never an icon"],
    },
  },

}

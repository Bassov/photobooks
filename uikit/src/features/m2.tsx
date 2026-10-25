import { ContextInspector } from "@/sandbox/context-inspector"
/* M2 Project on disk */
import * as React from "react"
import { FolderOpen, Save, HardDrive, Loader2, Check, CloudOff, Lock, ShieldAlert, RotateCw, AlertTriangle, ImageOff, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/uui/Badge"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { AppModal } from "@/components/app/ui"
import { useStudio } from "@/sandbox/store"
import { TopBar, SaveStatus } from "@/sandbox/chrome"
import { InspectorPanel, PhotoSection, GeometrySection, EmptyInspector, useSelected } from "@/sandbox/inspector"
import { P } from "@/data"
import { Std, WithScenarios } from "./parts"
import { HomeScreen, FolderPicker, RelinkDialog, DialogHead } from "./screens"
import type { FeatureDef } from "./types"

/* ---------------------------------------------------------------- autosave agent: debounce, defer during drag, error + retry */
function Autosave({ fail = false, delay = 900 }: { fail?: boolean; delay?: number }) {
  const st = useStudio()
  const [last, setLast] = React.useState<string | null>(null)
  const [failNext, setFailNext] = React.useState(fail)
  const docRef = React.useRef(st.doc)
  React.useEffect(() => {
    if (docRef.current === st.doc) return
    docRef.current = st.doc
    if (st.dragging) return
    st.setSaveState("dirty")
    const t = setTimeout(() => {
      st.setSaveState("saving")
      setTimeout(() => {
        if (failNext) {
          st.setSaveState("error")
          st.toast({ tone: "error", icon: <CloudOff />, title: "Couldn’t save to “Photobooks”", description: "The disk is full or the folder is read-only. Your edits are kept in this tab.", action: { label: "Retry", onAction: () => { setFailNext(false); st.setSaveState("saving"); setTimeout(() => { st.setSaveState("saved"); setLast(now()) }, 500) } } }, 9000)
        } else { st.setSaveState("saved"); setLast(now()) }
      }, 450)
    }, delay)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.doc, st.dragging])
  return (
    <div className="absolute right-3 top-3 z-30 w-[250px] rounded-lg border bg-popover/95 p-3 text-xs shadow-md" data-testid="autosave-panel">
      <div className="mb-2 flex items-center gap-2 font-semibold"><Save className="size-3.5" />Autosave</div>
      <div className="flex items-center justify-between"><SaveStatus /><span className="tabular-nums text-muted-foreground">{last ? `last ${last}` : "not yet"}</span></div>
      <div className="mt-2 border-t pt-2"><Switch size="sm" isSelected={failNext} onChange={setFailNext} className="w-full flex-row-reverse justify-between text-xs font-normal">Simulate disk error on next save</Switch></div>
      <div className="mt-2 leading-relaxed text-muted-foreground">Change something: drag a photo or edit X in the inspector. Saving happens after {delay} ms of quiet, never during a drag.</div>
    </div>
  )
}
const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
function GeoTab() { const { f } = useSelected(); return f ? <><PhotoSection /><GeometrySection rotation={false} /></> : <EmptyInspector /> }

/* ---------------------------------------------------------------- open-save-project */
function OpenSave() {
  const [stage, setStage] = React.useState<"start" | "picker" | "editor">("start")
  const [lib, setLib] = React.useState("")
  if (stage === "editor") return <Std features={{ drop: true }} wrap={SaveKeys}
    top={<TopBar title={`${lib.split("/").pop()} / Summer by the sea`} views={[]} right={<Button variant="outline" size="sm" className="gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-4" onPress={() => setStage("start")} data-testid="restart"><RotateCw />Restart demo</Button>} />}
    right={<InspectorPanel frame={<GeoTab />} />} />
  return (
    <div className="grid h-full place-items-center bg-background">
      <div className="w-[520px] text-center">
        <FeaturedIcon size="xl" theme="outline" className="mx-auto mb-6"><HardDrive /></FeaturedIcon>
        <div className="heading text-2xl">Where should your books live?</div>
        <p className="mx-auto mt-2 max-w-[440px] text-sm leading-relaxed text-muted-foreground">Choose one folder on your disk as your library. Every book is saved there as files, next to cached previews. Nothing is uploaded. You can change the folder later in Settings.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button size="md" className="gap-1.5 px-4 shadow-sm [&_svg]:size-4" onPress={() => setStage("picker")} data-testid="new-library">Choose library folder…</Button>
        </div>
        <div className="mt-8 rounded-lg border bg-card px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground shadow-xs"><Info className="mr-1.5 inline size-3.5" />An empty folder starts a new library; a folder that already has Photobooks books opens them. The browser asks once for permission to edit the folder.</div>
      </div>
      <FolderPicker isOpen={stage === "picker"} title="Choose the library folder" onCancel={() => setStage("start")} onPick={(p) => { setLib(p); setStage("editor") }} />
    </div>
  )
}
function SaveKeys({ children }: { children: React.ReactNode }) {
  const st = useStudio()
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); st.setSaveState("saving"); setTimeout(() => { st.setSaveState("saved"); st.toast({ tone: "success", icon: <Check />, title: "Saved to library", description: "book.json · 14 KB" }, 2500) }, 500) } }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  }, [st])
  return <>{children}</>
}

/* ---------------------------------------------------------------- fix-open-save-adopt-hydrate */
function AdoptHydrate() {
  const [step, setStep] = React.useState<"session" | "adopting" | "saved" | "reloading" | "hydrated">("session")
  const [pct, setPct] = React.useState(0)
  const [pick, setPick] = React.useState(false)
  const run = (to: "saved" | "hydrated", from: "adopting" | "reloading") => {
    setStep(from); setPct(0); let i = 0
    const t = setInterval(() => { i += 8; setPct(i); if (i >= 100) { clearInterval(t); setStep(to) } }, 60)
  }
  const banner = step === "session" ? (
    <div className="flex items-center gap-3 border-b  bg-warning/10 px-4 py-2 text-sm" data-testid="session-banner">
      <AlertTriangle className="size-4 text-warning" /><span><b className="font-semibold">Not saved to disk.</b> This book lives only in this tab — choose your library folder to keep it.</span>
      <Button size="xs" className="ml-auto px-3 text-xs shadow-sm" onPress={() => setPick(true)} data-testid="adopt">Save to library…</Button>
    </div>
  ) : step === "adopting" || step === "reloading" ? (
    <div className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2 text-sm">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />{step === "adopting" ? "Copying book and 20 previews into the library…" : "Reloading · restoring previews from the persistent cache…"}
      <Progress aria-label="Progress" value={pct} className="ml-auto w-40" barClassName="h-1 bg-secondary" />
    </div>
  ) : (
    <div className="flex items-center gap-3 border-b  bg-success/5 px-4 py-2 text-sm">
      <Check className="size-4 text-success" />{step === "saved" ? "Saved in ~/Pictures/Photobooks. Session work was adopted — nothing re-imported." : "Restored instantly: 20 previews from the OPFS cache, 0 re-decoded."}
      {step === "saved" && <Button variant="outline" size="xs" className="ml-auto gap-1.5 px-3 text-xs shadow-xs [&_svg]:size-3.5" onPress={() => run("hydrated", "reloading")} data-testid="reload"><RotateCw />Reload app</Button>}
      {step === "hydrated" && <Badge className="ml-auto" color="success" dot>hydrated from cache</Badge>}
    </div>
  )
  return (
    <div className="flex h-full flex-col">
      {banner}
      <div className="relative min-h-0 flex-1">
        <Std key={step === "hydrated" ? "h" : "s"} features={{ drop: true }} top={<TopBar exportPrimary={false} views={[]} save={step !== "session"} title={step === "session" ? "Untitled (session)" : "Summer by the sea"} />} right={<InspectorPanel frame={<GeoTab />} />} />
      </div>
      <FolderPicker isOpen={pick} onCancel={() => setPick(false)} onPick={() => { setPick(false); run("saved", "adopting") }} />
    </div>
  )
}

/* ---------------------------------------------------------------- permissions-locks-ux */
function PermLocks() {
  return (
    <WithScenarios items={[["perm", "Access lost"], ["denied", "Access denied"], ["tab", "Open in another tab"], ["ok", "All good"]]} note="switch scenarios; dialog buttons work"
      render={(v, set) => <PermScene key={v} v={v} set={set} />} />
  )
}
function PermScene({ v, set }: { v: string; set: (v: string) => void }) {
  const [asking, setAsking] = React.useState(false)
  const readOnly = v === "denied"
  return (
    <div className="flex h-full flex-col">
      {readOnly && (
        <div className="flex items-center gap-3 border-b  bg-warning/10 px-4 py-2 text-sm" data-testid="readonly-banner">
          <Lock className="size-4 text-warning" /><span><b className="font-semibold">Read-only.</b> Photobooks can’t write to “Photobooks”. You can look around; edits are disabled.</span>
          <Button size="xs" variant="outline" className="ml-auto px-3 text-xs shadow-xs" onPress={() => set("perm")}>Try again</Button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <Std features={readOnly ? {} : { drop: true }} top={<TopBar exportPrimary={false} views={[]} save={!readOnly} right={readOnly ? <Badge color="warning" icon={<Lock />}>Read-only</Badge> : undefined} />} right={<InspectorPanel frame={<GeoTab />} />} />
        {v === "perm" && (
          <AppModal isOpen width={480} isDismissable={false}>
            <DialogHead icon={<FeaturedIcon color="warning" className="mt-0.5"><ShieldAlert /></FeaturedIcon>} title="Allow Photobooks to keep editing “Photobooks”?" sub="The browser forgot the folder permission after a restart. Your book is safe on disk; we need access again to save." />
            {asking && <div className="mx-6 mb-3 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Waiting for the browser prompt…</div>}
            <div className="flex justify-end gap-2 border-t px-6 py-3">
              <Button variant="ghost" size="md" className="px-3" onPress={() => set("denied")} data-testid="perm-deny">Open read-only</Button>
              <Button size="md" className="px-4 shadow-sm" onPress={() => { setAsking(true); setTimeout(() => set("ok"), 900) }} data-testid="perm-grant">Grant access</Button>
            </div>
          </AppModal>
        )}
        {v === "tab" && (
          <AppModal isOpen width={480} isDismissable={false}>
            <DialogHead icon={<FeaturedIcon className="mt-0.5"><Lock /></FeaturedIcon>} title="This book is open in another tab" sub="Only one tab can edit a library at a time so changes never overwrite each other. Edit here instead and the other tab becomes read-only." />
            <div className="flex justify-end gap-2 border-t px-6 py-3">
              <Button variant="ghost" size="md" className="px-3" onPress={() => set("denied")}>View read-only</Button>
              <Button size="md" className="px-4 shadow-sm" onPress={() => set("ok")} data-testid="take-over">Edit in this tab</Button>
            </div>
          </AppModal>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- missing-assets-relink */
function Relink() {
  return <Std cur={2} missing={["p11", "p13"]} features={{ drop: true }} top={<TopBar exportPrimary={false} />} canvasExtra={<RelinkLayer />} right={<InspectorPanel frame={<MissingTab />} />} />
}
function RelinkLayer() {
  const st = useStudio()
  const [open, setOpen] = React.useState(true)
  const n = st.missing.size
  return (
    <>
      {n > 0 && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border  bg-popover px-3 py-2 text-sm shadow-md" data-testid="missing-pill">
          <ImageOff className="size-4 text-warning" />{n} photos missing · export paused
          <Button size="xs" variant="outline" className="px-3 text-xs shadow-xs" onPress={() => setOpen(true)}>Review…</Button>
        </div>
      )}
      <RelinkDialog isOpen={open} onClose={() => setOpen(false)}
        rows={[{ id: "p11", status: "missing", folder: "~/Pictures/Summer 2025 · not at last location" }, { id: "p13", status: "missing", folder: "~/Pictures/Summer 2025/raw · folder renamed" }, { id: "p05", status: "modified", folder: "~/Pictures/Summer 2025 · edited 12 Oct, 18:04" }, { id: "p16", status: "ok", folder: "~/Pictures/Summer 2025" }]}
        onResolve={(ids) => { st.setMissing(new Set([...st.missing].filter((x) => !ids.includes(x)))); setOpen(false); st.toast({ tone: "success", icon: <Check />, title: "Photos relinked", description: "Frames show the photos again; crops were kept." }) }} />
    </>
  )
}
function MissingTab() {
  const { f, st } = useSelected()
  if (!f) return <EmptyInspector hint="Select the striped frame to see the missing photo." />
  if (f.photo && st.missing.has(f.photo)) return (
    <div className="p-4">
      <div className="flex gap-3 rounded-lg border  bg-warning/5 p-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-md border border-dashed  text-warning"><ImageOff className="size-5" /></div>
        <div className="min-w-0 text-sm"><div className="truncate font-medium">{P(f.photo).name}</div><div className="text-xs text-muted-foreground">Last seen in ~/Pictures/Summer 2025</div><Badge color="error" className="mt-2" dot>Missing</Badge></div>
      </div>
    </div>
  )
  return <><PhotoSection /><GeometrySection rotation={false} /></>
}

export const M2: Record<string, FeatureDef> = {
  "open-save-project": {
    Demo: OpenSave,
    notes: {
      what: "Choose the one library folder (empty → new library, existing → its books open), then the editor with a save indicator; Ctrl+S saves explicitly. There is no “open another library”: a different library means changing the library folder.",
      where: "First run → “Choose library folder…” → system folder picker (simulated) → editor. Later: Settings → Library or Home → “Change library folder…”.",
      why: "The user owns the files: a book is a folder on disk, not an account.",
      keys: [["Ctrl+S", "save now"], ["Enter", "choose the folder in the picker"]],
      edge: ["Cancelling the picker returns to the start screen without errors", "Browser without File System Access → the app never starts; the unsupported-browser screen shows instead (#/screen/unsupported-browser)", "Picking a system folder (Desktop root, home) → a warning suggesting a dedicated subfolder", "Press “Restart demo” to run the scenario again"],
    },
  },
  "fix-open-save-adopt-hydrate": {
    Demo: AdoptHydrate,
    notes: {
      what: "If photos were imported before the library folder was set (or while access to it was denied), “Save to library…” moves the book and previews into the one library folder without re-importing; after a reload previews are restored from the cache.",
      where: "Yellow banner above the editor; then a green status.",
      why: "Work done before saving is never lost, and reopening does not wait for decoding.",
      edge: ["Steps: Save to library… → choose the library folder → Reload app", "v4: rare — the library folder is chosen on first run, so this only covers work done while access was missing", "If the browser evicted the cache, previews are rebuilt in the background while the book opens immediately"],
    },
  },
  autosave: {
    Demo: () => <Std features={{ drop: true, handles: true, multi: true }} canvasExtra={<Autosave />} right={<ContextInspector />} />,
    notes: {
      what: "Debounced save after a pause; the top bar indicator goes Unsaved → Saving… → Saved. A disk error shows a toast with Retry; edits stay in the tab.",
      where: "Indicator left of the zoom control in the top bar; toasts at the bottom right.",
      why: "The user never thinks about saving but always sees the status.",
      keys: [["Ctrl+S", "save immediately (flush the debounce)"]],
      edge: ["Writes are deferred while dragging until release", "Closing the tab while Unsaved → beforeunload warning", "Turn on “Simulate disk error” to see the error and Retry"],
    },
  },
  "permissions-locks-ux": {
    Demo: PermLocks,
    notes: {
      what: "Re-request folder access after a browser restart; an “open in another tab” lock with an “Edit in this tab” choice.",
      where: "Modal dialogs over the editor; a read-only banner when access is denied.",
      why: "Never lose access silently and never allow two writers in the library.",
      keys: [["Enter", "primary dialog action"], ["Esc", "disabled — a choice is required"]],
      edge: ["Denied → read-only mode with a “Try again” button", "Taking over the lock makes the other tab read-only", "Access to the library folder can’t be regained (folder deleted) → Home shows “Can’t find your library folder” with Try again / Change folder…", "The dialog cannot be dismissed — the state must be explicit"],
    },
  },
  "recents-home": {
    h: 760,
    Demo: () => <WithScenarios items={[["ok", "Library"], ["empty", "Empty library"], ["missing", "Folder missing"]]} note="one library folder · path + Change in the top bar"
      render={(v) => <HomeScreen key={v} empty={v === "empty"} libState={v === "missing" ? "missing" : "ok"} />} />,
    notes: {
      what: "The books of your one library as realistic book objects (4:5, landscape, square) with a meta line; create a titled book, rename, duplicate, remove from the ⋯ menu. The top bar holds the library folder path with Change, and Settings. No recent-libraries list, no switching.",
      where: "The app start screen (#/screen/home).",
      why: "A returning user continues straight away; one library keeps the mental model simple: one folder holds all books.",
      keys: [["Enter", "open book / confirm rename"], ["Esc", "cancel"]],
      edge: ["Change → a confirm explains the books stay in the old folder, then the folder picker; a banner offers “Switch back”", "Library folder missing (drive disconnected, renamed) → “Can’t find your library folder” with Try again / Change folder…; Create book is hidden", "Picking the same folder again is a no-op", "Empty library → example cover “Fog”, “Your first story starts here.” and Create book", "Remove uses an AlertDialog; photos on disk stay", "Hover deepens the cover shadow; covers never lift"],
    },
  },
  "missing-assets-relink": {
    Demo: Relink,
    notes: {
      what: "Missing / modified dialog: “Rescan folder” finds files by hash in a worker, “Locate folder…” points at the folder they moved to, “Use new version” accepts a modified file; then Resolve.",
      where: "Opens when the book is opened; an “N photos missing” pill above the canvas; hatched frames.",
      why: "Renaming a folder must not break the book; export waits until everything is found.",
      edge: ["Skip for now — the book stays editable, frames stay hatched", "Modified file: the crop is kept", "Hash mismatch — the file is never substituted silently", "“Locate folder…” picks the folder the photos moved to (folder picker, no single-file picker); every missing photo in it is matched by hash"],
    },
  },
}

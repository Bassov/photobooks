import { ContextInspector } from "@/sandbox/context-inspector"
/* Shared building blocks for feature pages: standard editor assembly + small specimen cards. */
import * as React from "react"
import { setInspectorOpen } from "@/sandbox/inspectorState"
import { resetCoverPhoto, resetMasters } from "@/sandbox/v7"
import { UNSAFE_PortalProvider } from "react-aria"
import { StudioProvider, useStudio, type Features, type View, type Node, type Book } from "@/sandbox/store"
import { makeDoc, type Doc } from "@/sandbox/model"
import { EditorFrame, TopBar, SpreadsPanel, Dock, StatusLine, Pager, Toasts } from "@/sandbox/chrome"
import { BOOKS } from "./screens"
import { SiteViewer } from "./site-viewer"
import { Viewport } from "@/sandbox/viewport"

export function Std({ init, features, view, cur = 2, sel, missing, node, mode, book, top, left, right, dock, overlay, canvasExtra, pager = false, wrap, pick, keep }: {
  init?: Doc | (() => Doc); features?: Features; view?: Partial<View>; cur?: number; sel?: string[]; missing?: string[]
  node?: Node; mode?: "pages" | "masters"; book?: Partial<Book>
  top?: React.ReactNode; left?: React.ReactNode | false; right?: React.ReactNode | false; dock?: React.ReactNode | false; overlay?: React.ReactNode
  canvasExtra?: React.ReactNode; pager?: boolean; wrap?: React.ComponentType<{ children: React.ReactNode }>
  /** preselect the n-th frame (or several) of the current spread on mount */
  pick?: number | number[]
  /** v0.8.1: keep the module-level cover / masters state (the #/demo restores it per book) */
  keep?: boolean
}) {
  const W = wrap ?? React.Fragment
  // each demo mounts with the inspector open; the remembered state only lives within one demo
  React.useState(() => { setInspectorOpen(true); if (!keep) { resetCoverPhoto(); resetMasters() } return 0 })
  return (
    <StudioProvider init={init ?? (() => makeDoc())} features={features} view={view} cur={cur} sel={sel} missing={missing} node={node} mode={mode} book={book}>
      {pick !== undefined && <AutoPick pick={pick} />}
      <W><EditorFrame
        top={top ?? <PreviewTopBar />}
        left={left === false ? undefined : left ?? <SpreadsPanel />}
        right={right === false ? undefined : right ?? <ContextInspector />}
        canvas={<Viewport><StatusLine />{pager && <Pager />}{canvasExtra}</Viewport>}
        dock={dock === false ? undefined : dock ?? <Dock />}
        overlay={<>{overlay}<Toasts /></>} /></W>
    </StudioProvider>
  )
}
function AutoPick({ pick }: { pick: number | number[] }) {
  const st = useStudio()
  React.useEffect(() => { const fs = st.doc.spreads[st.cur]?.frames ?? []; st.setSel((Array.isArray(pick) ? pick : [pick]).map((i) => fs[i]?.id).filter(Boolean) as string[]) }, [])
  return null
}


/** Kit editor Preview: in-app current-book preview (not the published Site stage). */
function PreviewTopBar(props: React.ComponentProps<typeof TopBar>) {
  const st = useStudio()
  const [open, setOpen] = React.useState(false)
  const card = { ...BOOKS[0], id: "preview", title: props.title ?? "Untitled book", cover: "", spreads: st.doc.spreads.length, status: "draft" as const }
  return (
    <>
      <TopBar {...props} onPreview={() => setOpen(true)} />
      {open && (
        <div className="fixed inset-0 z-[80]" data-testid="book-preview">
          <SiteViewer single title="Preview" onClose={() => setOpen(false)} books={[card]} initial={{ page: "book", book: "preview", spread: st.cur }} />
        </div>
      )}
    </>
  )
}

/* Scenario switcher strip above a demo (kit chrome, not product UI) */
import { Tabs as KTabs, TabList as KTabList, Tab as KTab } from "@/components/ui/tabs"
export function Scenarios({ items, value, onChange, note }: { items: [string, string][]; value: string; onChange: (v: string) => void; note?: React.ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 bg-chrome px-3" data-testid="scenarios">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Scenario</span>
      <KTabs selectedKey={value} onSelectionChange={(k) => onChange(String(k))}>
        <KTabList aria-label="Scenario" size="sm" className="bg-field">
          {items.map(([id, l]) => <KTab key={id} id={id}>{l}</KTab>)}
        </KTabList>
      </KTabs>
      {note && <span className="ml-auto truncate text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}
export function WithScenarios({ items, initial, render, note }: { items: [string, string][]; initial?: string; render: (v: string, set: (v: string) => void) => React.ReactNode; note?: React.ReactNode }) {
  const [v, setV] = React.useState(initial ?? items[0][0])
  return (
    <div className="flex h-full flex-col">
      <Scenarios items={items} value={v} onChange={setV} note={note} />
      <ScenarioStage>{render(v, setV)}</ScenarioStage>
    </div>
  )
}

/* Overlays of a scenario (modal dialogs, toasts) portal into the stage below the switcher, so the switcher stays usable. */
function ScenarioStage({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  return (
    <div ref={ref} className="relative isolate min-h-0 flex-1 overflow-hidden [transform:translateZ(0)]" data-testid="scenario-stage">
      {ready && <UNSAFE_PortalProvider getContainer={() => ref.current}>{children}</UNSAFE_PortalProvider>}
    </div>
  )
}

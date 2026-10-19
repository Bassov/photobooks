/* Shared building blocks for feature pages: standard editor assembly + small specimen cards. */
import * as React from "react"
import { UNSAFE_PortalProvider } from "react-aria"
import { FileCode2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { StudioProvider, useStudio, type Features, type View } from "@/sandbox/store"
import { makeDoc, type Doc } from "@/sandbox/model"
import { EditorFrame, TopBar, SpreadsPanel, Dock, StatusLine, Pager, Toasts } from "@/sandbox/chrome"
import { Viewport } from "@/sandbox/viewport"
import { InspectorPanel, GeometrySection, PhotoSection, EmptyInspector, useSelected } from "@/sandbox/inspector"

export function Std({ init, features, view, cur = 2, sel, missing, top, left, right, dock, overlay, canvasExtra, pager = true, wrap, pick }: {
  init?: Doc | (() => Doc); features?: Features; view?: Partial<View>; cur?: number; sel?: string[]; missing?: string[]
  top?: React.ReactNode; left?: React.ReactNode | false; right?: React.ReactNode | false; dock?: React.ReactNode | false; overlay?: React.ReactNode
  canvasExtra?: React.ReactNode; pager?: boolean; wrap?: React.ComponentType<{ children: React.ReactNode }>
  /** preselect the n-th frame (or several) of the current spread on mount */
  pick?: number | number[]
}) {
  const W = wrap ?? React.Fragment
  return (
    <StudioProvider init={init ?? (() => makeDoc())} features={features} view={view} cur={cur} sel={sel} missing={missing}>
      {pick !== undefined && <AutoPick pick={pick} />}
      <W><EditorFrame
        top={top ?? <TopBar />}
        left={left === false ? undefined : left ?? <SpreadsPanel />}
        right={right === false ? undefined : right ?? <InspectorPanel frame={<DefaultFrameTab />} />}
        canvas={<Viewport><StatusLine />{pager && <Pager />}{canvasExtra}</Viewport>}
        dock={dock === false ? undefined : dock ?? <Dock />}
        overlay={<>{overlay}<Toasts /></>} /></W>
    </StudioProvider>
  )
}
function AutoPick({ pick }: { pick: number | number[] }) {
  const st = useStudio()
  React.useEffect(() => { const fs = st.doc.spreads[st.cur]?.frames ?? []; st.setSel((Array.isArray(pick) ? pick : [pick]).map((i) => fs[i]?.id).filter(Boolean) as string[]) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
export function DefaultFrameTab() {
  const { f } = useSelected()
  if (!f) return <EmptyInspector />
  return <><PhotoSection /><GeometrySection rotation={false} /></>
}

/* ---------------------------------------------------------------- specimen cards (static pages) */
export function SpecCard({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 dark:bg-black/15">
        <span className="text-muted-foreground [&_svg]:size-4">{icon ?? <FileCode2 />}</span>
        <span className="text-[13px] font-semibold">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
/** padded column of specimen cards */
export const Dev = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-4 p-4">{children}</div>

/* Scenario switcher strip above a demo (kit chrome, not product UI) */
import { Tabs as KTabs, TabList as KTabList, Tab as KTab } from "@/components/ui/tabs"
export function Scenarios({ items, value, onChange, note }: { items: [string, string][]; value: string; onChange: (v: string) => void; note?: React.ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-dashed bg-muted/50 px-3 dark:bg-black/20" data-testid="scenarios">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Scenario</span>
      <KTabs selectedKey={value} onSelectionChange={(k) => onChange(String(k))}>
        <KTabList aria-label="Scenario" size="sm" className="bg-background/70 dark:bg-black/25">
          {items.map(([id, l]) => <KTab key={id} id={id}>{l}</KTab>)}
        </KTabList>
      </KTabs>
      {note && <span className="ml-auto truncate text-[11.5px] text-muted-foreground">{note}</span>}
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

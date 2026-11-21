/* Stage 3: the #/demo stage switch for feature pages — the same stages DemoApp renders, inside an isolated session,
   with optional initial UI state per stage. Clicking on continues exactly as in #/demo (e.g. Create book → editor). */
import * as React from "react"
import { DemoSessionProvider, UiScaleCtx, useSession, useStageScale, type SessionState, type UiScale } from "./session"
import { DemoWelcome } from "./welcome"
import { DemoLibrary, type LibraryInit } from "./library"
import { DemoEditor } from "./editor"
import { DemoSettings, type PrintInit, type SettingsSection } from "./settings"
import type { HostingInit } from "./hosting"
import { DemoSite } from "./site"
import type { SiteState } from "@/features/site-viewer"
import { UnsupportedScreen } from "@/features/unsupported"

export type RootInit = {
  session?: Partial<SessionState>
  welcome?: { picking?: boolean }
  library?: LibraryInit
  editor?: { dialog?: null | "publish" | "print"; preview?: boolean | Partial<SiteState> }
  settings?: { section?: SettingsSection; print?: PrintInit; hosting?: HostingInit; focusInterface?: UiScale }
  site?: Partial<SiteState>
}
function Stages({ init }: { init: RootInit }) {
  const d = useSession().useDemo()
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  /* interface-size D4: the stage box (the parent) is the "window" the clamp reads */
  const s = useStageScale(d.uiScale, el?.parentElement ?? null)
  return (
    <UiScaleCtx.Provider value={s}>
    <div ref={setEl} className="h-full w-full overflow-hidden bg-background text-foreground" style={s === 100 ? undefined : { zoom: s / 100 }} data-testid="demo-root" data-demo-stage={d.stage} key={d.nonce}>
      {d.stage === "welcome" && <DemoWelcome initialPicking={init.welcome?.picking} />}
      {d.stage === "library" && <DemoLibrary init={init.library} />}
      {d.stage === "editor" && d.open && <DemoEditor key={d.open} id={d.open} initialDialog={init.editor?.dialog} initialPreview={init.editor?.preview} />}
      {d.stage === "settings" && <DemoSettings initialSection={init.settings?.section} print={init.settings?.print} hosting={init.settings?.hosting} focusInterface={init.settings?.focusInterface} />}
      {d.stage === "site" && d.open && <DemoSite key={`${d.open}-${d.siteEntry}`} id={d.open} initial={init.site} />}
      {d.stage === "unsupported" && <UnsupportedScreen variant={d.unsupported?.variant ?? "other"} browserName={d.unsupported?.browserName} />}
    </div>
    </UiScaleCtx.Provider>
  )
}
/** A #/demo session in a box: `init.session` picks the stage and books, the rest seeds that stage's UI state. */
export function DemoRoot({ init = {} }: { init?: RootInit }) {
  return <DemoSessionProvider initial={init.session}><Stages init={init} /></DemoSessionProvider>
}

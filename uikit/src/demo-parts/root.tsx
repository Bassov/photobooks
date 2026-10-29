/* Stage 3: the #/demo stage switch for feature pages — the same stages DemoApp renders, inside an isolated session,
   with optional initial UI state per stage. Clicking on continues exactly as in #/demo (e.g. Create book → editor). */
import { DemoSessionProvider, useSession, type SessionState } from "./session"
import { DemoWelcome } from "./welcome"
import { DemoLibrary, type LibraryInit } from "./library"
import { DemoEditor } from "./editor"
import { DemoSettings, type SettingsSection } from "./settings"
import { DemoSite } from "./site"
import type { SiteState } from "@/features/site-viewer"

export type RootInit = {
  session?: Partial<SessionState>
  welcome?: { picking?: boolean }
  library?: LibraryInit
  editor?: { dialog?: null | "publish" | "print"; preview?: boolean }
  settings?: { section?: SettingsSection }
  site?: Partial<SiteState>
}
function Stages({ init }: { init: RootInit }) {
  const d = useSession().useDemo()
  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground" data-testid="demo-root" data-demo-stage={d.stage} key={d.nonce}>
      {d.stage === "welcome" && <DemoWelcome initialPicking={init.welcome?.picking} />}
      {d.stage === "library" && <DemoLibrary init={init.library} />}
      {d.stage === "editor" && d.open && <DemoEditor key={d.open} id={d.open} initialDialog={init.editor?.dialog} initialPreview={init.editor?.preview} />}
      {d.stage === "settings" && <DemoSettings initialSection={init.settings?.section} />}
      {d.stage === "site" && d.open && <DemoSite key={`${d.open}-${d.siteEntry}`} id={d.open} initial={init.site} />}
    </div>
  )
}
/** A #/demo session in a box: `init.session` picks the stage and books, the rest seeds that stage's UI state. */
export function DemoRoot({ init = {} }: { init?: RootInit }) {
  return <DemoSessionProvider initial={init.session}><Stages init={init} /></DemoSessionProvider>
}

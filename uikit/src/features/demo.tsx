/* v0.8 §5 — #/demo: one clickable end-to-end prototype. State lives in memory (module scope) for the session.
   Stage 2: assembled from src/demo-parts (pure extraction, no visual / behaviour change). */
import { DEMO_SESSION, type Stage } from "@/demo-parts/session"
import { DemoLibrary } from "@/demo-parts/library"
import { DemoWelcome } from "@/demo-parts/welcome"
import { DemoEditor } from "@/demo-parts/editor"
import { DemoSettings } from "@/demo-parts/settings"
import { DemoSite } from "@/demo-parts/site"

const { S, set, useDemo } = DEMO_SESSION
;(window as unknown as { __demo: object }).__demo = { go: (stage: Stage) => set({ stage }), state: () => S, reset: () => set({ stage: "welcome", path: "", books: [], open: null, nonce: S.nonce + 1, siteEntry: "catalog" }), openSite: (entry: "catalog" | "book" = "catalog") => set({ stage: "site", siteEntry: entry }) }

export function DemoApp() {
  const d = useDemo()
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground" data-testid="demo" data-demo-stage={d.stage} key={d.nonce}>
      {d.stage === "welcome" && <DemoWelcome />}
      {d.stage === "library" && <DemoLibrary />}
      {d.stage === "editor" && d.open && <DemoEditor key={d.open} id={d.open} />}
      {d.stage === "settings" && <DemoSettings />}
      {d.stage === "site" && d.open && <DemoSite key={`${d.open}-${d.siteEntry}`} id={d.open} />}
    </div>
  )
}


import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./kit/kit.css"
import { useRoute, href, parse } from "./kit/router"
import { DemoApp } from "./features/demo"
import { IndexPage, FeaturePage, ScreenPage } from "./kit/Shell"
import { ComponentsPage } from "./kit/ComponentsPage"
import { CreditsPage } from "./kit/Credits"
import { PAGES, MANIFEST, SCREENS, pageIndex, screenIndex, featuresOn } from "./kit/pages"
import { SCREEN_DEFS } from "./features/screen-demos"
import { FEATURES } from "./features/registry"

/** #/full/<screen-id | feature-slug> — the demo alone, full viewport (theme via ?theme=) */
function FullPage({ id }: { id: string }) {
  const def = SCREEN_DEFS[id]
  const Demo = def?.Demo ?? (def?.from ? FEATURES[def.from]?.Demo : undefined) ?? FEATURES[id]?.Demo
  if (!Demo) return <div data-testid="not-found">No demo {id}</div>
  return <div className="h-screen w-screen overflow-hidden bg-background text-foreground" data-testid="full"><Demo /></div>
}

// The index restores its own scroll position; keep the browser from fighting it.
if ("scrollRestoration" in history) history.scrollRestoration = "manual"

function App() {
  const r = useRoute()
  useEffect(() => {
    // Alt+← / Alt+→ : previous / next kit page
    const on = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return
      const cur = parse()
      const d = e.key === "ArrowRight" ? 1 : -1
      if (cur.name === "screen") {
        const i = screenIndex(cur.id), n = i + d
        if (i >= 0 && n >= 0 && n < SCREENS.length) { e.preventDefault(); location.hash = href.screen(SCREENS[n].id).slice(1) }
        return
      }
      const i = cur.name === "feature" ? pageIndex(cur.slug) : -1
      const n = i + d
      if (i >= 0 && n >= 0 && n < PAGES.length) { e.preventDefault(); location.hash = href.feature(PAGES[n].slug).slice(1) }
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])
  useEffect(() => {
    document.title = r.name === "feature" ? `${r.slug} · Photobooks UI kit` : r.name === "screen" ? `${SCREENS.find((s) => s.id === r.id)?.title ?? r.id} · Photobooks UI kit` : r.name === "demo" ? "Interactive demo · Photobooks UI kit" : r.name === "components" ? "Components · Photobooks UI kit" : r.name === "credits" ? "Photo credits · Photobooks UI kit" : "Photobooks UI kit"
  }, [r])
  if (r.name === "full") return <FullPage key={r.id} id={r.id} />
  if (r.name === "demo") return <DemoApp />
  if (r.name === "components") return <ComponentsPage />
  if (r.name === "credits") return <CreditsPage />
  if (r.name === "feature") return <FeaturePage key={r.slug} slug={r.slug} />
  if (r.name === "screen") return <ScreenPage key={r.id} id={r.id} />
  return <IndexPage />
}

// Exposed for scripts/qa.mjs: manifest ↔ registry ↔ screens consistency.
;(window as unknown as { __kit: object }).__kit = {
  pages: PAGES.map((p) => p.slug),
  order: PAGES.map((p) => p.slug),
  screens: SCREENS.map((s) => ({ id: s.id, features: featuresOn(s.id).map((p) => p.slug) })),
  noScreen: MANIFEST.filter((p) => !SCREENS.some((s) => s.id === p.screen)).map((p) => p.slug),
  missingScreenDemo: SCREENS.filter((s) => { const d = SCREEN_DEFS[s.id]; return !d || (!d.Demo && !(d.from && FEATURES[d.from])) }).map((s) => s.id),
  orphanScreenDemo: Object.keys(SCREEN_DEFS).filter((k) => screenIndex(k) < 0),
  missingDemo: PAGES.filter((p) => !FEATURES[p.slug]).map((p) => p.slug),
  orphanDemo: Object.keys(FEATURES).filter((k) => pageIndex(k) < 0),
}
// Demo modals (react-aria ModalOverlay) mark everything outside them inert. In the kit a modal lives inside one
// demo, so keep the kit chrome (nav, notes, prev/next) usable: undo inert / aria-hidden outside demo frames.
new MutationObserver((ms) => {
  for (const m of ms) {
    const el = m.target as HTMLElement
    if (el.closest?.("[data-testid=demo]") && !el.closest("[data-testid=scenarios]")) continue // the scenario switcher is kit chrome
    // collapsed editor panels set their own inert/aria-hidden (P0-1, v0.7.2): never undo those, on any route
    if (el.matches?.("[data-hidden-panel]") || el.closest?.("[data-hidden-panel]")) continue
    if (el.hasAttribute("inert")) el.removeAttribute("inert")
    if (m.attributeName === "aria-hidden" && el.getAttribute("aria-hidden") === "true" && el.tagName.toLowerCase() !== "svg" && !el.closest("svg")) el.removeAttribute("aria-hidden")
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert", "aria-hidden"] })
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)

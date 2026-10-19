import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./kit/kit.css"
import { useRoute, href, parse } from "./kit/router"
import { IndexPage, FeaturePage } from "./kit/Shell"
import { ComponentsPage } from "./kit/ComponentsPage"
import { PAGES, pageIndex } from "./kit/pages"
import { FEATURES } from "./features/registry"

// The index restores its own scroll position; keep the browser from fighting it.
if ("scrollRestoration" in history) history.scrollRestoration = "manual"

function App() {
  const r = useRoute()
  useEffect(() => {
    // Alt+← / Alt+→ : previous / next kit page
    const on = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return
      const cur = parse()
      const i = cur.name === "feature" ? pageIndex(cur.slug) : -1
      const n = e.key === "ArrowRight" ? i + 1 : i - 1
      if (i >= 0 && n >= 0 && n < PAGES.length) { e.preventDefault(); location.hash = href.feature(PAGES[n].slug).slice(1) }
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])
  useEffect(() => {
    document.title = r.name === "feature" ? `${r.slug} · Photobooks UI kit` : r.name === "components" ? "Components · Photobooks UI kit" : "Photobooks UI kit"
  }, [r])
  if (r.name === "components") return <ComponentsPage />
  if (r.name === "feature") return <FeaturePage key={r.slug} slug={r.slug} />
  return <IndexPage />
}

// Exposed for scripts/qa.mjs: manifest ↔ registry consistency.
;(window as unknown as { __kit: object }).__kit = {
  pages: PAGES.map((p) => p.slug),
  missingDemo: PAGES.filter((p) => !FEATURES[p.slug]).map((p) => p.slug),
  orphanDemo: Object.keys(FEATURES).filter((k) => pageIndex(k) < 0),
}
// Demo modals (react-aria ModalOverlay) mark everything outside them inert. In the kit a modal lives inside one
// demo, so keep the kit chrome (nav, notes, prev/next) usable: undo inert / aria-hidden outside demo frames.
new MutationObserver((ms) => {
  for (const m of ms) {
    const el = m.target as HTMLElement
    if (el.closest?.("[data-testid=demo]") && !el.closest("[data-testid=scenarios]")) continue // the scenario switcher is kit chrome
    if (el.hasAttribute("inert")) el.removeAttribute("inert")
    if (m.attributeName === "aria-hidden" && el.getAttribute("aria-hidden") === "true" && el.tagName.toLowerCase() !== "svg" && !el.closest("svg")) el.removeAttribute("aria-hidden")
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert", "aria-hidden"] })
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)

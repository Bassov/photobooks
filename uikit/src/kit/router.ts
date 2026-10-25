import { useSyncExternalStore } from "react"

/* Hash routing so the kit works from file:// — #/  ·  #/components  ·  #/screen/<id>  ·  #/feature/<slug>  (legacy alias: #/f/<slug>) */
export type Route = { name: "index" } | { name: "components" } | { name: "feature"; slug: string } | { name: "screen"; id: string } | { name: "full"; id: string } | { name: "credits" } | { name: "demo" }
export function parse(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, "")
  const m = /^(?:feature|f)\/(.+)$/.exec(h)
  if (m) return { name: "feature", slug: decodeURIComponent(m[1]) }
  const s = /^screen\/(.+)$/.exec(h)
  if (s) return { name: "screen", id: decodeURIComponent(s[1]) }
  const f = /^full\/(.+)$/.exec(h)
  if (f) return { name: "full", id: decodeURIComponent(f[1]) }
  if (h === "components") return { name: "components" }
  if (h === "credits") return { name: "credits" }
  if (h === "demo") return { name: "demo" }
  return { name: "index" }
}
let current = parse()
const subs = new Set<() => void>()
window.addEventListener("hashchange", () => { current = parse(); subs.forEach((f) => f()) })
export function useRoute() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => current)
}
export const href = { index: "#/", components: "#/components", demo: "#/demo", feature: (slug: string) => `#/feature/${slug}`, screen: (id: string) => `#/screen/${id}` }

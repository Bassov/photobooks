import { useSyncExternalStore } from "react"

/* Hash routing so the kit works from file:// — #/  ·  #/components  ·  #/feature/<slug>  (legacy alias: #/f/<slug>) */
export type Route = { name: "index" } | { name: "components" } | { name: "feature"; slug: string }
export function parse(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, "")
  const m = /^(?:feature|f)\/(.+)$/.exec(h)
  if (m) return { name: "feature", slug: decodeURIComponent(m[1]) }
  if (h === "components") return { name: "components" }
  return { name: "index" }
}
let current = parse()
const subs = new Set<() => void>()
window.addEventListener("hashchange", () => { current = parse(); subs.forEach((f) => f()) })
export function useRoute() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => current)
}
export const href = { index: "#/", components: "#/components", feature: (slug: string) => `#/feature/${slug}` }

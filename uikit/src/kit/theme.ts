import { useSyncExternalStore } from "react"

export type Theme = "b" | "b-dark"
const KEY = "photobooks-kit-theme"
function read(): Theme {
  try { const v = localStorage.getItem(KEY); if (v === "b" || v === "b-dark") return v } catch { /* file:// in some browsers */ }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "b-dark" : "b"
}
const q = new URLSearchParams(location.search).get("theme")
let theme: Theme = q === "b-dark" || q === "b" ? q : read()
document.documentElement.dataset.theme = theme
const subs = new Set<() => void>()
export function setTheme(t: Theme) {
  theme = t
  document.documentElement.dataset.theme = t
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  subs.forEach((f) => f())
}
export function useTheme() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => theme)
}

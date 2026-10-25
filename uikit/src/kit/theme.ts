import { useSyncExternalStore } from "react"

/* v5: one theme — Procreate light. The dark theme and the theme toggle were removed. */
export type Theme = "procreate-light"
export const THEME: Theme = "procreate-light"
document.documentElement.dataset.theme = THEME
try { localStorage.removeItem("photobooks-kit-theme") } catch { /* file:// */ }
export function useTheme(): Theme {
  return useSyncExternalStore(() => () => { }, () => THEME)
}

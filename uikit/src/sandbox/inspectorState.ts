// proto: remembered inspector open/closed state (localStorage), shared by the panel header, top bar and the I shortcut.
import * as React from "react"
const KEY = "pb.inspector.open"
let open = (() => { try { return localStorage.getItem(KEY) !== "0" } catch { return true } })()
const subs = new Set<() => void>()
export function setInspectorOpen(v: boolean) { open = v; try { localStorage.setItem(KEY, v ? "1" : "0") } catch { /* file:// */ } subs.forEach((f) => f()) }
export const toggleInspector = () => setInspectorOpen(!open)
export function useInspectorOpen() {
  return React.useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => open)
}

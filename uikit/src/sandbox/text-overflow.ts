/* Text frames whose content is taller than their whole-line box (measured on the canvas, read by the inspector meta). */
import * as React from "react"

const ids = new Set<string>()
const subs = new Set<() => void>()

export function setTextOverflow(id: string, on: boolean) {
  if (ids.has(id) === on) return
  if (on) ids.add(id); else ids.delete(id)
  subs.forEach((f) => f())
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

export function useTextOverflow(id: string | undefined) {
  return React.useSyncExternalStore(subscribe, () => !!id && ids.has(id))
}

/* An inspector content edit asks the canvas to grow the box to whole lines (the canvas owns the text DOM to measure). */
const grow = new Set<string>()
export const requestTextGrow = (id: string) => { grow.add(id) }
export const takeTextGrow = (id: string) => grow.delete(id)

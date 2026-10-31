import { z } from 'zod'
import type { LayoutSlotPct } from '../core'

/** Kit "My templates" entry: a named layout in percent of the spread trim. */
export interface SavedTemplate {
  id: string
  name: string
  slots: readonly LayoutSlotPct[]
}

const STORAGE_KEY = 'photobooks.templates.v1'

const pct = z.number()
const storedSchema = z.array(
  z.object({
    id: z.string().regex(/^user-[\w-]+$/),
    name: z.string().trim().min(1),
    slots: z
      .array(z.object({ x: pct, y: pct, w: pct.positive(), h: pct.positive() }))
      .min(1),
  }),
)

let templates: readonly SavedTemplate[] | null = null
const listeners = new Set<() => void>()

function load(): readonly SavedTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = storedSchema.safeParse(raw === null ? [] : JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function commit(next: readonly SavedTemplate[]): void {
  templates = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the list still lives for this session.
  }
  for (const listener of listeners) {
    listener()
  }
}

/** The user's saved layouts in save order (persisted across reloads). */
export function getSavedTemplates(): readonly SavedTemplate[] {
  templates ??= load()
  return templates
}

export function subscribeSavedTemplates(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function findSavedTemplate(id: string): SavedTemplate | undefined {
  return getSavedTemplates().find((t) => t.id === id)
}

let seq = 0
function newId(): string {
  seq += 1
  return `user-${Date.now().toString(36)}-${String(seq)}`
}

/** Kit `nextCustomName`: the first free "My layout N". */
export function nextTemplateName(): string {
  const names = new Set(getSavedTemplates().map((t) => t.name))
  let n = 1
  while (names.has(`My layout ${String(n)}`)) {
    n += 1
  }
  return `My layout ${String(n)}`
}

export function addSavedTemplate(
  name: string,
  slots: readonly LayoutSlotPct[],
): SavedTemplate {
  const saved = { id: newId(), name, slots }
  commit([...getSavedTemplates(), saved])
  return saved
}

/** Blank names keep the old one (kit `renameCustom`). */
export function renameSavedTemplate(id: string, name: string): void {
  const next = name.trim()
  if (next === '') {
    return
  }
  commit(
    getSavedTemplates().map((t) => (t.id === id ? { ...t, name: next } : t)),
  )
}

/** Kit `duplicateCustom`: "<name> copy", then "<name> copy 2"…, right after it. */
export function duplicateSavedTemplate(id: string): SavedTemplate | undefined {
  const list = getSavedTemplates()
  const index = list.findIndex((t) => t.id === id)
  const source = list[index]
  if (source === undefined) {
    return undefined
  }
  const names = new Set(list.map((t) => t.name))
  let name = `${source.name} copy`
  for (let k = 2; names.has(name); k += 1) {
    name = `${source.name} copy ${String(k)}`
  }
  const copy = { id: newId(), name, slots: source.slots }
  commit([...list.slice(0, index + 1), copy, ...list.slice(index + 1)])
  return copy
}

export function deleteSavedTemplate(id: string): void {
  commit(getSavedTemplates().filter((t) => t.id !== id))
}

/** The kit #/demo "My templates" (uikit sandbox `templates.ts` seed). */
export const KIT_TEMPLATES: readonly SavedTemplate[] = [
  {
    id: 'user-kit-opener',
    name: 'Travel opener',
    slots: [
      { x: 0, y: 0, w: 62, h: 100 },
      { x: 68, y: 30, w: 28, h: 40 },
    ],
  },
  {
    id: 'user-kit-polaroid',
    name: 'Polaroid pair',
    slots: [
      { x: 10, y: 14, w: 30, h: 60 },
      { x: 60, y: 24, w: 30, h: 60 },
    ],
  },
  {
    id: 'user-kit-quote',
    name: 'Quote + photo',
    slots: [{ x: 52, y: 8, w: 44, h: 84 }],
  },
]

/**
 * Test / dev seam: `?templates=kit` seeds the kit's three templates so parity
 * checks see "My templates 3". The deploy build drops it (literal env check).
 */
export function seedSavedTemplatesFromQuery(
  search = window.location.search,
): void {
  if (!(import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1')) {
    return
  }
  if (new URLSearchParams(search).get('templates') !== 'kit') {
    return
  }
  const have = new Set(getSavedTemplates().map((t) => t.id))
  const missing = KIT_TEMPLATES.filter((t) => !have.has(t.id))
  if (missing.length > 0) {
    commit([...getSavedTemplates(), ...missing])
  }
}

/** Test-only: forget the cached list so the next read hits storage. */
export function resetSavedTemplatesForTests(): void {
  templates = null
}

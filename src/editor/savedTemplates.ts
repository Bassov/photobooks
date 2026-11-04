import type { LayoutSlotPct, SavedTemplate } from '../core'
import { parseLegacySavedTemplates } from '../project/libraryDocument'
import type { LibraryStorage } from '../project/types'

/** Kit "My templates" entry: `{ id, name, pages, slots }` (see core). */
export type { SavedTemplate } from '../core'

/** Where templates lived before `library.json` (one list per browser profile). */
const LEGACY_KEY = 'photobooks.templates.v1'

let templates: readonly SavedTemplate[] | null = null
let library: LibraryStorage | null = null
/** Writes a changed list to the bound library; a no-op without one. */
let persist: (next: readonly SavedTemplate[]) => void = sessionOnly
/** Loads and writes of `library.json`, one at a time in call order. */
let queue: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined)
  return queue
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** Read-modify-write so the publish statuses in `library.json` survive. */
async function writeTemplates(
  target: LibraryStorage,
  next: readonly SavedTemplate[],
): Promise<boolean> {
  const meta = await target.getLibrary()
  if (!meta.ok) {
    return false
  }
  const written = await target.updateLibrary({ ...meta.value, templates: next })
  return written.ok
}

function sessionOnly(): void {
  // Without a library the list lives for this session only.
}

function writeTo(target: LibraryStorage) {
  return (next: readonly SavedTemplate[]): void => {
    void enqueue(async () => {
      await writeTemplates(target, next)
    })
  }
}

function commit(next: readonly SavedTemplate[]): void {
  templates = next
  persist(next)
  notify()
}

function readLegacyTemplates(): SavedTemplate[] {
  try {
    // A missing key parses as `null`: nothing to import.
    const raw = window.localStorage.getItem(LEGACY_KEY)
    return parseLegacySavedTemplates(JSON.parse(String(raw)))
  } catch {
    return []
  }
}

function removeLegacyTemplates(): void {
  try {
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Blocked storage: the next empty library imports the list again.
  }
}

async function load(target: LibraryStorage): Promise<void> {
  const meta = await target.getLibrary()
  // Another library (or none) was bound meanwhile: its list wins.
  if (target !== library) {
    return
  }
  const stored = meta.ok ? (meta.value.templates ?? []) : []
  const legacy = meta.ok && stored.length === 0 ? readLegacyTemplates() : []
  templates = legacy.length > 0 ? legacy : stored
  seedSavedTemplatesFromQuery()
  notify()
  // One-time import: the key goes only once library.json holds the list.
  if (legacy.length > 0 && (await writeTemplates(target, legacy))) {
    removeLegacyTemplates()
  }
}

/**
 * Binds the store to the open library (`null`: none, a session-only list) and
 * reloads the list from its `library.json`; resolves once it is loaded.
 */
export function bindSavedTemplatesLibrary(
  next: LibraryStorage | null,
): Promise<void> {
  if (next === library) {
    return queue
  }
  library = next
  templates = []
  if (next === null) {
    persist = sessionOnly
    seedSavedTemplatesFromQuery()
    notify()
    return queue
  }
  persist = writeTo(next)
  notify()
  return enqueue(() => load(next))
}

/** The user's saved layouts in save order (persisted in `library.json`). */
export function getSavedTemplates(): readonly SavedTemplate[] {
  if (templates === null) {
    templates = []
    seedSavedTemplatesFromQuery()
  }
  return templates
}

export function subscribeSavedTemplates(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A saved layout by id; with `pages`, only one saved on that page count. */
export function findSavedTemplate(
  id: string,
  pages?: 1 | 2,
): SavedTemplate | undefined {
  return getSavedTemplates().find(
    (t) => t.id === id && (pages === undefined || t.pages === pages),
  )
}

function newId(): string {
  return `user-${crypto.randomUUID()}`
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

/** `pages`: page count of the spread the slots come from. */
export function addSavedTemplate(
  name: string,
  slots: readonly LayoutSlotPct[],
  pages: 1 | 2 = 2,
): SavedTemplate {
  const saved = { id: newId(), name, pages, slots }
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
  const copy = { ...source, id: newId(), name }
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
    pages: 2,
    slots: [
      { x: 0, y: 0, w: 62, h: 100 },
      { x: 68, y: 30, w: 28, h: 40 },
    ],
  },
  {
    id: 'user-kit-polaroid',
    name: 'Polaroid pair',
    pages: 2,
    slots: [
      { x: 10, y: 14, w: 30, h: 60 },
      { x: 60, y: 24, w: 30, h: 60 },
    ],
  },
  {
    id: 'user-kit-quote',
    name: 'Quote + photo',
    pages: 2,
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

/** Test-only: forget the list and the library so the next read starts over. */
export function resetSavedTemplatesForTests(): void {
  templates = null
  library = null
  persist = sessionOnly
  queue = Promise.resolve()
}

/** Test-only: settles once every queued load / write has run. */
export function flushSavedTemplatesForTests(): Promise<void> {
  return queue
}

import {
  DEFAULT_PRINT_PROFILE_ID,
  genericPrintProfile,
  type PrintProfile,
} from '../core'
import {
  parseDefaultPrintProfileId,
  parsePrintProfiles,
} from '../project/libraryDocument'
import type { LibraryStorage } from '../project/types'
import { dispatchBookOp, setBookPrintProfiles } from './bookStore'
import { setEditorStatus } from './editorStatus'

/** Settings → Print presets: the library's custom profiles and its default. */
export interface PrintProfilesState {
  customs: readonly PrintProfile[]
  defaultId: string
}

const EMPTY: PrintProfilesState = {
  customs: [],
  defaultId: DEFAULT_PRINT_PROFILE_ID,
}

let state: PrintProfilesState = EMPTY
let library: LibraryStorage | null = null
/** Writes a changed state to the bound library; a no-op without one. */
let persist: (next: PrintProfilesState) => void = sessionOnly
/** Loads and writes of `library.json`, one at a time in call order. */
let queue: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined)
  return queue
}

/** Book paint and low-res marks resolve with the same customs. */
function notify(): void {
  setBookPrintProfiles(state.customs)
  for (const listener of listeners) {
    listener()
  }
}

/** Designer spec printer-presets D6: the list stays in memory for the session. */
const STATUS_PROFILES_WRITE_FAILED =
  "Couldn't save print profiles to the library folder"

async function tryWrite(
  target: LibraryStorage,
  next: PrintProfilesState,
): Promise<boolean> {
  const meta = await target.getLibrary()
  if (!meta.ok) {
    return false
  }
  const written = await target.updateLibrary({
    ...meta.value,
    printProfiles: next.customs,
    defaultPrintProfileId: next.defaultId,
  })
  return written.ok
}

/** Read-modify-write so templates and publish statuses survive. */
async function write(
  target: LibraryStorage,
  next: PrintProfilesState,
): Promise<void> {
  let written = false
  try {
    written = await tryWrite(target, next)
  } catch {
    // A thrown write failed too.
  }
  if (!written) {
    setEditorStatus(STATUS_PROFILES_WRITE_FAILED)
  }
}

function sessionOnly(): void {
  // Without a library the profiles live for this session only.
}

function writeTo(target: LibraryStorage) {
  return (next: PrintProfilesState): void => {
    void enqueue(() => write(target, next))
  }
}

function commit(next: PrintProfilesState): void {
  state = next
  persist(next)
  notify()
}

async function load(target: LibraryStorage): Promise<void> {
  const meta = await target.getLibrary()
  // Another library (or none) was bound meanwhile, or library.json is
  // unreadable: nothing gets written, so the stored profiles stay.
  if (target !== library || !meta.ok) {
    return
  }
  state = {
    customs: parsePrintProfiles(meta.value.printProfiles),
    defaultId: parseDefaultPrintProfileId(meta.value.defaultPrintProfileId),
  }
  persist = writeTo(target)
  seedPrintProfilesFromQuery()
  notify()
}

/**
 * Binds the store to the open library (`null`: none, session-only profiles)
 * and reloads them from its `library.json`; resolves once they are loaded.
 */
export function bindPrintProfilesLibrary(
  next: LibraryStorage | null,
): Promise<void> {
  if (next === library) {
    return queue
  }
  library = next
  state = EMPTY
  persist = sessionOnly
  if (next === null) {
    seedPrintProfilesFromQuery()
    notify()
    return queue
  }
  notify()
  return enqueue(() => load(next))
}

/** Settles once every queued load / write has run. */
export function printProfilesSettled(): Promise<void> {
  return queue
}

export function getPrintProfilesState(): PrintProfilesState {
  return state
}

/** The library's custom profiles in creation order. */
export function getPrintProfiles(): readonly PrintProfile[] {
  return state.customs
}

export function subscribePrintProfiles(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function newId(): string {
  return `custom-${crypto.randomUUID()}`
}

/** Spec D9: "<name> (copy)", then "(copy 2)", "(copy 3)" … */
export function copyName(name: string, taken: readonly string[]): string {
  const root = name.replace(/ \(copy(?: \d+)?\)$/, '')
  const names = new Set(taken)
  let candidate = `${root} (copy)`
  for (let n = 2; names.has(candidate); n += 1) {
    candidate = `${root} (copy ${String(n)})`
  }
  return candidate
}

/** Duplicate: the copy joins the list at once (the editor opens on it). */
export function duplicatePrintProfile(
  source: PrintProfile,
  taken: readonly string[],
): PrintProfile {
  const copy: PrintProfile = {
    ...source,
    id: newId(),
    name: copyName(source.name, taken),
    basedOn: source.name,
  }
  commit({ ...state, customs: [...state.customs, copy] })
  return copy
}

/** New profile: Generic's values, not in the list until it is saved. */
export function newPrintProfile(): PrintProfile {
  const generic = genericPrintProfile()
  return { ...generic, id: newId(), name: 'New profile', basedOn: generic.name }
}

/**
 * Adds or replaces `profile`; the open book using it follows (Spec D6
 * snapshot refresh, not an undo step).
 */
export function savePrintProfile(profile: PrintProfile): void {
  const exists = state.customs.some((custom) => custom.id === profile.id)
  commit({
    ...state,
    customs: exists
      ? state.customs.map((custom) =>
          custom.id === profile.id ? profile : custom,
        )
      : [...state.customs, profile],
  })
  dispatchBookOp({ type: 'refreshPrintProfile', profile })
}

/** Books keep their snapshot; a deleted default falls back to Generic. */
export function deletePrintProfile(id: string): void {
  commit({
    customs: state.customs.filter((custom) => custom.id !== id),
    defaultId:
      state.defaultId === id ? DEFAULT_PRINT_PROFILE_ID : state.defaultId,
  })
}

export function setDefaultPrintProfileId(id: string): void {
  if (id !== state.defaultId) {
    commit({ ...state, defaultId: id })
  }
}

/** The kit's sample custom (`uikit` printProfiles `SAMPLE_CUSTOMS`). */
export function kitSampleProfile(): PrintProfile {
  return {
    ...genericPrintProfile(),
    id: 'custom-kit-sample',
    name: 'Photo book 300 ppi',
    basedOn: 'Generic',
    trimMinMm: 152,
    trimMaxMm: 305,
    bleedMinMm: 5,
    bleedMaxMm: 5,
    safeMarginMm: 15,
    pageCount: { min: 24, step: 2, max: 240 },
    dpi: { warn: 300, min: 150 },
  }
}

/**
 * Test / dev seam: `?printProfiles=kit` adds the kit's sample custom so e2e
 * and perf have a second profile. The deploy build drops it.
 */
export function seedPrintProfilesFromQuery(
  search = window.location.search,
): void {
  if (!(import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1')) {
    return
  }
  if (new URLSearchParams(search).get('printProfiles') !== 'kit') {
    return
  }
  const sample = kitSampleProfile()
  if (!state.customs.some((custom) => custom.id === sample.id)) {
    commit({ ...state, customs: [...state.customs, sample] })
  }
}

/** Test-only: forget the profiles and the library. */
export function resetPrintProfilesForTests(): void {
  state = EMPTY
  library = null
  persist = sessionOnly
  queue = Promise.resolve()
  setBookPrintProfiles(EMPTY.customs)
}

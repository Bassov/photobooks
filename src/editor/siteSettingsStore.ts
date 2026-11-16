import { parseSiteSettings } from '../project/libraryDocument'
import type { LibraryStorage, SiteSettings } from '../project/types'
import { setEditorStatus } from './editorStatus'

/** A patch value `''` (or `undefined`) clears that field. */
export type SiteSettingsPatch = {
  [K in keyof SiteSettings]?: SiteSettings[K] | '' | undefined
}

const EMPTY: SiteSettings = {}

let state: SiteSettings = EMPTY
let library: LibraryStorage | null = null
/** Writes a changed state to the bound library; a no-op without one. */
let persist: (next: SiteSettings) => void = sessionOnly
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

/** Designer spec site-settings S2: the values stay in memory for the session. */
const STATUS_SITE_WRITE_FAILED =
  "Couldn't save site settings to the library folder"

async function tryWrite(
  target: LibraryStorage,
  next: SiteSettings,
): Promise<boolean> {
  const meta = await target.getLibrary()
  if (!meta.ok) {
    return false
  }
  const written = await target.updateLibrary({ ...meta.value, site: next })
  return written.ok
}

/** Read-modify-write so books, templates and print profiles survive. */
async function write(
  target: LibraryStorage,
  next: SiteSettings,
): Promise<void> {
  let written = false
  try {
    written = await tryWrite(target, next)
  } catch {
    // A thrown write failed too.
  }
  if (!written) {
    setEditorStatus(STATUS_SITE_WRITE_FAILED)
  }
}

function sessionOnly(): void {
  // Without a library the settings live for this session only.
}

function writeTo(target: LibraryStorage) {
  return (next: SiteSettings): void => {
    void enqueue(() => write(target, next))
  }
}

function sameSettings(a: SiteSettings, b: SiteSettings): boolean {
  return a.title === b.title && a.author === b.author && a.intro === b.intro
}

/** Normalises `next` and commits it unless it equals the stored settings. */
function commit(next: unknown): void {
  const settings = parseSiteSettings(next) ?? EMPTY
  if (sameSettings(settings, state)) {
    return
  }
  state = settings
  persist(settings)
  notify()
}

async function load(target: LibraryStorage): Promise<void> {
  const meta = await target.getLibrary()
  // Another library (or none) was bound meanwhile, or library.json is
  // unreadable: nothing gets written, so the stored settings stay.
  if (target !== library || !meta.ok) {
    return
  }
  state = parseSiteSettings(meta.value.site) ?? EMPTY
  persist = writeTo(target)
  seedSiteSettingsFromQuery()
  notify()
}

/**
 * Binds the store to the open library (`null`: none, session-only settings)
 * and reloads them from its `library.json`; resolves once they are loaded.
 */
export function bindSiteSettingsLibrary(
  next: LibraryStorage | null,
): Promise<void> {
  if (next === library) {
    return queue
  }
  library = next
  state = EMPTY
  persist = sessionOnly
  if (next === null) {
    seedSiteSettingsFromQuery()
    notify()
    return queue
  }
  notify()
  return enqueue(() => load(next))
}

/** Settles once every queued load / write has run. */
export function siteSettingsSettled(): Promise<void> {
  return queue
}

export function getSiteSettings(): SiteSettings {
  return state
}

export function subscribeSiteSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Commits `patch` over the stored settings (S2): trimmed, inner whitespace
 * collapsed, clipped; no write when nothing changes.
 */
export function setSiteSettings(patch: SiteSettingsPatch): void {
  commit({ ...state, ...patch })
}

/**
 * Test / dev seam: `?siteSettings=<JSON>` (`{"title":"…","author":"…"}`)
 * sets the site settings so e2e can start from them. The deploy build drops
 * it; JSON that does not parse is ignored.
 */
export function seedSiteSettingsFromQuery(
  search = window.location.search,
): void {
  if (!(import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1')) {
    return
  }
  const raw = new URLSearchParams(search).get('siteSettings')
  if (raw === null) {
    return
  }
  try {
    commit({ ...state, ...(JSON.parse(raw) as object) })
  } catch {
    // Not JSON: no seed.
  }
}

/** Test-only: forget the settings and the library. */
export function resetSiteSettingsForTests(): void {
  state = EMPTY
  library = null
  persist = sessionOnly
  queue = Promise.resolve()
}

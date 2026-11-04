import { SITE_MANIFEST_PATH } from './buildSiteTree'
import type { SiteFile, SiteTree } from './types'

/** The site goes into `<folder>/dist/`. */
const SITE_DIST_DIR = 'dist'

export type SiteExportErrorCode =
  'permission' | 'quota' | 'not-our-export' | 'unknown'

/** `dist/`-relative, `/`-separated. */
export interface SiteDistEntry {
  path: string
  kind: 'file' | 'directory'
}

/** What `<folder>/dist` holds before a write. */
export type SiteDistListing =
  | { kind: 'absent' }
  | { kind: 'file' }
  | {
      kind: 'directory'
      entries: readonly SiteDistEntry[]
      /** Bytes of a root `site.json` file, when there is one. */
      manifest?: Uint8Array
    }

export type SiteWritePlan =
  | {
      ok: true
      /** Top-most stale entries, removed recursively before any write. */
      delete: readonly string[]
      /** Every tree file, the manifest first. */
      write: readonly SiteFile[]
    }
  | { ok: false; code: 'not-our-export' }

export interface SiteWritable {
  write: (data: Uint8Array) => Promise<void>
  close: () => Promise<void>
}

export interface SiteFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile: () => Promise<Blob>
  createWritable: () => Promise<SiteWritable>
}

/**
 * The File System Access subset the writer needs. A Chromium
 * `FileSystemDirectoryHandle` fits it; lib `DOM.AsyncIterable` is not loaded,
 * so callers cast it once.
 */
export interface SiteDirectoryHandle {
  readonly kind: 'directory'
  readonly name: string
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<SiteDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<SiteFileHandle>
  removeEntry: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>
  values: () => AsyncIterable<SiteDirectoryHandle | SiteFileHandle>
}

export type SiteWriteResult =
  | { ok: true; files: number; bytes: number }
  | { ok: false; code: 'not-our-export' }

const NOT_OURS = { ok: false, code: 'not-our-export' } as const
const decoder = new TextDecoder()

/**
 * Whether `bytes` look like the `site.json` that `buildSiteTree` writes;
 * `undefined` (no such file) decodes to `''`, which is not JSON.
 */
export function isSiteManifest(bytes: Uint8Array | undefined): boolean {
  try {
    const { version, books, assets } = (JSON.parse(decoder.decode(bytes)) ??
      {}) as Record<string, unknown>
    return (
      typeof version === 'number' &&
      Array.isArray(books) &&
      Array.isArray(assets)
    )
  } catch {
    return false
  }
}

function ancestors(path: string): string[] {
  const parts = path.split('/')
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

/** Keeps every write inside `dist/`: no empty, `.` or `..` segment. */
function assertContained(path: string): void {
  if (
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new TypeError(`Unsafe site path: ${path}`)
  }
}

function manifestFirst(files: readonly SiteFile[]): SiteFile[] {
  files.forEach((file) => {
    assertContained(file.path)
  })
  return [
    ...files.filter((file) => file.path === SITE_MANIFEST_PATH),
    ...files.filter((file) => file.path !== SITE_MANIFEST_PATH),
  ]
}

/**
 * Pure plan for writing `tree` over the current `dist/`. A `dist/` that is a
 * file, or a non-empty directory without our manifest at its root, is refused.
 * The manifest goes first so a half-written `dist/` is still recognised as ours.
 */
export function planSiteWrite(
  listing: SiteDistListing,
  tree: SiteTree,
): SiteWritePlan {
  if (listing.kind === 'file') return NOT_OURS
  const write = manifestFirst(tree.files)
  if (listing.kind === 'absent') return { ok: true, delete: [], write }
  if (listing.entries.length > 0 && !isSiteManifest(listing.manifest)) {
    return NOT_OURS
  }
  const files = new Set(tree.files.map((file) => file.path))
  const dirs = new Set(tree.files.flatMap((file) => ancestors(file.path)))
  const stale = new Set(
    listing.entries
      .filter(
        (entry) => !(entry.kind === 'file' ? files : dirs).has(entry.path),
      )
      .map((entry) => entry.path),
  )
  return {
    ok: true,
    delete: [...stale]
      .filter((path) => !ancestors(path).some((dir) => stale.has(dir)))
      .sort(),
    write,
  }
}

async function findEntry(
  dir: SiteDirectoryHandle,
  name: string,
): Promise<SiteDirectoryHandle | SiteFileHandle | undefined> {
  for await (const entry of dir.values()) {
    if (entry.name === name) return entry
  }
  return undefined
}

async function listEntries(
  dir: SiteDirectoryHandle,
  prefix: string,
  out: SiteDistEntry[],
): Promise<void> {
  for await (const entry of dir.values()) {
    const path = `${prefix}${entry.name}`
    out.push({ path, kind: entry.kind })
    if (entry.kind === 'directory') await listEntries(entry, `${path}/`, out)
  }
}

/** Lists `<folder>/dist` without changing anything. */
async function readSiteDist(
  folder: SiteDirectoryHandle,
): Promise<SiteDistListing> {
  const dist = await findEntry(folder, SITE_DIST_DIR)
  if (dist === undefined) return { kind: 'absent' }
  if (dist.kind === 'file') return { kind: 'file' }
  const entries: SiteDistEntry[] = []
  await listEntries(dist, '', entries)
  const manifest = await findEntry(dist, SITE_MANIFEST_PATH)
  return manifest?.kind === 'file'
    ? {
        kind: 'directory',
        entries,
        manifest: new Uint8Array(
          await (await manifest.getFile()).arrayBuffer(),
        ),
      }
    : { kind: 'directory', entries }
}

function split(path: string): { dir: string; name: string } {
  const at = path.lastIndexOf('/')
  return { dir: path.slice(0, Math.max(at, 0)), name: path.slice(at + 1) }
}

async function directoryAt(
  root: SiteDirectoryHandle,
  path: string,
  cache: Map<string, Promise<SiteDirectoryHandle>>,
): Promise<SiteDirectoryHandle> {
  if (path === '') return root
  const cached = cache.get(path)
  if (cached !== undefined) return cached
  const { dir, name } = split(path)
  const created = directoryAt(root, dir, cache).then((parent) =>
    parent.getDirectoryHandle(name, { create: true }),
  )
  cache.set(path, created)
  return created
}

/**
 * Writes `tree` into `<folder>/dist/`: refuses a `dist/` that is not ours
 * (nothing is touched), removes stale entries, then writes every file.
 * File-system errors are thrown; map them with `siteExportErrorCode`.
 */
export async function writeSiteTree(
  folder: SiteDirectoryHandle,
  tree: SiteTree,
  onProgress?: (done: number, total: number) => void,
): Promise<SiteWriteResult> {
  const plan = planSiteWrite(await readSiteDist(folder), tree)
  if (!plan.ok) return plan
  const dist = await folder.getDirectoryHandle(SITE_DIST_DIR, { create: true })
  const dirs = new Map<string, Promise<SiteDirectoryHandle>>()
  for (const path of plan.delete) {
    const { dir, name } = split(path)
    const parent = await directoryAt(dist, dir, dirs)
    await parent.removeEntry(name, { recursive: true })
  }
  let bytes = 0
  for (const [index, file] of plan.write.entries()) {
    const { dir, name } = split(file.path)
    const parent = await directoryAt(dist, dir, dirs)
    const writable = await (
      await parent.getFileHandle(name, { create: true })
    ).createWritable()
    await writable.write(file.bytes)
    await writable.close()
    bytes += file.bytes.byteLength
    onProgress?.(index + 1, plan.write.length)
  }
  return { ok: true, files: plan.write.length, bytes }
}

/** Failure code for an error thrown while building or writing the site. */
export function siteExportErrorCode(error: unknown): SiteExportErrorCode {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'permission'
  if (name === 'QuotaExceededError') return 'quota'
  return 'unknown'
}

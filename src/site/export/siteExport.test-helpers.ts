import type { Book } from '../../core'
import { makeBook, makeFrame, makeSpread } from '../../core/testing/fixtures'
import { DERIVATIVE_PRESETS } from '../../derivatives/plan'
import {
  publishBook,
  type LibraryMeta,
  type PublishedRevision,
} from '../../project'
import type { SiteDerivativeInput, SiteTree } from './types'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** 64-hex content hash for photo `n`. */
export function photoHash(n: number): string {
  return n.toString(16).padStart(64, '0')
}

/** Book whose spreads hold photos `photos[s]` (by content hash), one frame each. */
export function makePhotoBook(
  id: string,
  title: string,
  photos: readonly (readonly string[])[],
): Book {
  const assets: Book['assets'] = {}
  for (const hash of photos.flat()) {
    assets[`asset-${hash.slice(-6)}`] = { contentHash: hash }
  }
  return makeBook({
    id,
    title,
    assets,
    gallery: Object.keys(assets),
    spreads: photos.map((hashes, s) =>
      makeSpread({
        id: `${id}-spread-${String(s)}`,
        frames: hashes.map((hash, f) =>
          makeFrame({
            id: `frame-${String(f)}`,
            assetId: `asset-${hash.slice(-6)}`,
          }),
        ),
      }),
    ),
  })
}

/** Distinct fake bytes per `(hash, preset)`, for the given preset ids (all by default). */
export function derivativesFor(
  hash: string,
  presetIds: readonly string[] = DERIVATIVE_PRESETS.map((preset) => preset.id),
): SiteDerivativeInput[] {
  return presetIds.map((presetId) => ({
    assetHash: hash,
    presetId,
    bytes: encoder.encode(`${hash}:${presetId}`),
    width: 160,
    height: 120,
  }))
}

/** Publishes `books` in order (1 ms apart) into one library meta. */
export function publishAll(books: readonly Book[]): {
  meta: LibraryMeta
  revisions: PublishedRevision[]
} {
  let meta: LibraryMeta = {}
  const revisions: PublishedRevision[] = []
  books.forEach((book, index) => {
    const published = publishBook(meta, book, 1_000 + index)
    meta = published.meta
    revisions.push(published.revision)
  })
  return { meta, revisions }
}

export function fileText(tree: SiteTree, path: string): string | undefined {
  const file = tree.files.find((entry) => entry.path === path)
  return file === undefined ? undefined : decoder.decode(file.bytes)
}

/** Every text file (HTML / JSON) concatenated, for leak checks. */
export function allText(tree: SiteTree): string {
  return tree.files
    .filter((file) => /\.(html|json)$/.test(file.path))
    .map((file) => decoder.decode(file.bytes))
    .join('\n')
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes as Uint8Array<ArrayBuffer>,
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function resolvePath(fromDir: string, url: string): string {
  const parts = fromDir.split('/').filter((part) => part !== '')
  for (const segment of url.split('/')) {
    if (segment === '..') {
      parts.pop()
    } else if (segment !== '.' && segment !== '') {
      parts.push(segment)
    }
  }
  const path = parts.join('/')
  if (!url.endsWith('/')) return path
  return path === '' ? 'index.html' : `${path}/index.html`
}

/** Site-root paths of every `src` / `href` in the HTML and every manifest path. */
export function referencedPaths(tree: SiteTree): string[] {
  const refs: string[] = []
  for (const file of tree.files) {
    const text = decoder.decode(file.bytes)
    if (file.path.endsWith('.html')) {
      const dir = file.path.slice(0, file.path.lastIndexOf('/') + 1)
      for (const match of text.matchAll(/(?:src|href)="([^"]*)"/g)) {
        refs.push(resolvePath(dir, match[1] ?? ''))
      }
    }
    if (file.path === 'site.json') {
      for (const match of text.matchAll(/"(?:path|viewer)":"([^"]*)"/g)) {
        refs.push(resolvePath('', match[1] ?? ''))
      }
      // Each book directory holds its `book.json` (D41).
      for (const match of text.matchAll(/"path":"(books\/[^"]*\/)"/g)) {
        refs.push(`${match[1] ?? ''}book.json`)
      }
    }
    if (file.path.endsWith('/book.json')) {
      const dir = file.path.slice(0, file.path.lastIndexOf('/') + 1)
      for (const match of text.matchAll(/"src":"([^"]*)"/g)) {
        refs.push(resolvePath(dir, match[1] ?? ''))
      }
    }
  }
  return refs
}

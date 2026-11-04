import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import type { SiteFile, SiteTree } from './types'
import {
  createMemorySiteDirectory,
  snapshotSiteDirectory,
} from './memorySiteDirectory.test-helpers'
import { isSiteManifest, writeSiteTree } from './writeSiteTree'

const PBT_RUNS = { numRuns: 1000 }
const PBT_TIMEOUT_MS = 60_000
const MANIFEST: SiteFile = {
  path: 'site.json',
  bytes: new TextEncoder().encode('{"version":1,"books":[],"assets":[]}\n'),
}

const file: fc.Arbitrary<SiteFile> = fc.record({
  path: fc
    .array(fc.constantFrom('a', 'b', 'c.html'), { minLength: 1, maxLength: 3 })
    .map((parts) => parts.join('/')),
  bytes: fc.uint8Array({ maxLength: 8 }),
})

/** Unique paths, none of them inside another file. */
const fileSet: fc.Arbitrary<SiteFile[]> = fc
  .uniqueArray(file, { selector: (f) => f.path, maxLength: 8 })
  .map((files) =>
    files.filter(
      (f) => !files.some((other) => other.path.startsWith(`${f.path}/`)),
    ),
  )

const tree: fc.Arbitrary<SiteTree> = fileSet.map((files) => ({
  files: [...files, MANIFEST].sort((a, b) => (a.path < b.path ? -1 : 1)),
  missing: [],
}))

function seed(files: readonly SiteFile[]): Record<string, Uint8Array> {
  return Object.fromEntries(files.map((f) => [`dist/${f.path}`, f.bytes]))
}

async function dist(folder: ReturnType<typeof createMemorySiteDirectory>) {
  return snapshotSiteDirectory(await folder.root.getDirectoryHandle('dist'))
}

function ancestors(path: string): string[] {
  const parts = path.split('/')
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

describe('writeSiteTree (PBT)', () => {
  test.prop([tree, tree], PBT_RUNS)(
    'writing the same tree twice over an earlier export gives a byte-identical dir',
    async (earlier, next) => {
      const folder = createMemorySiteDirectory()
      await writeSiteTree(folder.root, earlier)

      await writeSiteTree(folder.root, next)
      const once = await dist(folder)
      await writeSiteTree(folder.root, next)

      expect(await dist(folder)).toEqual(once)
    },
    PBT_TIMEOUT_MS,
  )

  test.prop([tree, tree], PBT_RUNS)(
    'after a write the dir holds exactly the tree files and their dirs',
    async (earlier, next) => {
      const folder = createMemorySiteDirectory()
      await writeSiteTree(folder.root, earlier)

      await writeSiteTree(folder.root, next)

      const dirs = [
        ...new Set(next.files.flatMap((f) => ancestors(f.path))),
      ].map((path) => [path, 'dir'] as const)
      const files = next.files.map((f) => [f.path, f.bytes] as const)
      expect(await dist(folder)).toEqual(
        [...dirs, ...files].sort(([a], [b]) => (a < b ? -1 : 1)),
      )
    },
    PBT_TIMEOUT_MS,
  )

  test.prop(
    [
      tree,
      fileSet.filter((files) => files.length > 0),
      fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
    ],
    PBT_RUNS,
  )(
    'a foreign dist is never changed',
    async (next, foreign, manifest) => {
      fc.pre(
        manifest === undefined ||
          !isSiteManifest(new TextEncoder().encode(manifest)),
      )
      const folder = createMemorySiteDirectory({
        ...seed(foreign),
        ...(manifest === undefined ? {} : { 'dist/site.json': manifest }),
        'photo.jpg': 'outside',
      })
      const before = await snapshotSiteDirectory(folder.root)

      const result = await writeSiteTree(folder.root, next)

      expect(result).toEqual({ ok: false, code: 'not-our-export' })
      expect(folder.ops).toEqual([])
      expect(await snapshotSiteDirectory(folder.root)).toEqual(before)
    },
    PBT_TIMEOUT_MS,
  )
})

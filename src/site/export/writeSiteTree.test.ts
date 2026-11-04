import { describe, expect, it } from 'vitest'
import type { SiteTree } from './types'
import {
  createMemorySiteDirectory,
  snapshotSiteDirectory,
} from './memorySiteDirectory.test-helpers'
import {
  isSiteManifest,
  planSiteWrite,
  siteExportErrorCode,
  writeSiteTree,
  type SiteDistEntry,
} from './writeSiteTree'

const encoder = new TextEncoder()
const MANIFEST = '{"version":1,"books":[],"assets":[]}\n'

function treeOf(files: Record<string, string>): SiteTree {
  return {
    files: Object.entries(files)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([path, text]) => ({ path, bytes: encoder.encode(text) })),
    missing: [],
  }
}

const TREE = treeOf({
  'site.json': MANIFEST,
  'index.html': '<p>index</p>',
  'books/new/index.html': '<p>new</p>',
})

function files(...paths: string[]): SiteDistEntry[] {
  return paths.map((path) => ({ path, kind: 'file' }))
}

function dirs(...paths: string[]): SiteDistEntry[] {
  return paths.map((path) => ({ path, kind: 'directory' }))
}

function writtenPaths(plan: ReturnType<typeof planSiteWrite>): string[] {
  return plan.ok ? plan.write.map((file) => file.path) : []
}

describe('planSiteWrite', () => {
  it('writes every file, manifest first, when dist is absent', () => {
    const plan = planSiteWrite({ kind: 'absent' }, TREE)

    expect(plan).toMatchObject({ ok: true, delete: [] })
    expect(writtenPaths(plan)).toEqual([
      'site.json',
      'books/new/index.html',
      'index.html',
    ])
  })

  it('treats an empty dist directory as ours', () => {
    const plan = planSiteWrite({ kind: 'directory', entries: [] }, TREE)

    expect(plan).toMatchObject({ ok: true, delete: [] })
    expect(writtenPaths(plan)).toHaveLength(3)
  })

  it('removes the top-most stale entries of an earlier export and rewrites every file', () => {
    const plan = planSiteWrite(
      {
        kind: 'directory',
        entries: [
          ...files('site.json', 'index.html', 'books/old/index.html'),
          ...files('assets/aa/x.jpg', 'books/new/index.html'),
          ...dirs('books', 'books/old', 'books/new', 'assets', 'assets/aa'),
        ],
        manifest: encoder.encode(MANIFEST),
      },
      TREE,
    )

    expect(plan).toMatchObject({ ok: true, delete: ['assets', 'books/old'] })
    expect(writtenPaths(plan)).toEqual([
      'site.json',
      'books/new/index.html',
      'index.html',
    ])
  })

  it('removes entries whose kind changed', () => {
    const plan = planSiteWrite(
      {
        kind: 'directory',
        entries: [
          ...files('site.json', 'books', 'index.html/a'),
          ...dirs('index.html'),
        ],
        manifest: encoder.encode(MANIFEST),
      },
      TREE,
    )

    expect(plan).toMatchObject({ ok: true, delete: ['books', 'index.html'] })
  })

  it.each([
    ['no manifest', undefined],
    ['not JSON', 'site'],
    ['null', 'null'],
    ['an array', '[]'],
    ['no version', '{"books":[],"assets":[]}'],
    ['a string version', '{"version":"1","books":[],"assets":[]}'],
    ['no books', '{"version":1,"assets":[]}'],
    ['no assets', '{"version":1,"books":[]}'],
  ])('refuses a foreign dist with %s', (_, manifest) => {
    const plan = planSiteWrite(
      {
        kind: 'directory',
        entries: files('site.json', 'readme.txt'),
        ...(manifest === undefined
          ? {}
          : { manifest: encoder.encode(manifest) }),
      },
      TREE,
    )

    expect(plan).toEqual({ ok: false, code: 'not-our-export' })
  })

  it('refuses a dist that is a file', () => {
    expect(planSiteWrite({ kind: 'file' }, TREE)).toEqual({
      ok: false,
      code: 'not-our-export',
    })
  })

  it.each(['../x', '/x', 'a//b', 'a/./b', 'a/'])(
    'throws on the unsafe tree path %s',
    (path) => {
      expect(() =>
        planSiteWrite({ kind: 'absent' }, treeOf({ [path]: 'x' })),
      ).toThrow(TypeError)
    },
  )
})

describe('isSiteManifest', () => {
  it('accepts our manifest of any version', () => {
    expect(
      isSiteManifest(
        encoder.encode('{"version":2,"books":[{"id":"a"}],"assets":[]}'),
      ),
    ).toBe(true)
  })

  it.each([
    ['no file', undefined],
    ['not JSON', 'site'],
    ['null', 'null'],
    ['a number', '1'],
  ])('rejects %s', (_, text) => {
    expect(
      isSiteManifest(text === undefined ? undefined : encoder.encode(text)),
    ).toBe(false)
  })
})

describe('writeSiteTree', () => {
  async function distSnapshot(
    folder: ReturnType<typeof createMemorySiteDirectory>,
  ): Promise<[string, string][]> {
    const dist = await folder.root.getDirectoryHandle('dist')
    return (await snapshotSiteDirectory(dist)).map(([path, bytes]) => [
      path,
      bytes === 'dir' ? 'dir' : new TextDecoder().decode(bytes),
    ])
  }

  it('writes the tree into a new dist, manifest first, and reports progress', async () => {
    const folder = createMemorySiteDirectory({ 'photo.jpg': 'keep' })
    const progress: [number, number][] = []

    const result = await writeSiteTree(folder.root, TREE, (done, total) => {
      progress.push([done, total])
    })

    expect(result).toEqual({
      ok: true,
      files: 3,
      bytes: TREE.files.reduce((sum, file) => sum + file.bytes.length, 0),
    })
    expect(folder.ops[0]).toBe('mkdir dist')
    expect(folder.ops[1]).toBe('write dist/site.json')
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
    expect(await distSnapshot(folder)).toEqual([
      ['books', 'dir'],
      ['books/new', 'dir'],
      ['books/new/index.html', '<p>new</p>'],
      ['index.html', '<p>index</p>'],
      ['site.json', MANIFEST],
    ])
  })

  it('replaces an earlier export: stale entries go, unchanged files are rewritten', async () => {
    const folder = createMemorySiteDirectory({
      'dist/site.json': '{"version":1,"books":[1],"assets":[]}',
      'dist/index.html': '<p>index</p>',
      'dist/books/old/index.html': '<p>old</p>',
      'dist/assets/aa/x.jpg': 'x',
    })

    const result = await writeSiteTree(folder.root, TREE)

    expect(result).toMatchObject({ ok: true, files: 3 })
    expect(folder.ops).toEqual([
      'remove dist/assets',
      'remove dist/books/old',
      'write dist/site.json',
      'mkdir dist/books/new',
      'write dist/books/new/index.html',
      'write dist/index.html',
    ])
    expect((await distSnapshot(folder)).map(([path]) => path)).toEqual([
      'books',
      'books/new',
      'books/new/index.html',
      'index.html',
      'site.json',
    ])
  })

  it('opens each directory once per write', async () => {
    const folder = createMemorySiteDirectory()

    await writeSiteTree(
      folder.root,
      treeOf({
        'site.json': MANIFEST,
        'a/b/x': 'x',
        'a/b/y': 'y',
        'a/b/z': 'z',
      }),
    )

    // dist, a, a/b
    expect(folder.lookups()).toBe(3)
  })

  it('writes into an empty dist directory', async () => {
    const folder = createMemorySiteDirectory({ 'dist/': '' })

    expect(await writeSiteTree(folder.root, TREE)).toMatchObject({ ok: true })
    expect(folder.ops).not.toContain('mkdir dist')
  })

  it.each([
    ['a foreign dist directory', { 'dist/readme.txt': 'mine' }],
    ['a foreign site.json', { 'dist/site.json': '{"name":"blog"}' }],
    ['a dist file', { dist: 'mine' }],
  ])('leaves %s untouched', async (_, seed) => {
    const folder = createMemorySiteDirectory(seed)
    const before = await snapshotSiteDirectory(folder.root)

    const result = await writeSiteTree(folder.root, TREE)

    expect(result).toEqual({ ok: false, code: 'not-our-export' })
    expect(folder.ops).toEqual([])
    expect(await snapshotSiteDirectory(folder.root)).toEqual(before)
  })

  it('throws file-system errors for the caller to map', async () => {
    const folder = createMemorySiteDirectory()
    const quota = new DOMException('full', 'QuotaExceededError')
    folder.failNextWrite(quota)

    await expect(writeSiteTree(folder.root, TREE)).rejects.toBe(quota)
  })
})

describe('siteExportErrorCode', () => {
  it.each([
    ['NotAllowedError', 'permission'],
    ['SecurityError', 'permission'],
    ['QuotaExceededError', 'quota'],
    ['NotFoundError', 'unknown'],
  ])('maps %s to %s', (name, code) => {
    expect(siteExportErrorCode(new DOMException('x', name))).toBe(code)
  })

  it('maps a non-error to unknown', () => {
    expect(siteExportErrorCode('boom')).toBe('unknown')
  })
})

import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { buildSiteTree } from '../site/export'
import {
  derivativesFor,
  makePhotoBook,
  photoHash,
  publishAll,
  referencedPaths,
  sha256Hex,
} from '../site/export/siteExport.test-helpers'
import {
  fileKind,
  hashSiteFiles,
  planUpload,
  type PublishFile,
  type UploadStep,
} from '.'

const PBT_RUNS = { numRuns: 300 }

const KEYS = [
  'index.html',
  'books/a/index.html',
  'books/b/index.html',
  'site.json',
  'books/a/book.json',
  'assets/1.avif',
  'assets/2.avif',
  'assets/3.webp',
  'viewer/site-1.js',
  'viewer/site-1.css',
] as const

const HASHES = ['1', '2', '3'].map((digit) => digit.repeat(64))

const manifestEntries = fc.array(
  fc.tuple(fc.constantFrom(...KEYS), fc.constantFrom(...HASHES)),
  { maxLength: KEYS.length },
)

function rankOf(step: UploadStep): number {
  if (step.op === 'delete') return 3
  return { asset: 0, json: 1, html: 2 }[fileKind(step.key)]
}

describe('planUpload (PBT)', () => {
  test.prop([manifestEntries, manifestEntries], PBT_RUNS)(
    'puts exactly the new or changed keys, deletes remote-only keys, in kind order',
    (localEntries, remoteEntries) => {
      const local: PublishFile[] = [...new Map(localEntries)].map(
        ([key, sha256]) => ({ key, sha256 }),
      )
      const remote = Object.fromEntries(remoteEntries)

      const plan = planUpload(local, remote)

      const puts = plan.filter((step) => step.op === 'put')
      const deletes = plan.filter((step) => step.op === 'delete')
      expect(new Set(puts.map((step) => `${step.key}@${step.sha256}`))).toEqual(
        new Set(
          local
            .filter((file) => remote[file.key] !== file.sha256)
            .map((file) => `${file.key}@${file.sha256}`),
        ),
      )
      expect(puts).toHaveLength(
        local.filter((file) => remote[file.key] !== file.sha256).length,
      )
      expect(deletes.map((step) => step.key).sort()).toEqual(
        Object.keys(remote)
          .filter((key) => !local.some((file) => file.key === key))
          .sort(),
      )
      const ranks = plan.map(rankOf)
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    },
  )

  test.prop([manifestEntries], PBT_RUNS)(
    'an unchanged site plans nothing',
    (entries) => {
      const local = [...new Map(entries)].map(([key, sha256]) => ({
        key,
        sha256,
      }))

      expect(
        planUpload(
          local,
          Object.fromEntries(local.map((file) => [file.key, file.sha256])),
        ),
      ).toEqual([])
    },
  )
})

describe('planUpload', () => {
  it('orders by key within a kind and ignores inherited object keys', () => {
    const plan = planUpload(
      [
        { key: 'b.html', sha256: HASHES[0] ?? '' },
        { key: 'a.html', sha256: HASHES[0] ?? '' },
        { key: 'a.json', sha256: HASHES[0] ?? '' },
        { key: 'same.avif', sha256: HASHES[2] ?? '' },
        { key: 'toString', sha256: HASHES[0] ?? '' },
        { key: 'b.avif', sha256: HASHES[0] ?? '' },
        { key: 'a.avif', sha256: HASHES[1] ?? '' },
      ],
      {
        'a.avif': HASHES[0] ?? '',
        'same.avif': HASHES[2] ?? '',
        'old/b.avif': '',
        'old/a.html': '',
      },
    )

    expect(plan.map((step) => `${step.op} ${step.key}`)).toEqual([
      'put a.avif',
      'put b.avif',
      'put toString',
      'put a.json',
      'put a.html',
      'put b.html',
      'delete old/a.html',
      'delete old/b.avif',
    ])
  })

  it('uploads every file a page references before the page (real export)', async () => {
    const photos = [1, 2, 3].map(photoHash)
    const { meta, revisions } = publishAll([
      makePhotoBook('bk-1', 'One', [[photos[0] ?? '', photos[1] ?? '']]),
      makePhotoBook('bk-2', 'Two', [[photos[2] ?? '']]),
    ])
    const tree = await buildSiteTree({
      meta,
      revisions,
      derivatives: photos.flatMap((hash) => derivativesFor(hash)),
    })
    const local = await hashSiteFiles(tree.files)

    const plan = planUpload(local, {})

    const position = new Map(plan.map((step, index) => [step.key, index]))
    const keys = new Set(tree.files.map((file) => file.path))
    const refs = referencedPaths(tree).filter(
      (ref) => keys.has(ref) && !ref.endsWith('.html'),
    )
    expect(refs.length).toBeGreaterThan(0)
    const firstHtml = Math.min(
      ...plan
        .filter((step) => step.key.endsWith('.html'))
        .map((step) => position.get(step.key) ?? -1),
    )
    for (const ref of refs) {
      expect(position.get(ref)).toBeLessThan(firstHtml)
    }
    expect(plan).toHaveLength(tree.files.length)
  })
})

describe('hashSiteFiles', () => {
  it('keys files by path with their SHA-256', async () => {
    const bytes = new TextEncoder().encode('<p>hi</p>')

    expect(await hashSiteFiles([{ path: 'index.html', bytes }])).toEqual([
      { key: 'index.html', sha256: await sha256Hex(bytes) },
    ])
  })
})

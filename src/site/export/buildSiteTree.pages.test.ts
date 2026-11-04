import { describe, expect, it } from 'vitest'
import type { SitePageAssets, SitePageInput } from '../siteInput'
import { buildSiteTree, type SiteExportInput } from '.'
import {
  derivativesFor,
  makePhotoBook,
  photoHash,
  publishAll,
  sha256Hex,
} from './siteExport.test-helpers'

const encoder = new TextEncoder()

/** Kit-like preset sizes, so srcset widths and the largest size differ. */
const SIZES: Record<string, [number, number]> = {
  'site-thumb': [480, 320],
  'site-display': [1600, 1067],
  'site-large': [3200, 2133],
  'site-share': [1600, 1067],
}

function sized(hash: string, presets?: readonly string[]) {
  return derivativesFor(hash, presets).map((derivative) => {
    const [width, height] = SIZES[derivative.presetId] ?? [1, 1]
    return { ...derivative, width, height }
  })
}

/** Content-addressed site path of `(hash, preset)` as `derivativesFor` encodes it. */
async function asset(hash: string, presetId: string): Promise<string> {
  const ext = presetId === 'site-share' ? 'jpg' : 'webp'
  return `assets/${await sha256Hex(encoder.encode(`${hash}:${presetId}`))}.${ext}`
}

const assetId = (hash: string) => `asset-${hash.slice(-6)}`

/** Alps (cover photo 1) published first, Sea (no cover) second. */
function library(): SiteExportInput {
  const alps = makePhotoBook('book-alps', 'Alps', [
    [photoHash(1)],
    [photoHash(2)],
  ])
  alps.cover.front.assetId = assetId(photoHash(1))
  const sea = makePhotoBook('book-sea', 'Sea', [[photoHash(2)]])
  const { meta, revisions } = publishAll([alps, sea])
  return {
    meta,
    revisions,
    derivatives: [...sized(photoHash(1)), ...sized(photoHash(2))],
  }
}

async function pages(input: SiteExportInput) {
  const seen: { input: SitePageInput; assets: SitePageAssets }[] = []
  await buildSiteTree({
    ...input,
    renderer: (page, assets) => {
      seen.push({ input: page, assets })
      return ''
    },
  })
  const book = (title: string) => {
    const found = seen.find(
      (page) => page.input.kind === 'book' && page.input.book.title === title,
    )?.input
    if (found?.kind !== 'book') throw new Error(`no page for ${title}`)
    return found
  }
  const catalog = seen.find((page) => page.input.kind === 'catalog')?.input
  if (catalog?.kind !== 'catalog') throw new Error('no catalog page')
  return { book, catalog }
}

describe('buildSiteTree page inputs', () => {
  it('gives book pages a webp srcset, the display size as src and the share JPEG as og:image', async () => {
    const { book } = await pages(library())
    const alps = book('Alps')
    const hash = photoHash(1)

    expect(alps.images[assetId(hash)]).toStrictEqual({
      src: `../../${await asset(hash, 'site-display')}`,
      srcset: [
        `../../${await asset(hash, 'site-thumb')} 480w`,
        `../../${await asset(hash, 'site-display')} 1600w`,
        `../../${await asset(hash, 'site-large')} 3200w`,
      ].join(', '),
      w: 3200,
      h: 2133,
    })
    expect(alps.ogImage).toBe(`../../${await asset(hash, 'site-share')}`)
    expect(book('Sea').ogImage).toBeUndefined()
    expect(alps.catalogHref).toBe('../../')
    expect(alps.path).toMatch(/^books\/[0-9a-f]{16}\/$/)
    expect(alps.site).toStrictEqual({ title: 'Photobooks' })
  })

  it('reduces asset records to their ids and drops the gallery', async () => {
    const { book } = await pages(library())

    expect(book('Alps').book.assets).toStrictEqual({
      [assetId(photoHash(1))]: {},
      [assetId(photoHash(2))]: {},
    })
    expect(book('Alps').book.gallery).toStrictEqual([])
  })

  it('lists catalog books newest first with format, pages, cover and ink', async () => {
    const { catalog } = await pages(library())
    const hash = photoHash(1)

    expect(
      catalog.books.map(({ title, pages: count, fmt, ink, place }) => ({
        title,
        count,
        fmt,
        ink,
        place,
      })),
    ).toStrictEqual([
      { title: 'Sea', count: 1, fmt: 'square', ink: '#2E2C2D', place: 'top' },
      { title: 'Alps', count: 2, fmt: 'square', ink: '#F5F5F5', place: 'top' },
    ])
    expect(catalog.books[0]?.cover).toBeNull()
    expect(catalog.books[1]?.cover?.src).toBe(await asset(hash, 'site-thumb'))
    expect(catalog.books[1]?.id).toBe('book-alps')
    expect(catalog.ogImage).toBe(await asset(hash, 'site-share'))
    expect(catalog.path).toBe('')
  })

  it('passes the site settings to every page', async () => {
    const site = {
      title: 'Alex',
      author: 'Alex Doe',
      url: 'https://alex.example',
    }
    const { book, catalog } = await pages({ ...library(), site })

    expect(catalog.site).toStrictEqual(site)
    expect(book('Sea').site).toStrictEqual(site)
  })

  it('falls back to the JPEG when a photo has no webp, and to the display size for og:image', async () => {
    const input = library()
    const hash = photoHash(1)
    const { book } = await pages({
      ...input,
      derivatives: [
        ...sized(hash, ['site-share']),
        ...sized(photoHash(2), ['site-display']),
      ],
    })
    const share = await asset(hash, 'site-share')

    expect(book('Alps').images[assetId(hash)]).toStrictEqual({
      src: `../../${share}`,
      srcset: `../../${share} 1600w`,
      w: 1600,
      h: 1067,
    })
    const { book: noShare } = await pages({
      ...input,
      derivatives: sized(hash, ['site-thumb', 'site-display']),
    })
    expect(noShare('Alps').ogImage).toBe(
      `../../${await asset(hash, 'site-display')}`,
    )
    const { book: thumbOnly } = await pages({
      ...input,
      derivatives: sized(hash, ['site-thumb']),
    })
    expect(thumbOnly('Alps').ogImage).toBe(
      `../../${await asset(hash, 'site-thumb')}`,
    )
  })

  it('rejects a viewer stylesheet outside the bundle', async () => {
    const viewer = {
      entry: 'main.js',
      css: ['gone.css'],
      files: [{ path: 'main.js', bytes: encoder.encode('') }],
    }

    await expect(buildSiteTree({ ...library(), viewer })).rejects.toThrow(
      'Viewer entry not in bundle: gone.css',
    )
  })
})

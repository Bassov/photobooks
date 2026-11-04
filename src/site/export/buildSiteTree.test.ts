import { describe, expect, it } from 'vitest'
import { unpublishBook } from '../../project'
import type { SitePageAssets, SitePageInput } from '../siteInput'
import {
  buildSiteTree,
  SITE_MANIFEST_PATH,
  type SiteExportInput,
  type SiteTree,
} from '.'
import {
  allText,
  derivativesFor,
  fileText,
  makePhotoBook,
  photoHash,
  publishAll,
  referencedPaths,
  sha256Hex,
} from './siteExport.test-helpers'

const encoder = new TextEncoder()

const MAIN_JS = { path: 'main.js', bytes: encoder.encode('console.log(1)') }
const MAIN_CSS = { path: 'main.css', bytes: encoder.encode('a{}') }
const VIEWER = {
  entry: 'main.js',
  files: [MAIN_JS, { path: 'chunks/a.js', bytes: encoder.encode('export {}') }],
}

const extraFrame = (id: string, assetId: string) => ({
  id,
  rect: { x: 0, y: 0, width: 10, height: 10 },
  z: 1,
  assetId,
})

function sampleInput(): SiteExportInput {
  const alps = makePhotoBook('book-alps', 'Alps', [
    [photoHash(1), photoHash(2)],
    [photoHash(3)],
  ])
  const sea = makePhotoBook('book-sea', 'Sea', [[photoHash(3), photoHash(4)]])
  const { meta, revisions } = publishAll([alps, sea])
  return {
    meta,
    revisions,
    derivatives: [1, 2, 3, 4].flatMap((n) => derivativesFor(photoHash(n))),
    viewer: VIEWER,
  }
}

/** Pages by size (renderSitePage.test.tsx pins their markup), JSON in full. */
function summary(tree: SiteTree): string[] {
  return tree.files.map((file) =>
    file.path.endsWith('.json')
      ? `${file.path}\n${new TextDecoder().decode(file.bytes)}`
      : `${file.path} (${String(file.bytes.byteLength)} B)`,
  )
}

function bookPageText(tree: SiteTree): string {
  const page = tree.files.find((file) => file.path.startsWith('books/'))
  return fileText(tree, page?.path ?? '') ?? ''
}

describe('buildSiteTree', () => {
  it('builds a byte-identical tree for the same library, in any input order', async () => {
    const input = sampleInput()
    const reversed: SiteExportInput = {
      ...input,
      revisions: [...input.revisions].reverse(),
      derivatives: [...input.derivatives].reverse(),
    }

    const first = await buildSiteTree(input)
    const second = await buildSiteTree(reversed)

    expect(second).toStrictEqual(first)
    expect(summary(first)).toMatchInlineSnapshot(`
      [
        "assets/1bb7fd15bc7f25afe356d3f8babc7fed6bb6126f657db6e2091b6c78ff061fdc.webp (77 B)",
        "assets/214cb6774dbb5222b2be5e02440b7cf9a3d362f636b576f2f9b83c17ee306751.jpg (75 B)",
        "assets/218e3e3a0e1b57bd293262a65067fb9df352472e3a9ddac6116c34d4722540ef.webp (75 B)",
        "assets/25d3da1664df0d17a8e37d935176b3f18c2d22c56728f689ca353c3ec57f95df.webp (75 B)",
        "assets/3c424d013c99bcc2a9cdb09210ff5f3bb8f354ce1f9e8e59135de637730d12d8.webp (75 B)",
        "assets/4a4541838d7867e75286072761dfc473f7dbbc12d6dda003cb4ab815fa67c2db.webp (77 B)",
        "assets/560cd55110945e7b6d126e9becab89709fa197a708dd82bb93d3bb6249a9154d.jpg (75 B)",
        "assets/89c6d954b459d27e934a3e23f502c80ff6861b4af6c0e0467ea6f792118c7833.webp (75 B)",
        "assets/9613e727e0a8e27b6d5d6137a9e09f9d067c229b40390bdf629cef9d515e757e.webp (75 B)",
        "assets/a28c7bbdd1ab04137021db6f45e83440ee033428f97671d095984e4e8ee48ce5.webp (75 B)",
        "assets/ad259fcd599c50c77dcc654336fafaa01324bd5c6916b5ce0a04e07d26cd82e4.jpg (75 B)",
        "assets/bc01d13df6ec8705ec67073a384672a7f906dc8f8594e4f58e8c4eecf6627777.webp (75 B)",
        "assets/be138880457e2a48dd3f527a186e11d58da43090fc2798ad02133b48d1f85067.webp (77 B)",
        "assets/bf621cdd1f3c1fc4758f4796dc7fa3206fb7c5f82b5e0a978432e1a1bace6d57.jpg (75 B)",
        "assets/ce0ca0b8db36493cf4fcc8b960bcdfcffb9ae80a7a375880105bfddbcd87880a.webp (75 B)",
        "assets/dbd5c370258b773cdbdd43046464945c6e37fd469d45f76dd6ee5704439420bf.webp (77 B)",
        "books/4bd1c37bb40aa516/index.html (9237 B)",
        "books/91f8c6c636f0b969/index.html (8670 B)",
        "index.html (4053 B)",
        "site.json
      {"version":1,"viewer":"viewer/main.js","books":[{"id":"book-sea","title":"Sea","path":"books/91f8c6c636f0b969/","assets":["0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000004"],"spreads":[{"id":"book-sea-spread-0","images":["0000000000000000000000000000000000000000000000000000000000000003","0000000000000000000000000000000000000000000000000000000000000004"]}]},{"id":"book-alps","title":"Alps","path":"books/4bd1c37bb40aa516/","assets":["0000000000000000000000000000000000000000000000000000000000000001","0000000000000000000000000000000000000000000000000000000000000002","0000000000000000000000000000000000000000000000000000000000000003"],"spreads":[{"id":"book-alps-spread-0","images":["0000000000000000000000000000000000000000000000000000000000000001","0000000000000000000000000000000000000000000000000000000000000002"]},{"id":"book-alps-spread-1","images":["0000000000000000000000000000000000000000000000000000000000000003"]}]}],"assets":[{"hash":"0000000000000000000000000000000000000000000000000000000000000001","files":[{"preset":"site-thumb","path":"assets/a28c7bbdd1ab04137021db6f45e83440ee033428f97671d095984e4e8ee48ce5.webp","width":160,"height":120},{"preset":"site-display","path":"assets/1bb7fd15bc7f25afe356d3f8babc7fed6bb6126f657db6e2091b6c78ff061fdc.webp","width":160,"height":120},{"preset":"site-large","path":"assets/89c6d954b459d27e934a3e23f502c80ff6861b4af6c0e0467ea6f792118c7833.webp","width":160,"height":120},{"preset":"site-share","path":"assets/560cd55110945e7b6d126e9becab89709fa197a708dd82bb93d3bb6249a9154d.jpg","width":160,"height":120}]},{"hash":"0000000000000000000000000000000000000000000000000000000000000002","files":[{"preset":"site-thumb","path":"assets/218e3e3a0e1b57bd293262a65067fb9df352472e3a9ddac6116c34d4722540ef.webp","width":160,"height":120},{"preset":"site-display","path":"assets/be138880457e2a48dd3f527a186e11d58da43090fc2798ad02133b48d1f85067.webp","width":160,"height":120},{"preset":"site-large","path":"assets/9613e727e0a8e27b6d5d6137a9e09f9d067c229b40390bdf629cef9d515e757e.webp","width":160,"height":120},{"preset":"site-share","path":"assets/ad259fcd599c50c77dcc654336fafaa01324bd5c6916b5ce0a04e07d26cd82e4.jpg","width":160,"height":120}]},{"hash":"0000000000000000000000000000000000000000000000000000000000000003","files":[{"preset":"site-thumb","path":"assets/ce0ca0b8db36493cf4fcc8b960bcdfcffb9ae80a7a375880105bfddbcd87880a.webp","width":160,"height":120},{"preset":"site-display","path":"assets/dbd5c370258b773cdbdd43046464945c6e37fd469d45f76dd6ee5704439420bf.webp","width":160,"height":120},{"preset":"site-large","path":"assets/25d3da1664df0d17a8e37d935176b3f18c2d22c56728f689ca353c3ec57f95df.webp","width":160,"height":120},{"preset":"site-share","path":"assets/214cb6774dbb5222b2be5e02440b7cf9a3d362f636b576f2f9b83c17ee306751.jpg","width":160,"height":120}]},{"hash":"0000000000000000000000000000000000000000000000000000000000000004","files":[{"preset":"site-thumb","path":"assets/bc01d13df6ec8705ec67073a384672a7f906dc8f8594e4f58e8c4eecf6627777.webp","width":160,"height":120},{"preset":"site-display","path":"assets/4a4541838d7867e75286072761dfc473f7dbbc12d6dda003cb4ab815fa67c2db.webp","width":160,"height":120},{"preset":"site-large","path":"assets/3c424d013c99bcc2a9cdb09210ff5f3bb8f354ce1f9e8e59135de637730d12d8.webp","width":160,"height":120},{"preset":"site-share","path":"assets/bf621cdd1f3c1fc4758f4796dc7fa3206fb7c5f82b5e0a978432e1a1bace6d57.jpg","width":160,"height":120}]}]}
      ",
        "viewer/chunks/a.js (9 B)",
        "viewer/main.js (14 B)",
      ]
    `)
  })

  it('exports the frozen revision, not edits made to the draft after publishing', async () => {
    const draft = makePhotoBook('book-1', 'Published title', [[photoHash(1)]])
    const { meta, revisions } = publishAll([draft])
    draft.title = 'Draft title'
    draft.assets['asset-new'] = { contentHash: photoHash(9) }
    draft.spreads[0]?.frames.push(extraFrame('frame-new', 'asset-new'))
    const draftOnly = derivativesFor(photoHash(9))
    const draftPaths = await Promise.all(
      draftOnly.map(async (d) => `assets/${await sha256Hex(d.bytes)}.webp`),
    )

    const tree = await buildSiteTree({
      meta,
      revisions,
      derivatives: [...derivativesFor(photoHash(1)), ...draftOnly],
    })

    expect(allText(tree)).toContain('Published title')
    expect(allText(tree)).not.toMatch(/Draft title|0{63}9/)
    expect(
      tree.files.filter((file) => draftPaths.includes(file.path)),
    ).toStrictEqual([])
  })

  it('leaves out unpublished books and books without library status', async () => {
    const kept = makePhotoBook('book-kept', 'Kept', [[photoHash(1)]])
    const gone = makePhotoBook('book-gone', 'Gone', [[photoHash(2)]])
    const none = makePhotoBook('book-none', 'Nobody', [[photoHash(3)]])
    const { revisions } = publishAll([kept, gone, none])
    const meta = unpublishBook(publishAll([kept, gone]).meta, 'book-gone')

    const tree = await buildSiteTree({
      meta,
      revisions,
      derivatives: [1, 2, 3].flatMap((n) => derivativesFor(photoHash(n))),
    })

    expect(allText(tree)).toContain('Kept')
    expect(allText(tree)).not.toMatch(/Gone|Nobody/)
    expect(
      tree.files.filter((file) => file.path.startsWith('assets/')),
    ).toHaveLength(4)
  })

  it('reports missing derivatives and never links a photo without any', async () => {
    const book = makePhotoBook('book-1', 'One', [[photoHash(1), photoHash(2)]])
    const { meta, revisions } = publishAll([book])
    const thumb = await sha256Hex(encoder.encode(`${photoHash(1)}:site-thumb`))

    const tree = await buildSiteTree({
      meta,
      revisions,
      derivatives: derivativesFor(photoHash(1), ['site-thumb', 'site-large']),
    })

    expect(tree.missing).toStrictEqual([
      { assetHash: photoHash(1), presetId: 'site-display' },
      { assetHash: photoHash(1), presetId: 'site-share' },
      { assetHash: photoHash(2), presetId: 'site-thumb' },
      { assetHash: photoHash(2), presetId: 'site-display' },
      { assetHash: photoHash(2), presetId: 'site-large' },
      { assetHash: photoHash(2), presetId: 'site-share' },
    ])
    expect(allText(tree)).not.toContain(photoHash(2))
    expect(bookPageText(tree)).toContain(`src="../../assets/${thumb}.webp"`)
    expect(new Set(tree.files.map((file) => file.path))).toStrictEqual(
      new Set([...referencedPaths(tree), 'index.html', SITE_MANIFEST_PATH]),
    )
  })

  it('skips photos without a content hash and never exports asset metadata', async () => {
    const book = makePhotoBook('book-1', 'One', [[photoHash(1)]])
    book.assets['asset-000001'] = {
      contentHash: photoHash(1),
      relativePath: 'secret/holiday.jpg',
      sourceRootId: 'root-hidden',
      meta: { caption: 'Private caption', gps: { lat: 51.4778, lon: -0.0014 } },
    }
    book.assets['asset-raw'] = { relativePath: 'raw.jpg' }
    book.spreads[0]?.frames.push(extraFrame('frame-raw', 'asset-raw'))
    const { meta, revisions } = publishAll([book])

    const tree = await buildSiteTree({
      meta,
      revisions,
      derivatives: derivativesFor(photoHash(1)),
    })

    expect(allText(tree)).not.toMatch(
      /secret|root-hidden|Private|51\.4778|raw\.jpg|publishedAt/,
    )
    expect(tree.missing).toStrictEqual([])
    expect(bookPageText(tree).match(/<img /g)).toHaveLength(1)
  })

  it('renders through an injected renderer with page-relative URLs', async () => {
    const pages: { input: SitePageInput; assets: SitePageAssets }[] = []
    const renderer = (input: SitePageInput, assets: SitePageAssets) => {
      pages.push({ input, assets })
      return input.kind === 'catalog'
        ? '<main>index</main>'
        : `<main>${input.book.title ?? ''}</main>`
    }
    const viewer = {
      ...VIEWER,
      css: ['main.css'],
      files: [...VIEWER.files, MAIN_CSS],
    }

    const tree = await buildSiteTree({ ...sampleInput(), viewer, renderer })

    expect(fileText(tree, 'index.html')).toBe('<main>index</main>')
    expect(bookPageText(tree)).toMatch(/^<main>(Alps|Sea)<\/main>$/)
    const index = pages.find((page) => page.input.kind === 'catalog')
    const book = pages.find((page) => page.input.kind === 'book')
    expect(index?.assets).toStrictEqual({
      css: ['viewer/main.css'],
      js: 'viewer/main.js',
    })
    expect(
      index?.input.kind === 'catalog' &&
        index.input.books.map((entry) => entry.title),
    ).toStrictEqual(['Sea', 'Alps'])
    expect(
      index?.input.kind === 'catalog' && index.input.books[0]?.href,
    ).toMatch(/^books\/[0-9a-f]{16}\/$/)
    expect(book?.assets).toStrictEqual({
      css: ['../../viewer/main.css'],
      js: '../../viewer/main.js',
    })
    expect(
      book?.input.kind === 'book' && Object.values(book.input.images)[0]?.src,
    ).toMatch(/^\.\.\/\.\.\/assets\/[0-9a-f]{64}\.webp$/)
  })

  it('omits the viewer script and manifest entry without a bundle', async () => {
    const { meta, revisions, derivatives } = sampleInput()

    const tree = await buildSiteTree({ meta, revisions, derivatives })

    expect(allText(tree)).not.toMatch(/<script type="module"|"viewer"/)
    expect(tree.files.map((file) => file.path)).not.toContain('viewer/main.js')
  })

  it('passes no viewer URL to the renderer without a bundle', async () => {
    const { meta, revisions, derivatives } = sampleInput()
    const seen: SitePageAssets[] = []

    await buildSiteTree({
      meta,
      revisions,
      derivatives,
      renderer: (_input, assets) => {
        seen.push(assets)
        return ''
      },
    })

    expect(seen.filter((assets) => 'js' in assets)).toStrictEqual([])
    expect(seen).toHaveLength(3)
  })

  it('orders books published at the same time by id, in any input order', async () => {
    const { meta, revisions } = publishAll([
      makePhotoBook('book-b', 'Bee', [[photoHash(1)]]),
      makePhotoBook('book-a', 'Ant', [[photoHash(2)]]),
    ])
    const same = revisions.map((revision) => ({
      ...revision,
      publishedAtMs: 5,
    }))

    const forward = await buildSiteTree({
      meta,
      revisions: same,
      derivatives: [],
    })
    const backward = await buildSiteTree({
      meta,
      revisions: [...same].reverse(),
      derivatives: [],
    })

    expect(backward).toStrictEqual(forward)
    expect(fileText(forward, 'index.html')).toMatch(/Ant.*Bee/)
  })

  it('exports an empty site when nothing is published', async () => {
    const tree = await buildSiteTree({
      meta: {},
      revisions: [],
      derivatives: [],
    })

    expect(tree.files.map((file) => file.path)).toStrictEqual([
      'index.html',
      SITE_MANIFEST_PATH,
    ])
    expect(JSON.parse(fileText(tree, SITE_MANIFEST_PATH) ?? '')).toStrictEqual({
      version: 1,
      books: [],
      assets: [],
    })
  })

  it.each([
    '../escape.js',
    '/abs.js',
    'a//b.js',
    './main.js',
    'main.js/',
    'chunks\\..\\..\\x.js',
  ])('rejects viewer path %s', async (path) => {
    const viewer = {
      entry: 'main.js',
      files: [...VIEWER.files, { path, bytes: new Uint8Array() }],
    }

    await expect(buildSiteTree({ ...sampleInput(), viewer })).rejects.toThrow(
      `Invalid viewer path: ${path}`,
    )
  })

  it('rejects a duplicate viewer path', async () => {
    const viewer = { entry: 'main.js', files: [...VIEWER.files, MAIN_JS] }

    await expect(buildSiteTree({ ...sampleInput(), viewer })).rejects.toThrow(
      'Invalid viewer path: main.js',
    )
  })

  it('rejects a viewer entry outside the bundle', async () => {
    const viewer = { entry: 'other.js', files: VIEWER.files }

    await expect(buildSiteTree({ ...sampleInput(), viewer })).rejects.toThrow(
      'Viewer entry not in bundle: other.js',
    )
  })

  it('rejects two revisions of one book', async () => {
    const input = sampleInput()

    await expect(
      buildSiteTree({
        ...input,
        revisions: [...input.revisions, ...input.revisions],
      }),
    ).rejects.toThrow('Duplicate published revision: book-alps')
  })

  it('rejects a duplicate derivative and an unknown preset', async () => {
    const input = sampleInput()
    const thumb = derivativesFor(photoHash(1), ['site-thumb'])
    const huge = derivativesFor(photoHash(1), ['site-huge'])

    await expect(
      buildSiteTree({
        ...input,
        derivatives: [...input.derivatives, ...thumb],
      }),
    ).rejects.toThrow(`Duplicate derivative: ${photoHash(1)} site-thumb`)
    await expect(
      buildSiteTree({ ...input, derivatives: huge }),
    ).rejects.toThrow('Unknown derivative preset: site-huge')
  })
})

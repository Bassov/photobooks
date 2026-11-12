import { fc, test } from '@fast-check/vitest'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderSitePage, siteDataJson } from './renderSitePage'
import { sampleSiteInput } from './sampleSite'
import { SiteApp } from './SiteApp'
import type { SitePageInput } from './siteInput'

const ASSETS = { css: ['../../viewer/site.css'], js: '../../viewer/site.js' }

function bookInput(
  patch: Partial<Extract<SitePageInput, { kind: 'book' }>> = {},
) {
  const input = sampleSiteInput('?book=sea')
  if (input.kind !== 'book') throw new Error('sample book missing')
  return { ...input, ...patch }
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('renderSitePage', () => {
  it('renders the catalog and a book page byte-identically every time', () => {
    const catalog = sampleSiteInput('')
    const book = bookInput()

    const first = [
      renderSitePage(catalog, ASSETS),
      renderSitePage(book, ASSETS),
    ]
    const second = [
      renderSitePage(catalog, ASSETS),
      renderSitePage(book, ASSETS),
    ]

    expect(second).toStrictEqual(first)
    expect(first[0]).toMatchSnapshot('catalog')
    expect(first[1]).toMatchSnapshot('book')
  })

  it('writes the head: title, description, og, assets; no canonical without a site URL', () => {
    const html = renderSitePage(bookInput({ ogImage: '../../a.jpg' }), ASSETS)
    // Parsed without the stylesheet: happy-dom would try to fetch it.
    const doc = parse(html.replace(/<link rel="stylesheet"[^>]*>/, ''))

    expect(doc.title).toBe('Sea · Sample photobooks')
    expect(doc.documentElement.lang).toBe('en')
    const meta = (name: string) =>
      doc
        .querySelector(`meta[name="${name}"], meta[property="${name}"]`)
        ?.getAttribute('content')
    expect(meta('description')).toBe('by A. Photographer · 6 pages')
    expect(meta('theme-color')).toBe('#E1E1E1')
    expect(meta('og:title')).toBe('Sea')
    expect(meta('og:type')).toBe('book')
    expect(meta('og:image')).toBe('../../a.jpg')
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull()
    expect(html).toContain(
      '<link rel="stylesheet" href="../../viewer/site.css"/>',
    )
    expect(
      doc.querySelector('script[type="module"]')?.getAttribute('src'),
    ).toBe('../../viewer/site.js')
  })

  it('preloads each font before the stylesheets, as anonymous CORS fonts', () => {
    const html = renderSitePage(bookInput(), {
      ...ASSETS,
      css: ['../../viewer/fonts/fonts.css', ...ASSETS.css],
      preload: ['../../viewer/fonts/a.woff2', '../../viewer/fonts/b.woff2'],
    })

    const head = html.slice(0, html.indexOf('</head>'))
    const links = [...head.matchAll(/<link [^>]*>/g)].map(([link]) => link)
    expect(links).toStrictEqual([
      '<link rel="preload" href="../../viewer/fonts/a.woff2" as="font" type="font/woff2" crossorigin=""/>',
      '<link rel="preload" href="../../viewer/fonts/b.woff2" as="font" type="font/woff2" crossorigin=""/>',
      '<link rel="stylesheet" href="../../viewer/fonts/fonts.css"/>',
      '<link rel="stylesheet" href="../../viewer/site.css"/>',
    ])
  })

  it('writes no canonical for an empty site URL and no og:image without one', () => {
    const empty = parse(
      renderSitePage(bookInput({ site: { title: 'A', url: '' } }), { css: [] }),
    )
    const noImage = parse(
      renderSitePage(
        bookInput({ site: { title: 'A', url: 'https://alex.example' } }),
        { css: [] },
      ),
    )

    expect(empty.querySelector('link[rel="canonical"]')).toBeNull()
    expect(noImage.querySelector('meta[property="og:image"]')).toBeNull()
    expect(noImage.querySelector('link[rel="canonical"]')).not.toBeNull()
  })

  it('makes the canonical and og:image absolute with a site URL', () => {
    const input = bookInput({
      site: { title: 'Alex', url: 'https://alex.example' },
      path: 'books/abc/',
      ogImage: '../../assets/c.jpg',
    })
    const doc = parse(renderSitePage(input, { css: [] }))

    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://alex.example/books/abc/')
    expect(
      doc.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    ).toBe('https://alex.example/assets/c.jpg')
    expect(doc.querySelector('script[type="module"]')).toBeNull()
  })

  it('writes the catalog head as a website', () => {
    const doc = parse(renderSitePage(sampleSiteInput(''), { css: [] }))

    expect(doc.title).toBe('Sample photobooks')
    expect(
      doc.querySelector('meta[property="og:type"]')?.getAttribute('content'),
    ).toBe('website')
    expect(
      doc.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe('Travel books from three summers, printed and bound by hand.')
    expect(
      doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe('#f4f3f0')
    expect(
      [...doc.querySelectorAll('noscript a')].map((a) =>
        a.getAttribute('href'),
      ),
    ).toStrictEqual([
      './site.html?book=alps',
      './site.html?book=sea',
      './site.html?book=lake',
    ])
  })

  it('writes the home description from the author without an intro, and no noscript list when empty', () => {
    const input = sampleSiteInput('?empty=1')
    const doc = parse(
      renderSitePage(
        { ...input, site: { title: 'T', author: 'Alex' } },
        { css: [] },
      ),
    )

    expect(
      doc.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe('Photobooks by Alex.')
    expect(doc.querySelector('noscript')).toBeNull()
  })

  it('keeps the grey bars on a book page', () => {
    const doc = parse(
      renderSitePage(sampleSiteInput('?book=alps'), { css: [] }),
    )

    expect(
      doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe('#E1E1E1')
  })

  it('escapes `<` in #site-data so a title never closes the script', () => {
    const book = bookInput().book
    const input = bookInput({
      book: { ...book, title: '</script><script>alert(1)</script>' },
    })

    const html = renderSitePage(input, { css: [] })

    expect(siteDataJson(input)).not.toContain('<')
    expect(html.match(/<script/g)).toHaveLength(1)
    const data = parse(html).getElementById('site-data')?.textContent ?? ''
    expect((JSON.parse(data) as SitePageInput).kind).toBe('book')
  })

  it('sorts #site-data keys at every depth', () => {
    expect(
      siteDataJson({
        ...sampleSiteInput('?empty=1'),
        site: { url: 'u', title: 't' },
      }),
    ).toBe(
      '{"books":[],"kind":"catalog","path":"","site":{"title":"t","url":"u"}}',
    )
  })

  it('hydrates the prerendered book page without a mismatch', async () => {
    const input = bookInput()
    const root = document.createElement('div')
    root.innerHTML =
      parse(renderSitePage(input, { css: [] })).getElementById('site-root')
        ?.innerHTML ?? ''
    document.body.append(root)
    const onRecoverableError = vi.fn()

    await act(async () => {
      hydrateRoot(root, <SiteApp input={input} />, { onRecoverableError })
      await Promise.resolve()
    })

    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(
      root.querySelector('[data-testid="site-page-indicator"]')?.textContent,
    ).toBe('Cover')
  })

  test.prop(
    [
      fc.integer({ min: 1, max: 8 }),
      fc.string({ maxLength: 12 }),
      fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
    ],
    { numRuns: 40 },
  )(
    'any book renders the same twice, with its input in #site-data',
    (n, title, author) => {
      const base = bookInput()
      const spreads = Array.from({ length: n }, (_, i) => ({
        ...(base.book.spreads[i % base.book.spreads.length] ??
          base.book.spreads[0]),
        id: `s-${String(i)}`,
      })) as typeof base.book.spreads
      const input = bookInput({
        site: author === undefined ? { title } : { title, author },
        book: { ...base.book, title, spreads },
      })

      const html = renderSitePage(input, { css: [] })

      expect(renderSitePage(input, { css: [] })).toBe(html)
      const data = parse(html).getElementById('site-data')?.textContent ?? ''
      expect(JSON.parse(data)).toStrictEqual(JSON.parse(JSON.stringify(input)))
    },
  )
})

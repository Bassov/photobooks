import { describe, expect, it } from 'vitest'
import {
  loadSiteViewerBundle,
  relativeCssUrls,
  SITE_VIEWER_MANIFEST,
} from './siteViewerBundle'

const decoder = new TextDecoder()

/** Static server double: `/app/<path>` → body, anything else 404. */
function serve(files: Record<string, string>) {
  const requested: string[] = []
  const fetchFile = (url: string): Promise<Response> => {
    requested.push(url)
    const body = files[url.replace(/^\/app\//, '')]
    return Promise.resolve(
      body === undefined
        ? new Response('missing', { status: 404 })
        : new Response(body),
    )
  }
  return { fetchFile, requested }
}

const MANIFEST = JSON.stringify({
  entry: 'assets/site.js',
  css: ['assets/site.css'],
  preload: ['fonts/a.woff2'],
  files: ['assets/chunk.js', 'assets/site.css', 'assets/site.js'],
})

describe('relativeCssUrls', () => {
  it('points root-absolute urls back up to the viewer root', () => {
    const css =
      'a{src:url(/fonts/a.woff2)}b{src:url(\'/fonts/b.woff2\')}c{src:url("/c.png")}'

    expect(relativeCssUrls('assets/site.css', css)).toEqual({
      css: 'a{src:url(../fonts/a.woff2)}b{src:url(\'../fonts/b.woff2\')}c{src:url("../c.png")}',
      refs: ['fonts/a.woff2', 'fonts/b.woff2', 'c.png'],
    })
  })

  it('leaves relative, data and protocol-relative urls alone', () => {
    const css =
      'a{src:url(x.png)}b{src:url(data:image/png;base64,AA)}c{src:url(//cdn/x.png)}'

    expect(relativeCssUrls('site.css', css)).toEqual({ css, refs: [] })
  })

  it('keeps a root-level stylesheet pointing at the root', () => {
    expect(relativeCssUrls('site.css', 'a{src:url(/f.woff2)}')).toEqual({
      css: 'a{src:url(f.woff2)}',
      refs: ['f.woff2'],
    })
  })
})

describe('loadSiteViewerBundle', () => {
  it('loads every listed file plus the fonts its CSS points at', async () => {
    const { fetchFile, requested } = serve({
      [SITE_VIEWER_MANIFEST]: MANIFEST,
      'assets/chunk.js': 'export const x = 1',
      'assets/site.js': "import './chunk.js'",
      'assets/site.css':
        'a{src:url(/fonts/b.woff2)}b{src:url(/fonts/a.woff2)}c{src:url(/fonts/a.woff2)}',
      'fonts/a.woff2': 'A',
      'fonts/b.woff2': 'B',
    })

    const bundle = await loadSiteViewerBundle(fetchFile, '/app/')

    expect(bundle.entry).toBe('assets/site.js')
    expect(bundle.css).toEqual(['assets/site.css'])
    expect(bundle.preload).toEqual(['fonts/a.woff2'])
    expect(
      bundle.files.map(({ path, bytes }) => [path, decoder.decode(bytes)]),
    ).toEqual([
      ['assets/chunk.js', 'export const x = 1'],
      [
        'assets/site.css',
        'a{src:url(../fonts/b.woff2)}b{src:url(../fonts/a.woff2)}c{src:url(../fonts/a.woff2)}',
      ],
      ['assets/site.js', "import './chunk.js'"],
      ['fonts/a.woff2', 'A'],
      ['fonts/b.woff2', 'B'],
    ])
    expect(requested[0]).toBe('/app/site-viewer.json')
    expect(
      requested.filter((url) => url === '/app/fonts/a.woff2'),
    ).toHaveLength(1)
  })

  it('does not fetch a referenced file twice when the manifest lists it', async () => {
    const { fetchFile, requested } = serve({
      [SITE_VIEWER_MANIFEST]: JSON.stringify({
        entry: 'assets/site.js',
        css: ['assets/site.css'],
        files: ['assets/logo.png', 'assets/site.css', 'assets/site.js'],
      }),
      'assets/logo.png': 'P',
      'assets/site.js': '',
      'assets/site.css': 'a{background:url(/assets/logo.png)}',
    })

    const bundle = await loadSiteViewerBundle(fetchFile, '/app/')

    expect(bundle.files.map((file) => file.path)).toEqual([
      'assets/logo.png',
      'assets/site.css',
      'assets/site.js',
    ])
    expect(requested).toHaveLength(4)
  })

  it('rejects when the build has no manifest', async () => {
    const { fetchFile } = serve({})

    await expect(loadSiteViewerBundle(fetchFile, '/app/')).rejects.toThrow(
      'Viewer file site-viewer.json: HTTP 404',
    )
  })

  it('rejects when a CSS-referenced file is missing', async () => {
    const { fetchFile } = serve({
      [SITE_VIEWER_MANIFEST]: MANIFEST,
      'assets/chunk.js': '',
      'assets/site.js': '',
      'assets/site.css': 'a{src:url(/fonts/gone.woff2)}',
    })

    await expect(loadSiteViewerBundle(fetchFile, '/app/')).rejects.toThrow(
      'Viewer file fonts/gone.woff2: HTTP 404',
    )
  })
})

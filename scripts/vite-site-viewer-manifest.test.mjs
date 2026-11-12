import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  SITE_FONTS_CSS,
  SITE_SYSTEM_FACE,
  SITE_VIEWER_MANIFEST,
  siteFonts,
  siteViewerManifest,
  siteViewerManifestPlugin,
} from './vite-site-viewer-manifest.mjs'

/** Output bundle shaped like Vite's: the site entry shares a chunk with main. */
function bundle() {
  const meta = (css = [], assets = []) => ({
    importedCss: new Set(css),
    importedAssets: new Set(assets),
  })
  return {
    'assets/main.js': {
      type: 'chunk',
      fileName: 'assets/main.js',
      name: 'main',
      isEntry: true,
      imports: ['assets/shared.js'],
      viteMetadata: meta(['assets/main.css']),
    },
    'assets/site.js': {
      type: 'chunk',
      fileName: 'assets/site.js',
      name: 'site',
      isEntry: true,
      imports: ['assets/shared.js', 'assets/view.js'],
      dynamicImports: ['assets/sample.js', 'assets/gl.js'],
      viteMetadata: meta(['assets/site.css']),
    },
    'assets/gl.js': {
      type: 'chunk',
      fileName: 'assets/gl.js',
      name: 'book3dGl',
      isEntry: false,
      imports: ['assets/shared.js', 'assets/glShared.js'],
      dynamicImports: ['assets/three.js'],
      viteMetadata: meta(['assets/glShared.css']),
    },
    'assets/glShared.js': {
      type: 'chunk',
      fileName: 'assets/glShared.js',
      name: 'focusTrap',
      isEntry: false,
      imports: [],
      viteMetadata: meta(),
    },
    'assets/three.js': {
      type: 'chunk',
      fileName: 'assets/three.js',
      name: 'three.module.min',
      isEntry: false,
      imports: [],
      viteMetadata: meta(),
    },
    'assets/view.js': {
      type: 'chunk',
      fileName: 'assets/view.js',
      name: 'view',
      isEntry: false,
      imports: ['assets/shared.js'],
      viteMetadata: meta(['assets/view.css'], ['assets/paper.png']),
    },
    'assets/shared.js': {
      type: 'chunk',
      fileName: 'assets/shared.js',
      name: 'shared',
      isEntry: false,
      imports: [],
      viteMetadata: meta(),
    },
    'assets/sample.js': {
      type: 'chunk',
      fileName: 'assets/sample.js',
      name: 'sampleShell',
      isEntry: false,
      imports: [],
      viteMetadata: meta(),
    },
    'assets/site.css': { type: 'asset', fileName: 'assets/site.css' },
  }
}

const FONTS = {
  css: 'fonts/fonts.css',
  files: ['fonts/a-latin-wght-normal.woff2', 'fonts/b.woff2'],
  preload: ['fonts/a-latin-wght-normal.woff2'],
}

describe('siteFonts', () => {
  it('lists the stylesheet, each face once and the Latin upright faces to preload', () => {
    const css = [
      "src: url('./inter-latin-wght-normal.woff2') format('woff2');",
      'src: url("lora-latin-wght-italic.woff2");',
      'src: url(./inter-cyrillic-wght-normal.woff2);',
      "src: url('./inter-latin-wght-normal.woff2');",
    ].join('\n')

    expect(siteFonts(css)).toEqual({
      css: SITE_FONTS_CSS,
      files: [
        'fonts/inter-cyrillic-wght-normal.woff2',
        'fonts/inter-latin-wght-normal.woff2',
        'fonts/lora-latin-wght-italic.woff2',
      ],
      preload: ['fonts/inter-latin-wght-normal.woff2'],
    })
  })
})

describe('siteViewerManifest', () => {
  it('lists the entry, its static imports, CSS and assets, the lazy GL chunks unlinked; not the sample shell or main', () => {
    expect(siteViewerManifest(bundle(), 'site', FONTS)).toEqual({
      entry: 'assets/site.js',
      css: ['fonts/fonts.css', 'assets/view.css', 'assets/site.css'],
      preload: ['fonts/a-latin-wght-normal.woff2', SITE_SYSTEM_FACE],
      files: [
        'assets/gl.js',
        'assets/glShared.css',
        'assets/glShared.js',
        'assets/paper.png',
        'assets/shared.js',
        'assets/site.css',
        'assets/site.js',
        'assets/three.js',
        'assets/view.css',
        'assets/view.js',
        'fonts/a-latin-wght-normal.woff2',
        'fonts/b.woff2',
        'fonts/fonts.css',
        'fonts/inter-latin-opsz-normal.woff2',
      ],
    })
  })

  it('throws when the entry is not in the bundle', () => {
    expect(() => siteViewerManifest(bundle(), 'viewer', FONTS)).toThrow(
      'No "viewer" entry chunk in the bundle',
    )
  })
})

describe('siteViewerManifestPlugin', () => {
  it('emits the manifest with the public UI fonts as a build asset', async () => {
    const plugin = siteViewerManifestPlugin('site')
    const emitFile = vi.fn()

    plugin.configResolved({ publicDir: 'public' })
    await plugin.generateBundle.call({ emitFile }, {}, bundle())

    expect(plugin.apply).toBe('build')
    const fonts = siteFonts(await readFile('public/fonts/fonts.css', 'utf8'))
    expect(fonts.files).toHaveLength(9)
    expect(fonts.preload).toEqual([
      'fonts/inter-latin-wght-normal.woff2',
      'fonts/lora-latin-wght-normal.woff2',
    ])
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: SITE_VIEWER_MANIFEST,
      source: `${JSON.stringify(siteViewerManifest(bundle(), 'site', fonts))}\n`,
    })
  })
})

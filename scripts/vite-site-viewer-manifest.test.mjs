import { describe, expect, it, vi } from 'vitest'
import {
  SITE_VIEWER_MANIFEST,
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
      dynamicImports: ['assets/sample.js'],
      viteMetadata: meta(['assets/site.css']),
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
      name: 'sample',
      isEntry: false,
      imports: [],
      viteMetadata: meta(),
    },
    'assets/site.css': { type: 'asset', fileName: 'assets/site.css' },
  }
}

describe('siteViewerManifest', () => {
  it('lists the entry, its static imports, CSS and assets, not dynamic imports or main', () => {
    expect(siteViewerManifest(bundle(), 'site')).toEqual({
      entry: 'assets/site.js',
      css: ['assets/view.css', 'assets/site.css'],
      files: [
        'assets/paper.png',
        'assets/shared.js',
        'assets/site.css',
        'assets/site.js',
        'assets/view.css',
        'assets/view.js',
      ],
    })
  })

  it('throws when the entry is not in the bundle', () => {
    expect(() => siteViewerManifest(bundle(), 'viewer')).toThrow(
      'No "viewer" entry chunk in the bundle',
    )
  })
})

describe('siteViewerManifestPlugin', () => {
  it('emits the manifest as a build asset', () => {
    const plugin = siteViewerManifestPlugin('site')
    const emitFile = vi.fn()

    plugin.generateBundle.call({ emitFile }, {}, bundle())

    expect(plugin.apply).toBe('build')
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: SITE_VIEWER_MANIFEST,
      source: `${JSON.stringify(siteViewerManifest(bundle(), 'site'))}\n`,
    })
  })
})

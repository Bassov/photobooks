/**
 * Emit `site-viewer.json`: the built site viewer (the `site` entry chunk,
 * its static imports, CSS and assets) so Export site can copy it into
 * `dist/viewer/` without guessing hashed file names.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const SITE_VIEWER_MANIFEST = 'site-viewer.json'

/**
 * @typedef {{
 *   type: 'chunk' | 'asset'
 *   fileName: string
 *   name?: string
 *   isEntry?: boolean
 *   imports?: readonly string[]
 *   viteMetadata?: { importedCss: Set<string>, importedAssets: Set<string> }
 * }} BundleItem
 */

/** The UI fonts stylesheet in `public/`; its faces sit next to it. */
export const SITE_FONTS_CSS = 'fonts/fonts.css'

/** Faces every page preloads (as `site.html` does): Latin upright. */
const PRELOAD_FACE = /-latin-wght-normal\.woff2$/

/** `url('./x')` / `url(x)` in the fonts stylesheet. */
const FONT_URL = /url\((['"]?)(?:\.\/)?([^'")/]+)\1\)/g

/**
 * @typedef {{ css: string, files: string[], preload: string[] }} SiteFonts
 */

/**
 * UI fonts of the exported site from the text of `fonts/fonts.css`: the
 * stylesheet plus the faces it points at, and the faces to preload.
 * @param {string} css
 * @returns {SiteFonts}
 */
export function siteFonts(css) {
  const dir = SITE_FONTS_CSS.slice(0, SITE_FONTS_CSS.lastIndexOf('/') + 1)
  const files = [
    ...new Set([...css.matchAll(FONT_URL)].map((match) => `${dir}${match[2]}`)),
  ].sort()
  return {
    css: SITE_FONTS_CSS,
    files,
    preload: files.filter((file) => PRELOAD_FACE.test(file)),
  }
}

/**
 * Viewer manifest from an output bundle: `entry` and `css` are among
 * `files`; files are sorted; dynamic imports are left out (the exported
 * pages carry their data, so the sample shell and perf hooks never load).
 * The fonts stylesheet links first; its faces are copied as they are.
 * @param {Record<string, BundleItem>} bundle
 * @param {string} entryName
 * @param {SiteFonts} fonts
 * @returns {{ entry: string, css: string[], preload: string[], files: string[] }}
 */
export function siteViewerManifest(bundle, entryName, fonts) {
  const entry = Object.values(bundle).find(
    (item) => item.type === 'chunk' && item.isEntry && item.name === entryName,
  )
  if (entry === undefined) {
    throw new Error(`No "${entryName}" entry chunk in the bundle`)
  }
  /** @type {Set<string>} */
  const files = new Set()
  /** @type {string[]} */
  const css = []
  /** @param {string} fileName */
  const visit = (fileName) => {
    if (files.has(fileName)) return
    files.add(fileName)
    const chunk = bundle[fileName]
    for (const imported of chunk?.imports ?? []) visit(imported)
    for (const sheet of chunk?.viteMetadata?.importedCss ?? []) {
      if (!css.includes(sheet)) css.push(sheet)
      files.add(sheet)
    }
    for (const asset of chunk?.viteMetadata?.importedAssets ?? []) {
      files.add(asset)
    }
  }
  visit(entry.fileName)
  for (const file of [fonts.css, ...fonts.files]) files.add(file)
  return {
    entry: entry.fileName,
    css: [fonts.css, ...css],
    preload: fonts.preload,
    files: [...files].sort(),
  }
}

/**
 * @param {string} entryName rollup input name of the site viewer
 * @returns {import('vite').Plugin}
 */
export function siteViewerManifestPlugin(entryName) {
  let publicDir = ''
  return {
    name: 'photobooks-site-viewer-manifest',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir
    },
    async generateBundle(_options, bundle) {
      const fonts = siteFonts(
        await readFile(join(publicDir, SITE_FONTS_CSS), 'utf8'),
      )
      this.emitFile({
        type: 'asset',
        fileName: SITE_VIEWER_MANIFEST,
        source: `${JSON.stringify(siteViewerManifest(/** @type {Record<string, BundleItem>} */ (/** @type {unknown} */ (bundle)), entryName, fonts))}\n`,
      })
    },
  }
}

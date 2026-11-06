/**
 * Emit `site-viewer.json`: the built site viewer (the `site` entry chunk,
 * its static imports, CSS and assets) so Export site can copy it into
 * `dist/viewer/` without guessing hashed file names.
 */

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

/**
 * Viewer manifest from an output bundle: `entry` and `css` are among
 * `files`; files are sorted; dynamic imports are left out (the exported
 * pages carry their data, so the sample shell and perf hooks never load).
 * @param {Record<string, BundleItem>} bundle
 * @param {string} entryName
 * @returns {{ entry: string, css: string[], files: string[] }}
 */
export function siteViewerManifest(bundle, entryName) {
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
  return { entry: entry.fileName, css, files: [...files].sort() }
}

/**
 * @param {string} entryName rollup input name of the site viewer
 * @returns {import('vite').Plugin}
 */
export function siteViewerManifestPlugin(entryName) {
  return {
    name: 'photobooks-site-viewer-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: SITE_VIEWER_MANIFEST,
        source: `${JSON.stringify(siteViewerManifest(/** @type {Record<string, BundleItem>} */ (/** @type {unknown} */ (bundle)), entryName))}\n`,
      })
    },
  }
}

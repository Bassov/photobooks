import type { SiteFile, SiteViewerBundle } from '../../site/export/types'

/** Written by the build next to `site.html` (`scripts/vite-site-viewer-manifest.mjs`). */
export const SITE_VIEWER_MANIFEST = 'site-viewer.json'

interface SiteViewerManifest {
  entry: string
  css: string[]
  preload: string[]
  files: string[]
}

type FetchFile = (url: string) => Promise<Response>

/** `url(/x)`, `url('/x')`, `url("/x")`; protocol-relative `//x` is left alone. */
const ROOT_URL = /url\((['"]?)\/(?!\/)([^'")]+)\1\)/g

const decoder = new TextDecoder()
const encoder = new TextEncoder()

/**
 * Root-absolute `url(/x)` in a stylesheet at `path` → the same file under
 * `viewer/`: rewritten relative to `path`, `x` returned to be copied too.
 */
export function relativeCssUrls(
  path: string,
  css: string,
): { css: string; refs: string[] } {
  const up = '../'.repeat(path.split('/').length - 1)
  const refs: string[] = []
  const rewritten = css.replace(
    ROOT_URL,
    (_match, quote: string, ref: string) => {
      refs.push(ref)
      return `url(${quote}${up}${ref}${quote})`
    },
  )
  return { css: rewritten, refs }
}

/**
 * The built site viewer as listed by `site-viewer.json` under `base`, with
 * the files its CSS points at. Any missing file rejects: an export without
 * a working viewer is a failed export.
 */
export async function loadSiteViewerBundle(
  fetchFile: FetchFile,
  base: string,
): Promise<SiteViewerBundle> {
  const fetchOk = async (path: string): Promise<Response> => {
    const response = await fetchFile(`${base}${path}`)
    if (!response.ok) {
      throw new Error(`Viewer file ${path}: HTTP ${String(response.status)}`)
    }
    return response
  }
  const fetchBytes = async (path: string): Promise<Uint8Array> =>
    new Uint8Array(await (await fetchOk(path)).arrayBuffer())

  const manifest = (await (
    await fetchOk(SITE_VIEWER_MANIFEST)
  ).json()) as SiteViewerManifest
  const css = new Set(manifest.css)
  const refs = new Set<string>()
  const built = await Promise.all(
    manifest.files.map(async (path): Promise<SiteFile> => {
      const bytes = await fetchBytes(path)
      if (!css.has(path)) {
        return { path, bytes }
      }
      const rewritten = relativeCssUrls(path, decoder.decode(bytes))
      for (const ref of rewritten.refs) refs.add(ref)
      return { path, bytes: encoder.encode(rewritten.css) }
    }),
  )
  const listed = new Set(manifest.files)
  const referenced = await Promise.all(
    [...refs]
      .filter((path) => !listed.has(path))
      .sort()
      .map(async (path) => ({ path, bytes: await fetchBytes(path) })),
  )
  return {
    entry: manifest.entry,
    css: manifest.css,
    preload: manifest.preload,
    files: [...built, ...referenced],
  }
}

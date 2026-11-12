import { hydrateRoot } from 'react-dom/client'
import type { LoadBook } from './loadBook'
import { SiteApp } from './SiteApp'
import type { SitePageInput } from './siteInput'

/** The sample site (`site.html?book=<id>`): its book inputs are built here. */
const sampleLoad =
  (doc: Document): LoadBook =>
  async (href) => {
    const { sampleSiteInput } = await import('./sampleSite')
    const base = doc.defaultView?.location.href ?? doc.baseURI
    const input = sampleSiteInput(new URL(href, base).search)
    if (input.kind !== 'book') throw new Error(`no sample book: ${href}`)
    return input
  }

function readSiteData(doc: Document): SitePageInput | null {
  const text = doc.getElementById('site-data')?.textContent ?? ''
  return text === '' ? null : (JSON.parse(text) as SitePageInput)
}

/**
 * Hydrates the prerendered page in `#site-root` from `#site-data`; a page
 * without data (`site.html` alone) prerenders the sample site first.
 * `?perf=1` loads the perf hooks (LoAF / frame pacing) before hydrating.
 */
export async function startSite(doc: Document, search: string): Promise<void> {
  if (new URLSearchParams(search).get('perf') === '1') {
    const { enablePerfHooks } = await import('../perf/exposePerf')
    enablePerfHooks()
  }
  const root = doc.getElementById('site-root')
  if (root === null) return
  let load: LoadBook | undefined
  if (readSiteData(doc) === null) {
    const { prerenderSample } = await import('./sampleShell')
    prerenderSample(doc, search)
    load = sampleLoad(doc)
  }
  const input = readSiteData(doc)
  if (input !== null) {
    hydrateRoot(root, <SiteApp input={input} load={load} />)
  }
}

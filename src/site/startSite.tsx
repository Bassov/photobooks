import { hydrateRoot } from 'react-dom/client'
import { SiteApp } from './SiteApp'
import type { SitePageInput } from './siteInput'

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
  if (readSiteData(doc) === null) {
    const { prerenderSample } = await import('./sampleShell')
    prerenderSample(doc, search)
  }
  const input = readSiteData(doc)
  if (input !== null) {
    hydrateRoot(root, <SiteApp input={input} />)
  }
}

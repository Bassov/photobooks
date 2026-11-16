import { renderSitePage } from './renderSitePage'
import { sampleSiteInput } from './sampleSite'
import { keptQuery } from './siteUrl'

/** The only query keys the sample page reads. */
const SAMPLE_KEYS = ['book', 'empty'] as const

/**
 * Puts the prerendered sample page into this document, exactly as an exported
 * page would carry it: `#site-root` markup plus `#site-data` (lazy chunk, so
 * `react-dom/server` never loads on an exported page).
 */
export function prerenderSample(doc: Document, search: string): void {
  const page = new DOMParser().parseFromString(
    renderSitePage(sampleSiteInput(keptQuery(search, SAMPLE_KEYS)), {
      css: [],
    }),
    'text/html',
  )
  const root = doc.getElementById('site-root')
  const markup = page.getElementById('site-root')
  const data = page.getElementById('site-data')
  if (root === null || markup === null || data === null) return
  root.replaceChildren(...markup.childNodes)
  doc.body.append(data)
  doc.title = page.title
  doc
    .querySelector('meta[name="theme-color"]')
    ?.replaceWith(...page.querySelectorAll('meta[name="theme-color"]'))
}

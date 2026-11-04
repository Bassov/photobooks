import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { displayBookTitle } from '../project/bookTitle'
import { SiteApp } from './SiteApp'
import type { SitePageAssets, SitePageInput } from './siteInput'
import { bookMeta, catalogMeta, sitePageCount, siteTitle } from './siteModel'
import { sitePageUrl } from './siteUrl'

/** Same value with object keys in code-unit order at every depth. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    )
  }
  return value
}

/** `#site-data` text: sorted keys, `<` escaped so it never closes the script. */
export function siteDataJson(input: SitePageInput): string {
  return JSON.stringify(sortKeys(input)).replace(/</g, '\\u003c')
}

function pageHead(input: SitePageInput): {
  title: string
  ogTitle: string
  description: string
} {
  const site = siteTitle(input.site.title)
  if (input.kind === 'catalog') {
    return {
      title: site,
      ogTitle: site,
      description: catalogMeta(input.site.author, input.books.length),
    }
  }
  const book = displayBookTitle(input.book.title)
  return {
    title: `${book} · ${site}`,
    ogTitle: book,
    description: bookMeta(
      input.site.author,
      sitePageCount(input.book.spreads.length),
    ),
  }
}

/**
 * One complete, deterministic site page: head, viewer assets, the
 * prerendered `SiteApp` markup the entry hydrates, then `#site-data`.
 */
export function renderSitePage(
  input: SitePageInput,
  assets: SitePageAssets,
): string {
  const head = pageHead(input)
  const pageUrl = sitePageUrl(input.site.url, input.path)
  const ogImage =
    input.ogImage === undefined
      ? undefined
      : pageUrl === undefined
        ? input.ogImage
        : new URL(input.ogImage, pageUrl).href
  const app = renderToString(<SiteApp input={input} />)
  const document = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#E1E1E1" />
        <title>{head.title}</title>
        <meta name="description" content={head.description} />
        <meta property="og:title" content={head.ogTitle} />
        <meta
          property="og:type"
          content={input.kind === 'catalog' ? 'website' : 'book'}
        />
        {ogImage === undefined ? null : (
          <meta property="og:image" content={ogImage} />
        )}
        {pageUrl === undefined ? null : <link rel="canonical" href={pageUrl} />}
        {assets.css.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {assets.js === undefined ? null : (
          <script type="module" src={assets.js} />
        )}
      </head>
      <body>
        <div
          id="site-root"
          className="site"
          dangerouslySetInnerHTML={{ __html: app }}
        />
        <script
          type="application/json"
          id="site-data"
          dangerouslySetInnerHTML={{ __html: siteDataJson(input) }}
        />
      </body>
    </html>,
  )
  return `<!doctype html>${document}`
}

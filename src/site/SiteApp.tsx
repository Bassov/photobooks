import { useRef } from 'react'
import { SiteBookPage } from './SiteBookPage'
import { SiteCatalog } from './SiteCatalog'
import type { SitePageInput } from './siteInput'
import { siteTitle } from './siteModel'
import { pageHref } from './siteUrl'
import { useViewport } from './useViewport'

/** One site page: the tree `renderSitePage` prerenders and `main.tsx` hydrates. */
export function SiteApp({ input }: { input: SitePageInput }) {
  const root = useRef<HTMLDivElement>(null)
  const viewport = useViewport(root)
  const title = siteTitle(input.site.title)
  return (
    <div ref={root} className="site-app" data-testid="site">
      <header className="site-header">
        {input.kind === 'catalog' ? (
          <span className="site-title" aria-current="page">
            {title}
          </span>
        ) : (
          <a
            className="site-title"
            href={pageHref(input.catalogHref)}
            data-testid="site-title-link"
          >
            {title}
          </a>
        )}
      </header>
      {input.kind === 'catalog' ? (
        <SiteCatalog input={input} viewport={viewport} />
      ) : (
        <SiteBookPage input={input} viewport={viewport} />
      )}
    </div>
  )
}

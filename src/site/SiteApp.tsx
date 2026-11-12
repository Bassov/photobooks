import { useRef } from 'react'
import { SiteBookPage } from './SiteBookPage'
import { SiteHome } from './SiteHome'
import type { SitePageInput } from './siteInput'
import { siteTitle } from './siteModel'
import { pageHref } from './siteUrl'
import { useViewport } from './useViewport'

/** One site page: the tree `renderSitePage` prerenders and `main.tsx` hydrates. */
export function SiteApp({ input }: { input: SitePageInput }) {
  return input.kind === 'catalog' ? (
    <SiteHome input={input} />
  ) : (
    <SiteBook input={input} />
  )
}

function SiteBook({
  input,
}: {
  input: Extract<SitePageInput, { kind: 'book' }>
}) {
  const root = useRef<HTMLDivElement>(null)
  const viewport = useViewport(root)
  return (
    <div ref={root} className="site-app" data-testid="site">
      <header className="site-header">
        <a
          className="site-title"
          href={pageHref(input.catalogHref)}
          data-testid="site-title-link"
        >
          {siteTitle(input.site.title)}
        </a>
      </header>
      <SiteBookPage input={input} viewport={viewport} />
    </div>
  )
}

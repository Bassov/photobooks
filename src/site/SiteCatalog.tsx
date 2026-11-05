import { pagesText } from '../core/pages'
import { BookObject } from '../render/BookObject'
import type { SitePageInput } from './siteInput'
import { bookObjectHeight, catalogColumnWidth, catalogMeta } from './siteModel'
import { pageHref } from './siteUrl'
import type { Viewport } from './useViewport'

type CatalogInput = Extract<SitePageInput, { kind: 'catalog' }>

/** Column width the server renders at (any viewport ≥ 1004 px). */
const SERVER_VW = 1440

export function SiteCatalog({
  input,
  viewport,
}: {
  input: CatalogInput
  viewport: Viewport | null
}) {
  const { books, site } = input
  const col = catalogColumnWidth(viewport?.vw ?? SERVER_VW)
  return (
    <main className="site-catalog" data-testid="site-catalog">
      <h1 className="site-h1">Books</h1>
      <p className="site-catalog-meta">
        {catalogMeta(site.author, books.length)}
      </p>
      {books.length === 0 ? null : (
        <div className="site-grid">
          {books.map((book) => (
            <a
              key={book.id}
              className="site-card"
              href={pageHref(book.href)}
              data-testid="site-book"
              data-book={book.id}
            >
              <div className="site-card-obj">
                <BookObject
                  {...(book.cover === null ? {} : { src: book.cover.src })}
                  title={book.title}
                  fmt={book.fmt}
                  h={bookObjectHeight(col, book.fmt)}
                  ink={book.ink}
                  place={book.place}
                />
              </div>
              <div className="site-card-text">
                <div className="site-card-name">{book.title}</div>
                <div className="site-card-meta">{pagesText(book.pages)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}

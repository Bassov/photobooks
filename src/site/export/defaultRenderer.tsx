import type { ReactElement, ReactNode } from 'react'
import type { SiteImage, SiteImageSource, SitePageRenderer } from './types'

/** Default `<img>` size until `site-viewer` picks per viewport. */
const DEFAULT_PRESET_ID = 'site-display'

function defaultSource(image: SiteImage): SiteImageSource {
  return (
    image.sources.find((source) => source.presetId === DEFAULT_PRESET_ID) ??
    image.sources[0]
  )
}

function pageShell(
  title: string,
  viewerSrc: string | undefined,
  body: ReactNode,
): ReactElement {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </head>
      <body>
        {body}
        {viewerSrc === undefined ? null : (
          <script type="module" src={viewerSrc} />
        )}
      </body>
    </html>
  )
}

/** Minimal pages (title + spread images in order); `site-viewer` replaces it. */
export const defaultRenderer: SitePageRenderer = {
  index: (page) =>
    pageShell(
      'Photobooks',
      page.viewerSrc,
      <ul>
        {page.books.map((book) => (
          <li key={book.bookId}>
            <a href={book.href}>{book.title}</a>
          </li>
        ))}
      </ul>,
    ),
  book: (page) =>
    pageShell(
      page.title,
      page.viewerSrc,
      <>
        <h1>{page.title}</h1>
        {page.spreads.map((spread) => (
          <section key={spread.spreadId}>
            {spread.images.map((image, index) => {
              const source = defaultSource(image)
              return (
                <img
                  key={index}
                  src={source.src}
                  width={source.width}
                  height={source.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )
            })}
          </section>
        ))}
      </>,
    ),
}

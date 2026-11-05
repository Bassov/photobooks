import { useEffect, useLayoutEffect, useState } from 'react'
import { pagesOf } from '../core/pages'
import { displayBookTitle } from '../project/bookTitle'
import { Icon } from '../ui/Icon'
import { ShareButton } from './ShareButton'
import type { SitePageInput } from './siteInput'
import { SiteLightbox } from './SiteLightbox'
import {
  bookMeta,
  hashForSlide,
  slideForHash,
  slideLabel,
  spreadRatio,
  stageWidth,
} from './siteModel'
import { SiteStage, type RenderSlide } from './SiteStage'
import { pageHref, sitePageUrl } from './siteUrl'
import type { Viewport } from './useViewport'

type BookInput = Extract<SitePageInput, { kind: 'book' }>

/**
 * Canonical book URL: the site URL when set, else this page without its hash
 * (the query stays: the sample site picks its book with `?book=`).
 */
function bookUrl(input: BookInput): string {
  const url = sitePageUrl(input.site.url, input.path)
  if (url !== undefined) return url
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea') !== null
}

/** A host-controlled slide (editor preview): the page touches no URL or keys. */
export interface Embedded {
  slide: number
  onSlide: (slide: number) => void
}

/**
 * Book page. Embedded (`embedded`), the host owns the slide, the URL and the
 * keyboard; `allBooks` / `share` false drop the catalog link / Share;
 * `renderSlide` paints the slides on the stage and in the lightbox.
 */
export function SiteBookPage({
  input,
  viewport,
  embedded,
  allBooks = true,
  share = true,
  renderSlide,
}: {
  input: BookInput
  viewport: Viewport | null
  embedded?: Embedded | undefined
  allBooks?: boolean
  share?: boolean
  renderSlide?: RenderSlide | undefined
}) {
  const { book, images, site } = input
  const n = book.spreads.length
  const title = displayBookTitle(book.title)
  const [ownSlide, setOwnSlide] = useState(0)
  const slide = embedded === undefined ? ownSlide : embedded.slide
  const isEmbedded = embedded !== undefined
  /** The lightbox's opening slide while it is open. */
  const [lightbox, setLightbox] = useState<number | null>(null)
  const open = () => {
    setLightbox(slide)
  }

  const show = (next: number) => {
    const s = Math.max(0, Math.min(n, next))
    if (s === slide) return
    if (embedded !== undefined) {
      embedded.onSlide(s)
      return
    }
    setOwnSlide(s)
    const hash = hashForSlide(s, n)
    const { pathname, search } = window.location
    window.history.replaceState(
      window.history.state,
      '',
      hash === '' ? `${pathname}${search}` : hash,
    )
  }

  // The server renders the cover; the hash picks the slide once hydrated.
  useLayoutEffect(() => {
    if (isEmbedded) return
    const read = () => {
      setOwnSlide(slideForHash(window.location.hash, n))
    }
    read()
    window.addEventListener('hashchange', read)
    return () => {
      window.removeEventListener('hashchange', read)
    }
  }, [n, isEmbedded])

  useEffect(() => {
    if (isEmbedded) return
    const onKey = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTyping(event.target)
      ) {
        return
      }
      const next = {
        ArrowLeft: slide - 1,
        ArrowRight: slide + 1,
        Home: 0,
        End: n,
      }[event.key]
      if (next === undefined) return
      event.preventDefault()
      show(next)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  })

  const width =
    viewport === null
      ? undefined
      : stageWidth({
          vw: viewport.vw,
          vh: viewport.vh,
          ratio: spreadRatio(book.settings.trim),
          allBooks,
        })

  return (
    <main className="site-book" data-testid="site-book-page">
      <div className="site-title-row">
        <div className="site-title-block">
          {allBooks && (
            <a
              className="site-all-books"
              href={pageHref(input.catalogHref)}
              data-testid="site-all-books"
            >
              <Icon name="arrowLeft" />
              All books
            </a>
          )}
          <h1 className="site-h1" data-testid="site-title">
            {title}
          </h1>
          <div className="site-book-meta" data-testid="site-author">
            {bookMeta(site.author, pagesOf(n))}
          </div>
        </div>
        <div className="site-actions">
          {share && <ShareButton title={title} url={() => bookUrl(input)} />}
          <button
            type="button"
            className="site-action"
            data-testid="site-fullscreen-btn"
            onClick={open}
          >
            <Icon name="maximize2" />
            Fullscreen
          </button>
        </div>
      </div>
      <SiteStage
        book={book}
        images={images}
        slide={slide}
        width={width}
        onStep={(delta) => {
          show(slide + delta)
        }}
        onOpen={open}
        renderSlide={renderSlide}
      />
      {lightbox !== null && (
        <SiteLightbox
          book={book}
          images={images}
          title={title}
          start={lightbox}
          renderSlide={renderSlide}
          onClose={(s) => {
            setLightbox(null)
            show(s)
          }}
        />
      )}
      <div className="site-pager" data-testid="site-pager">
        <button
          type="button"
          className="site-pager-btn"
          aria-label="Previous spread"
          disabled={slide === 0}
          onClick={() => {
            show(slide - 1)
          }}
        >
          <Icon name="chevronLeft" />
        </button>
        <span
          className="site-indicator"
          aria-live="polite"
          data-testid="site-page-indicator"
        >
          {slideLabel(slide, n)}
        </span>
        <button
          type="button"
          className="site-pager-btn"
          aria-label="Next spread"
          disabled={slide === n}
          onClick={() => {
            show(slide + 1)
          }}
        >
          <Icon name="chevronRight" />
        </button>
      </div>
    </main>
  )
}

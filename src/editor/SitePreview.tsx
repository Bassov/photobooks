import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { Book } from '../core'
import { pagesOf } from '../core/pages'
import { displayBookTitle } from '../project/bookTitle'
import { bookFormatFromTrim } from '../render/bookObjectLayout'
import { CoverView } from '../render/CoverView'
import { siteBookFacts } from '../site/siteModel'
import { SiteRoom, type BookInput } from '../site/SiteRoom'
import '../site/siteSystem.css'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { SitePreviewFrame } from './SitePreviewBar'
import { useTierPreviewUrl } from './useTierPreviewUrl'

const readBook = (): Book => getBookStoreSnapshot().book

/** the room's cover title ink (no published cover photo in the preview) */
const INK = '#F5F5F5'
/** the year the room's meta shows: nothing is published yet */
const OPENED_AT = Date.now()

function PreviewCover({ book, widthPx }: { book: Book; widthPx: number }) {
  const { url, tier } = useTierPreviewUrl(
    book.cover.front.assetId,
    'cover:preview',
  )
  return (
    <CoverView book={book} frontUrl={url} frontTier={tier} widthPx={widthPx} />
  )
}

/**
 * One preview slide of the live editor book with the editor's renderers (no
 * site derivatives): the cover, then spreads without the editor layer.
 */
export function PreviewSlide({
  book,
  slide,
  widthPx,
}: {
  book: Book
  slide: number
  widthPx: number
}) {
  if (slide === 0) return <PreviewCover book={book} widthPx={widthPx} />
  const id = book.spreads[slide - 1]?.id
  return id === undefined ? null : (
    <ConnectedSpreadView
      spreadId={id}
      editorLayer={false}
      lowDpiBadge={false}
      pxPerMm={widthPx / (2 * book.settings.trim.widthMm)}
    />
  )
}

/**
 * Preview site: the site's book page of the current book (nothing published)
 * in the preview frame's scroll box, sized by that box. Opens on the cover.
 */
export default function SitePreview({ onExit }: { onExit: () => void }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const n = book.spreads.length
  const [ownSlide, setSlide] = useState(0)
  const slide = Math.min(ownSlide, n + 1)

  const input = useMemo(
    (): BookInput => ({
      kind: 'book',
      site: { title: '' },
      path: '',
      catalogHref: '',
      book,
      images: {},
      entry: {
        id: book.id,
        href: '',
        title: displayBookTitle(book.title),
        pages: pagesOf(n),
        fmt: bookFormatFromTrim(
          book.settings.trim.widthMm,
          book.settings.trim.heightMm,
        ),
        cover: null,
        ink: INK,
        place: 'top',
        ...siteBookFacts(book, OPENED_AT),
      },
    }),
    [book, n],
  )
  const renderSlide = useCallback(
    (s: number, widthPx: number) => (
      <PreviewSlide book={book} slide={s} widthPx={widthPx} />
    ),
    [book],
  )
  const embedded = useMemo(() => ({ slide, onSlide: setSlide }), [slide])

  return (
    // the room's views: the cover, the spreads, the back cover
    <SitePreviewFrame
      onExit={onExit}
      slide={slide}
      n={n + 1}
      onSlide={setSlide}
    >
      <div
        className="site relative min-h-0 flex-1 overflow-hidden"
        // Beats the unlayered `.site { min-height: 100dvh }`.
        style={{ minHeight: 0 }}
        data-testid="site-preview-scroll"
      >
        <SiteRoom
          input={input}
          embedded={embedded}
          allBooks={false}
          share={false}
          renderSlide={renderSlide}
        />
      </div>
    </SitePreviewFrame>
  )
}

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Book } from '../core'
import { CoverView } from '../render/CoverView'
import { SiteBookPage } from '../site/SiteBookPage'
import type { SitePageInput } from '../site/siteInput'
import { siteTitle } from '../site/siteModel'
import { useViewport } from '../site/useViewport'
import '../site/siteViewer.css'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { SitePreviewFrame } from './SitePreviewBar'
import { useTierPreviewUrl } from './useTierPreviewUrl'

const readBook = (): Book => getBookStoreSnapshot().book

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const n = book.spreads.length
  const [ownSlide, setSlide] = useState(0)
  const slide = Math.min(ownSlide, n)
  const viewport = useViewport(scrollRef, { height: 'element' })

  const input = useMemo(
    (): Extract<SitePageInput, { kind: 'book' }> => ({
      kind: 'book',
      site: { title: '' },
      path: '',
      catalogHref: '',
      book,
      images: {},
    }),
    [book],
  )
  const renderSlide = useCallback(
    (s: number, widthPx: number) => (
      <PreviewSlide book={book} slide={s} widthPx={widthPx} />
    ),
    [book],
  )
  const embedded = useMemo(() => ({ slide, onSlide: setSlide }), [slide])

  return (
    <SitePreviewFrame onExit={onExit} slide={slide} n={n} onSlide={setSlide}>
      <div
        ref={scrollRef}
        className="site min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
        // Beats the unlayered `.site { min-height: 100dvh }`.
        style={{ minHeight: 0 }}
        data-testid="site-preview-scroll"
      >
        <header className="site-header">
          <span className="site-title">{siteTitle('')}</span>
        </header>
        <SiteBookPage
          input={input}
          viewport={viewport}
          embedded={embedded}
          allBooks={false}
          share={false}
          renderSlide={renderSlide}
        />
      </div>
    </SitePreviewFrame>
  )
}

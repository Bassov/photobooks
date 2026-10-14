import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from 'react'
import { GridList } from 'react-aria-components'
import { setVisibleAssetIds } from '../photo/assetPool'
import {
  getGalleryAspectsSnapshot,
  getGalleryIdsSnapshot,
  getSpacerCountSnapshot,
  subscribeBookStore,
  subscribeGallery,
} from './bookStore'
import { FilmstripItemView } from './FilmstripItem'
import { FilmstripStatus } from './FilmstripStatus'
import type { ImportProgress } from './importPhotos'
import {
  buildStridePrefix,
  indexFromScrollOffset,
  spacerWidthPx,
  THUMB_GAP,
  THUMB_HEIGHT,
} from './thumbSlotSize'
import './Filmstrip.css'

const WINDOW_SIZE = 48
const REVEAL_PER_FRAME = 1

export const Filmstrip = memo(function Filmstrip({
  progress = null,
}: {
  progress?: ImportProgress | null
}) {
  const gallery = useSyncExternalStore(
    subscribeGallery,
    getGalleryIdsSnapshot,
    getGalleryIdsSnapshot,
  )
  const spacerCount = useSyncExternalStore(
    subscribeGallery,
    getSpacerCountSnapshot,
    getSpacerCountSnapshot,
  )
  const aspects = useSyncExternalStore(
    subscribeBookStore,
    getGalleryAspectsSnapshot,
    getGalleryAspectsSnapshot,
  )
  const [windowStart, setWindowStart] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const scrollRaf = useRef(0)
  const pendingStart = useRef(0)
  const total = gallery.length

  const prefix = useMemo(() => buildStridePrefix(aspects), [aspects])
  const spacerWidth = useMemo(
    () => spacerWidthPx(aspects, spacerCount),
    [aspects, spacerCount],
  )

  useEffect(() => {
    if (revealed >= total) {
      return
    }
    const id = requestAnimationFrame(() => {
      setRevealed((current) => Math.min(total, current + REVEAL_PER_FRAME))
    })
    return () => {
      cancelAnimationFrame(id)
    }
  }, [revealed, total])

  useEffect(() => {
    if (total === 0) {
      setRevealed(0)
    }
  }, [total])

  const start = Math.min(windowStart, Math.max(0, revealed - 1))
  const windowKey = gallery
    .slice(0, revealed)
    .slice(start, start + WINDOW_SIZE)
    .join('\0')

  const items = useMemo(() => {
    if (!windowKey) {
      return [] as { id: string; name: string }[]
    }
    return windowKey
      .split('\0')
      .map((assetId) => ({ id: assetId, name: assetId }))
  }, [windowKey])

  useEffect(() => {
    setVisibleAssetIds(items.map((item) => item.id))
  }, [items])

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    const scrollLeft = event.currentTarget.scrollLeft
    pendingStart.current = indexFromScrollOffset(scrollLeft, prefix)
    if (scrollRaf.current !== 0) {
      return
    }
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      setWindowStart((current) =>
        current === pendingStart.current ? current : pendingStart.current,
      )
    })
  }

  const windowOffset = prefix[start] ?? 0

  return (
    <section
      className="filmstrip"
      data-testid="filmstrip"
      data-gallery-count={total}
      aria-label="Gallery"
    >
      <FilmstripStatus photoCount={total} progress={progress} />
      <div
        className="filmstrip-scroll"
        data-testid="filmstrip-scroll"
        onScroll={onScroll}
      >
        <div className="filmstrip-spacer" style={{ width: spacerWidth }}>
          <div
            className="filmstrip-window"
            style={{
              transform: `translateX(${String(windowOffset)}px)`,
            }}
          >
            <GridList
              aria-label="Book gallery"
              orientation="horizontal"
              items={items}
              className="filmstrip-list"
              style={{ height: THUMB_HEIGHT + 24, gap: THUMB_GAP }}
              renderEmptyState={() => (
                <p className="filmstrip-empty" data-testid="filmstrip-empty">
                  Add a folder or photos to build the gallery.
                </p>
              )}
            >
              {(item) => <FilmstripItemView id={item.id} name={item.name} />}
            </GridList>
          </div>
        </div>
      </div>
    </section>
  )
})

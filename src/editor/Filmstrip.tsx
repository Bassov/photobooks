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
import {
  getSelectedAssetId,
  setSelectedAssetId,
  subscribeGallerySelection,
} from './gallerySelection'
import { FilmstripStatus } from './FilmstripStatus'
import type { ImportProgress } from './importPhotos'
import {
  buildStridePrefix,
  indexFromScrollOffset,
  spacerWidthPx,
  THUMB_HEIGHT,
  THUMB_WIDTH_MAX,
  windowCountForCover,
} from './thumbSlotSize'
import './Filmstrip.css'

/** Extra cover beyond the scrollport so fast scroll does not flash holes. */
const WINDOW_OVERSCAN_PX = THUMB_WIDTH_MAX * 2

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
  const [viewportWidth, setViewportWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRaf = useRef(0)
  const pendingStart = useRef(0)
  const total = gallery.length

  const prefix = useMemo(() => buildStridePrefix(aspects), [aspects])
  const spacerWidth = useMemo(
    () => spacerWidthPx(aspects, spacerCount),
    [aspects, spacerCount],
  )

  useEffect(() => {
    const node = scrollRef.current
    if (!node) {
      return
    }
    const update = (): void => {
      setViewportWidth(node.clientWidth)
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  const coverPx = Math.max(viewportWidth, 1) + WINDOW_OVERSCAN_PX
  const windowSize = Math.max(
    windowCountForCover(prefix, windowStart, coverPx),
    1,
  )
  const windowKey = gallery
    .slice(windowStart, windowStart + windowSize)
    .join('\0')
  const windowOffset = prefix[windowStart] ?? 0
  const windowCount = windowKey ? windowKey.split('\0').length : 0
  const windowEnd = Math.min(windowStart + windowCount, prefix.length - 1)
  const windowWidth = (prefix[windowEnd] ?? windowOffset) - windowOffset

  const items = useMemo(() => {
    if (!windowKey) {
      return [] as { id: string; name: string; offsetLeft: number }[]
    }
    return windowKey.split('\0').map((assetId, index) => {
      const absolute = prefix[windowStart + index] ?? 0
      return {
        id: assetId,
        name: assetId,
        offsetLeft: absolute - windowOffset,
      }
    })
  }, [windowKey, prefix, windowStart, windowOffset])

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

  const selectedId = useSyncExternalStore(
    subscribeGallerySelection,
    getSelectedAssetId,
    getSelectedAssetId,
  )
  const isEmpty = total === 0

  return (
    <section
      className="filmstrip"
      data-testid="filmstrip"
      data-gallery-count={total}
      aria-label="Gallery"
    >
      <FilmstripStatus photoCount={total} progress={progress} />
      <div
        ref={scrollRef}
        className="filmstrip-scroll"
        data-testid="filmstrip-scroll"
        onScroll={onScroll}
      >
        {isEmpty ? (
          <p className="filmstrip-empty" data-testid="filmstrip-empty">
            Add a folder or photos to build the gallery.
          </p>
        ) : (
          <div className="filmstrip-spacer" style={{ width: spacerWidth }}>
            <div
              className="filmstrip-window"
              data-testid="filmstrip-window"
              data-window-count={windowCount}
              style={{
                transform: `translateX(${String(windowOffset)}px)`,
                width: Math.max(windowWidth, 1),
                height: THUMB_HEIGHT + 24,
              }}
            >
              <GridList
                aria-label="Book gallery"
                orientation="horizontal"
                selectionMode="single"
                selectedKeys={selectedId === null ? [] : [selectedId]}
                onSelectionChange={(keys) => {
                  if (keys === 'all') {
                    return
                  }
                  const next = keys.values().next().value
                  setSelectedAssetId(typeof next === 'string' ? next : null)
                }}
                items={items}
                className="filmstrip-list"
                style={{
                  height: THUMB_HEIGHT + 24,
                  width: Math.max(windowWidth, 1),
                }}
              >
                {(item) => (
                  <FilmstripItemView
                    id={item.id}
                    name={item.name}
                    offsetLeft={item.offsetLeft}
                  />
                )}
              </GridList>
            </div>
          </div>
        )}
      </div>
    </section>
  )
})

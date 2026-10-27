import {
  memo,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from 'react'
import { GridList, type Selection } from 'react-aria-components'
import { setFilmstripVisibleAssetIds } from '../photo/assetPool'
import { shouldCommitFilmstripScroll } from './filmstripScrollCommit'
import { noteFilmstripScroll } from './thumbCache'
import { installFilmstripUnplaceWhenMounted } from './filmstripUnplaceMount'
import { scheduleFilmstripVisibleSync } from './filmstripVisibleSync'
import { EmptyState } from '../ui/EmptyState'
import {
  filmstripEmptyStyle,
  filmstripEmptyTitleStyle,
} from './filmstripChromeStyles'
import {
  getGalleryAspectsSnapshot,
  getGalleryDisplayNamesSnapshot,
  getAssetDisplayName,
  getAssetTimeMs,
  getBookStoreSnapshot,
  getGalleryIdsSnapshot,
  getPlacedAssetIdsSnapshot,
  getSpacerCountSnapshot,
  subscribeBookStore,
  subscribeGallery,
} from './bookStore'
import { FilmstripItemView } from './FilmstripItem'
import { unplaceSelectedFrame } from './galleryDrop'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import {
  getSelectedAssetIds,
  setSelectedAssetId,
  subscribeGallerySelection,
} from './gallerySelection'
import {
  applyFilmstripJumpScroll,
  filmstripJumpScrollPlan,
  getFilmstripJumpRequest,
  subscribeFilmstripJump,
} from './filmstripJump'
import {
  deriveGalleryView,
  projectOntoView,
  type GallerySortKey,
} from './galleryView'
import { FilmstripStatus } from './FilmstripStatus'
import {
  filmstripSelectionHandler,
  matchingSelection,
} from './filmstripSelection'
import {
  buildStridePrefix,
  indexFromScrollOffset,
  spacerWidthPx,
  thumbWidthMax,
  windowCountForCover,
} from './thumbSlotSize'
import {
  getFilmstripThumbHeight,
  subscribeFilmstripThumbHeight,
} from './filmstripSize'
import { endFilmstripResizePreview } from './useFilmstripResize'
import './Filmstrip.css'

/** Extra cover beyond the scrollport so fast scroll does not flash holes. */
function windowOverscanPx(thumbHeight: number): number {
  return thumbWidthMax(thumbHeight) * 2
}

/**
 * Owns scrollLeft / virtualizer state so status + unplace chrome are not
 * re-rendered on every scroll tick (scroll-during-import LoAF).
 */
const FilmstripScrollTrack = memo(function FilmstripScrollTrack({
  gallery,
  spacerCount,
  aspects,
  displayNames,
  galleryEmpty,
}: {
  gallery: readonly string[]
  spacerCount: number
  aspects: readonly number[]
  displayNames: readonly string[]
  /** True when the book gallery itself has no photos (vs. a filter hiding all). */
  galleryEmpty: boolean
}) {
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollLeft = useRef(0)
  const scrollRaf = useRef(0)
  const committedWindowStart = useRef(0)
  const prefixRef = useRef<readonly number[]>([0])
  const total = gallery.length
  // Deferred: a committed resize re-lays out every visible thumb, which is
  // too much script for the pointerup frame. React renders it time-sliced.
  const thumbHeight = useDeferredValue(
    useSyncExternalStore(
      subscribeFilmstripThumbHeight,
      getFilmstripThumbHeight,
      getFilmstripThumbHeight,
    ),
  )

  // The resize preview scale holds until the strip has re-laid out at the
  // committed height, so release never flashes the old size.
  useLayoutEffect(() => {
    endFilmstripResizePreview(scrollRef.current)
  }, [thumbHeight])

  const prefix = useMemo(
    () => buildStridePrefix(aspects, thumbHeight),
    [aspects, thumbHeight],
  )
  prefixRef.current = prefix
  const spacerWidth = useMemo(
    () => spacerWidthPx(aspects, spacerCount, 1, thumbHeight),
    [aspects, spacerCount, thumbHeight],
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

  const windowStart = useMemo(
    () => indexFromScrollOffset(scrollLeft, prefix),
    [prefix, scrollLeft],
  )
  committedWindowStart.current = windowStart

  const coverPx = Math.max(viewportWidth, 1) + windowOverscanPx(thumbHeight)
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
        name: displayNames[windowStart + index] ?? assetId,
        offsetLeft: absolute - windowOffset,
      }
    })
  }, [windowKey, prefix, windowStart, windowOffset, displayNames])

  useEffect(() => {
    return scheduleFilmstripVisibleSync(
      items.map((item) => item.id),
      setFilmstripVisibleAssetIds,
    )
  }, [items])

  const jumpRequest = useSyncExternalStore(
    subscribeFilmstripJump,
    getFilmstripJumpRequest,
    getFilmstripJumpRequest,
  )

  useEffect(() => {
    if (jumpRequest === null) {
      return
    }
    const plan = filmstripJumpScrollPlan(gallery, prefix, jumpRequest.assetId)
    if (plan === null) {
      return
    }
    applyFilmstripJumpScroll(scrollRef.current, plan)
    pendingScrollLeft.current = plan.scrollLeft
    setScrollLeft(plan.scrollLeft)
  }, [jumpRequest, gallery, prefix])

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    pendingScrollLeft.current = event.currentTarget.scrollLeft
    noteFilmstripScroll()
    if (scrollRaf.current !== 0) {
      return
    }
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      const nextLeft = pendingScrollLeft.current
      if (
        shouldCommitFilmstripScroll(
          nextLeft,
          prefixRef.current,
          committedWindowStart.current,
        )
      ) {
        setScrollLeft(nextLeft)
      }
    })
  }

  const selectedIds = useSyncExternalStore(
    subscribeGallerySelection,
    getSelectedAssetIds,
    getSelectedAssetIds,
  )
  const lastSelection = useRef<Selection | null>(null)
  const onSelectionChange = filmstripSelectionHandler(gallery, (keys) => {
    lastSelection.current = keys
  })
  const selectedKeys = matchingSelection(lastSelection.current, selectedIds)
  const isEmpty = total === 0

  useEffect(() => {
    return installFilmstripUnplaceWhenMounted(scrollRef.current)
  }, [])

  return (
    <div
      ref={scrollRef}
      className="filmstrip-scroll"
      data-testid="filmstrip-scroll"
      onScroll={onScroll}
    >
      {isEmpty && !galleryEmpty ? (
        <EmptyState
          className="filmstrip-empty"
          data-testid="filmstrip-filter-empty"
          style={filmstripEmptyStyle}
          title={
            <span style={filmstripEmptyTitleStyle}>All photos are placed.</span>
          }
        />
      ) : isEmpty ? (
        <EmptyState
          className="filmstrip-empty"
          data-testid="filmstrip-empty"
          style={filmstripEmptyStyle}
          title={
            <span style={filmstripEmptyTitleStyle}>
              Choose a photo folder to build the gallery.
            </span>
          }
        />
      ) : (
        <div className="filmstrip-spacer" style={{ width: spacerWidth }}>
          <div
            className="filmstrip-window"
            data-testid="filmstrip-window"
            data-window-count={windowCount}
            style={{
              transform: `translateX(${String(windowOffset)}px)`,
              width: Math.max(windowWidth, 1),
              height: thumbHeight + 24,
            }}
          >
            <GridList
              aria-label="Book gallery"
              orientation="horizontal"
              selectionMode="multiple"
              selectionBehavior="replace"
              selectedKeys={selectedKeys}
              onSelectionChange={onSelectionChange}
              items={items}
              className="filmstrip-list"
              style={{
                height: thumbHeight + 24,
                width: Math.max(windowWidth, 1),
              }}
            >
              {(item) => (
                <FilmstripItemView
                  id={item.id}
                  name={item.name}
                  offsetLeft={item.offsetLeft}
                  thumbHeight={thumbHeight}
                />
              )}
            </GridList>
          </div>
        </div>
      )}
    </div>
  )
})

export const Filmstrip = memo(function Filmstrip({
  sort,
  unplacedOnly = false,
}: {
  sort?: GallerySortKey
  unplacedOnly?: boolean
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
  const displayNames = useSyncExternalStore(
    subscribeBookStore,
    getGalleryDisplayNamesSnapshot,
    getGalleryDisplayNamesSnapshot,
  )
  const frameSource = useSyncExternalStore(
    subscribeFrameSelection,
    getFrameSource,
    getFrameSource,
  )
  const placed = useSyncExternalStore(
    subscribeBookStore,
    getPlacedAssetIdsSnapshot,
    getPlacedAssetIdsSnapshot,
  )
  // Asset records change identity when capturedAt lands; only sort-by-capture reads them.
  const assets = useSyncExternalStore(
    subscribeBookStore,
    () => getBookStoreSnapshot().book.assets,
    () => getBookStoreSnapshot().book.assets,
  )
  const total = gallery.length

  const viewIds = useMemo(
    () =>
      deriveGalleryView(
        gallery,
        { sort, unplacedOnly },
        {
          name: getAssetDisplayName,
          timeMs: getAssetTimeMs,
          isPlaced: (id) => placed.has(id),
        },
      ),
    // displayNames / assets: name and capture-time sorts re-derive when
    // session names or capturedAt land (the lookups read the store directly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gallery, sort, unplacedOnly, placed, displayNames, assets],
  )
  const viewAspects = useMemo(
    () => projectOntoView(gallery, viewIds, aspects, () => 1),
    [gallery, viewIds, aspects],
  )
  const viewNames = useMemo(
    () => projectOntoView(gallery, viewIds, displayNames, (id) => id),
    [gallery, viewIds, displayNames],
  )

  return (
    <section
      className="filmstrip"
      data-testid="filmstrip"
      data-gallery-count={total}
      data-view-count={viewIds.length}
      aria-label="Gallery"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setSelectedAssetId(null)
        }
      }}
    >
      <FilmstripStatus photoCount={total} />
      <button
        type="button"
        className="filmstrip-unplace"
        disabled={frameSource === null}
        onClick={() => {
          unplaceSelectedFrame()
        }}
      >
        Unplace
      </button>
      <FilmstripScrollTrack
        gallery={viewIds}
        spacerCount={viewIds === gallery ? spacerCount : viewIds.length}
        // (spacer reserves import-expected extent only for the unfiltered strip)
        aspects={viewAspects}
        displayNames={viewNames}
        galleryEmpty={total === 0}
      />
    </section>
  )
})

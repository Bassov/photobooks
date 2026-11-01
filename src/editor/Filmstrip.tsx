import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type UIEvent,
} from 'react'
import { GridList, type Selection } from 'react-aria-components'
import { setFilmstripVisibleAssetIds } from '../photo/assetPool'
import {
  filmstripScrollDirection,
  shouldCommitFilmstripScroll,
} from './filmstripScrollCommit'
import { noteFilmstripScroll, setThumbViewportProvider } from './thumbCache'
import { installFilmstripUnplaceWhenMounted } from './filmstripUnplaceMount'
import { installFilmstripWheel } from './filmstripWheel'
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
import {
  getFrameSource,
  sourceFrameFilled,
  subscribeFrameSelection,
} from './frameSelection'
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
  filmstripWindowRange,
  scrollportIndexRange,
  spacerWidthPx,
  thumbWidthMax,
  type FilmstripScrollDirection,
} from './thumbSlotSize'
import { FILMSTRIP_THUMB_HEIGHT } from './filmstripSize'
import './Filmstrip.css'

interface FilmstripRow {
  id: string
  name: string
}

/**
 * Cover ahead of the scrollport in the scroll direction (about one scrollport
 * width) so fast scroll does not flash holes and `<img>` decode starts early.
 */
function windowOverscanPx(thumbHeight: number, viewportWidth: number): number {
  return Math.max(viewportWidth, thumbWidthMax(thumbHeight) * 2)
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
  const [scrollDir, setScrollDir] = useState<FilmstripScrollDirection>(1)
  const [viewportWidth, setViewportWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollLeft = useRef(0)
  const scrollRaf = useRef(0)
  const committedWindow = useRef({ start: 0, end: 0 })
  const prefixRef = useRef<readonly number[]>([0])
  const scrollLeftRef = useRef(0)
  const lastScrollLeft = useRef(0)
  const scrollDirRef = useRef<FilmstripScrollDirection>(1)
  const viewportWidthRef = useRef(0)
  const galleryRef = useRef(gallery)
  const total = gallery.length
  const thumbHeight = FILMSTRIP_THUMB_HEIGHT

  const prefix = useMemo(
    () => buildStridePrefix(aspects, thumbHeight),
    [aspects, thumbHeight],
  )
  prefixRef.current = prefix
  scrollLeftRef.current = scrollLeft
  viewportWidthRef.current = viewportWidth
  galleryRef.current = gallery

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

  // Thumb publishes / DerivedCache reads serve the scrollport tiles first.
  useEffect(
    () =>
      setThumbViewportProvider(() => {
        const view = scrollportIndexRange(
          prefixRef.current,
          pendingScrollLeft.current,
          viewportWidthRef.current,
        )
        return galleryRef.current.slice(view.start, view.end)
      }),
    [],
  )

  const windowRange = useMemo(
    () =>
      filmstripWindowRange(
        prefix,
        scrollLeft,
        viewportWidth,
        scrollDir,
        windowOverscanPx(thumbHeight, viewportWidth),
      ),
    [prefix, scrollLeft, viewportWidth, scrollDir, thumbHeight],
  )
  committedWindow.current = windowRange
  const windowStart = windowRange.start
  const windowSize = Math.max(windowRange.end - windowRange.start, 1)
  const windowKey = gallery
    .slice(windowStart, windowStart + windowSize)
    .join('\0')
  const windowOffset = prefix[windowStart] ?? 0
  const windowCount = windowKey ? windowKey.split('\0').length : 0
  const windowEnd = Math.min(windowStart + windowCount, prefix.length - 1)
  const windowWidth = (prefix[windowEnd] ?? windowOffset) - windowOffset

  // Item objects keep their identity while id + name hold: react-aria caches
  // each rendered row by item object, so a resize or window shift does not
  // re-render (or commit) the rows that stay in the window.
  const itemCache = useRef(new Map<string, FilmstripRow>())
  const items = useMemo(() => {
    if (!windowKey) {
      return [] as FilmstripRow[]
    }
    const next = new Map<string, FilmstripRow>()
    const rows = windowKey.split('\0').map((assetId, index) => {
      const name = displayNames[windowStart + index] ?? assetId
      const cached = itemCache.current.get(assetId)
      const row = cached?.name === name ? cached : { id: assetId, name }
      next.set(assetId, row)
      return row
    })
    itemCache.current = next
    return rows
  }, [windowKey, windowStart, displayNames])

  useEffect(() => {
    return scheduleFilmstripVisibleSync(
      items.map((item) => item.id),
      setFilmstripVisibleAssetIds,
      // Refs: a gallery flush alone must not re-publish the same window.
      { order: galleryRef.current, start: committedWindow.current.start },
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
      const dir = filmstripScrollDirection(
        nextLeft,
        lastScrollLeft.current,
        scrollDirRef.current,
      )
      lastScrollLeft.current = nextLeft
      scrollDirRef.current = dir
      const width = viewportWidthRef.current
      const next = filmstripWindowRange(
        prefixRef.current,
        nextLeft,
        width,
        dir,
        windowOverscanPx(thumbHeight, width),
      )
      if (shouldCommitFilmstripScroll(next, committedWindow.current)) {
        setScrollDir(dir)
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

  useEffect(() => {
    return installFilmstripWheel(scrollRef.current)
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
            <span style={filmstripEmptyTitleStyle}>
              Every photo is placed. Turn off “Unplaced” to see all.
            </span>
          }
        />
      ) : isEmpty ? (
        <EmptyState
          className="filmstrip-empty"
          data-testid="filmstrip-empty"
          style={filmstripEmptyStyle}
          title={
            <span style={filmstripEmptyTitleStyle}>
              No photos yet — add a folder or drop one here.
            </span>
          }
        />
      ) : (
        <div className="filmstrip-spacer" style={{ width: spacerWidth }}>
          <div
            className="filmstrip-window"
            data-testid="filmstrip-window"
            data-window-count={windowCount}
            style={
              {
                '--film-slot-h': `${String(thumbHeight)}px`,
                transform: `translateX(${String(windowOffset)}px)`,
                width: Math.max(windowWidth, 1),
              } as CSSProperties
            }
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
            >
              {(item) => <FilmstripItemView id={item.id} name={item.name} />}
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
      <FilmstripStatus />
      <button
        type="button"
        className="filmstrip-unplace"
        disabled={frameSource === null || !sourceFrameFilled(frameSource)}
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

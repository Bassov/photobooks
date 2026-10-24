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
  getGalleryIdsSnapshot,
  getSpacerCountSnapshot,
  subscribeBookStore,
  subscribeGallery,
} from './bookStore'
import { FilmstripItemView } from './FilmstripItem'
import { unplaceSelectedFrame } from './galleryDrop'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import {
  getSelectedAssetId,
  setSelectedAssetId,
  subscribeGallerySelection,
} from './gallerySelection'
import {
  applyFilmstripJumpScroll,
  filmstripJumpScrollPlan,
  getFilmstripJumpRequest,
  subscribeFilmstripJump,
} from './filmstripJump'
import { FilmstripStatus } from './FilmstripStatus'
import { onFilmstripGridSelectionChange } from './filmstripSelection'
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

/**
 * Owns scrollLeft / virtualizer state so status + unplace chrome are not
 * re-rendered on every scroll tick (scroll-during-import LoAF).
 */
const FilmstripScrollTrack = memo(function FilmstripScrollTrack({
  gallery,
  spacerCount,
  aspects,
  displayNames,
}: {
  gallery: readonly string[]
  spacerCount: number
  aspects: readonly number[]
  displayNames: readonly string[]
}) {
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollLeft = useRef(0)
  const scrollRaf = useRef(0)
  const committedWindowStart = useRef(0)
  const prefixRef = useRef<readonly number[]>([0])
  const total = gallery.length

  const prefix = useMemo(() => buildStridePrefix(aspects), [aspects])
  prefixRef.current = prefix
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

  const windowStart = useMemo(
    () => indexFromScrollOffset(scrollLeft, prefix),
    [prefix, scrollLeft],
  )
  committedWindowStart.current = windowStart

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

  const selectedId = useSyncExternalStore(
    subscribeGallerySelection,
    getSelectedAssetId,
    getSelectedAssetId,
  )
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
      {isEmpty ? (
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
              height: THUMB_HEIGHT + 24,
            }}
          >
            <GridList
              aria-label="Book gallery"
              orientation="horizontal"
              selectionMode="single"
              selectedKeys={selectedId === null ? [] : [selectedId]}
              onSelectionChange={onFilmstripGridSelectionChange}
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
  )
})

export const Filmstrip = memo(function Filmstrip() {
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
  const total = gallery.length

  return (
    <section
      className="filmstrip"
      data-testid="filmstrip"
      data-gallery-count={total}
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
        gallery={gallery}
        spacerCount={spacerCount}
        aspects={aspects}
        displayNames={displayNames}
      />
    </section>
  )
})

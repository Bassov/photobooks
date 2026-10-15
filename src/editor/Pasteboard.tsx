import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { CameraBar } from './CameraBar'
import { getCommittedCamera, subscribeCommitted } from './cameraStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { installGalleryDrop, type DropGeometry } from './galleryDrop'
import { SpreadTemplateBar } from './SpreadTemplateBar'
import { usePasteboardCamera } from './usePasteboardCamera'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  PASTEBOARD_GAP_PX,
  pasteboardStridePx,
  pasteboardWindow,
  pickActiveSpread,
} from './pasteboardWindow'

function getTrimHeightMm(): number {
  return getBookStoreSnapshot().book.settings.trim.heightMm
}

function getTrimWidthMm(): number {
  return getBookStoreSnapshot().book.settings.trim.widthMm
}

function findPasteboardSlot(
  scroll: HTMLElement,
  spreadId: string,
): HTMLElement | null {
  for (const slot of scroll.querySelectorAll<HTMLElement>(
    '[data-pasteboard-slot]',
  )) {
    if (slot.dataset.spreadId === spreadId) {
      return slot
    }
  }
  return null
}

function spreadBoxContained(port: DOMRect, box: DOMRect): boolean {
  return (
    box.width >= 1 &&
    box.height >= 1 &&
    box.top >= port.top - 1 &&
    box.bottom <= port.bottom + 1 &&
    box.left >= port.left - 1 &&
    box.right <= port.right + 1
  )
}

function revealLaidOutSpread(scroll: HTMLElement, slot: HTMLElement): boolean {
  const previousVisibility = slot.style.contentVisibility
  slot.style.contentVisibility = 'visible'
  const view = slot.querySelector('[data-testid="spread-view"]')
  const target = view instanceof HTMLElement ? view : slot
  const box = target.getBoundingClientRect()
  if (box.width < 1 || box.height < 1) {
    slot.style.contentVisibility = previousVisibility
    return false
  }
  nudgeBoxIntoPort(scroll, box)
  slot.style.contentVisibility = previousVisibility
  const port = scroll.getBoundingClientRect()
  const after = target.getBoundingClientRect()
  const fits = after.height <= port.height + 1 && after.width <= port.width + 1
  if (!spreadBoxContained(port, after) && fits) {
    nudgeBoxIntoPort(scroll, after)
  }
  return spreadBoxContained(
    scroll.getBoundingClientRect(),
    target.getBoundingClientRect(),
  )
}

function nudgeBoxIntoPort(scroll: HTMLElement, box: DOMRect): void {
  const port = scroll.getBoundingClientRect()
  const contentTop = scroll.scrollTop + (box.top - port.top)
  const contentLeft = scroll.scrollLeft + (box.left - port.left)
  let top = scroll.scrollTop
  let left = scroll.scrollLeft
  if (box.height <= port.height + 1) {
    if (box.top < port.top - 1 || box.bottom > port.bottom + 1) {
      top = contentTop - Math.max(0, (port.height - box.height) / 2)
    }
  } else if (box.top < port.top - 1) {
    top -= port.top - box.top
  } else if (box.bottom > port.bottom + 1) {
    top += box.bottom - port.bottom
  }
  if (box.width <= port.width + 1) {
    if (box.left < port.left - 1 || box.right > port.right + 1) {
      left = contentLeft - Math.max(0, (port.width - box.width) / 2)
    }
  } else if (box.left < port.left - 1) {
    left -= port.left - box.left
  } else if (box.right > port.right + 1) {
    left += box.right - port.right
  }
  scroll.scrollTop = Math.max(0, top)
  scroll.scrollLeft = Math.max(0, left)
}

export const Pasteboard = memo(function Pasteboard() {
  const spreadIds = useSyncExternalStore(
    subscribeBookStore,
    getSpreadIdsSnapshot,
    getSpreadIdsSnapshot,
  )
  const trimHeightMm = useSyncExternalStore(
    subscribeBookStore,
    getTrimHeightMm,
    getTrimHeightMm,
  )
  const trimWidthMm = useSyncExternalStore(
    subscribeBookStore,
    getTrimWidthMm,
    getTrimWidthMm,
  )
  const cameraFrame = useSyncExternalStore(
    subscribeCommitted,
    getCommittedCamera,
    getCommittedCamera,
  )
  const committedZoom = cameraFrame.zoom
  const pxPerMm = SPREAD_PX_PER_MM * committedZoom
  const stride =
    pasteboardStridePx(trimHeightMm * SPREAD_PX_PER_MM) * committedZoom
  const [trackedScroll, setTrackedScroll] = useState({ top: 0, epoch: 0 })
  const scrollTop =
    trackedScroll.epoch >= cameraFrame.epoch
      ? trackedScroll.top
      : cameraFrame.scrollTop
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const geometryRef = useRef<DropGeometry>({
    pxPerMm,
    stridePx: stride,
    worldWidthPx: 0,
  })
  const scrollRaf = useRef(0)
  const pendingTop = useRef(0)
  const pendingEpoch = useRef(0)
  const revealSpreadId = useRef<string | null>(null)
  const revealTries = useRef(0)
  const [revealTick, setRevealTick] = useState(0)

  useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }
    const update = (): void => {
      const width = node.clientWidth
      const height = node.clientHeight
      setViewport((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (scrollRaf.current !== 0) {
        cancelAnimationFrame(scrollRaf.current)
      }
    }
  }, [])

  useEffect(() => {
    const scroll = scrollRef.current
    if (scroll === null) {
      return
    }
    return installGalleryDrop(scroll, () => geometryRef.current)
  }, [])

  const onAddSpread = (): void => {
    const before = new Set(getSpreadIdsSnapshot())
    dispatchBookOp({ type: 'addSpread' })
    revealTries.current = 0
    revealSpreadId.current =
      getSpreadIdsSnapshot().find((id) => !before.has(id)) ?? null
  }

  const range = pasteboardWindow({
    count: spreadIds.length,
    stridePx: stride,
    scrollTop,
    viewportPx: viewport.height,
    overscanPx: stride,
  })
  const mounted = spreadIds.slice(range.start, range.end)
  const windowKey = mounted.join('\0')
  const markedId =
    activeId !== null && mounted.includes(activeId) ? activeId : mounted[0]
  const activeIndex = markedId === undefined ? 0 : spreadIds.indexOf(markedId)
  const widestPages = spreadIds.length >= 2 ? 2 : 1
  const stackWidth = trimWidthMm * widestPages * pxPerMm
  const worldWidth = Math.max(viewport.width, stackWidth)
  geometryRef.current.pxPerMm = pxPerMm
  geometryRef.current.stridePx = stride
  geometryRef.current.worldWidthPx = worldWidth
  const camera = usePasteboardCamera({
    scrollRef,
    worldRef,
    spreadCount: spreadIds.length,
    trimWidthMm,
    trimHeightMm,
    activeIndex: activeIndex < 0 ? 0 : activeIndex,
    committedEpoch: cameraFrame.epoch,
  })

  useLayoutEffect(() => {
    const id = revealSpreadId.current
    if (id === null || windowKey.length === 0) {
      return
    }
    const scroll = scrollRef.current
    if (scroll === null) {
      return
    }
    const slot = findPasteboardSlot(scroll, id)
    const epoch = getCommittedCamera().epoch
    if (slot === null) {
      const top = Math.max(0, (spreadIds.length - 1) * stride)
      setTrackedScroll((current) =>
        current.top === top && current.epoch === epoch
          ? current
          : { top, epoch },
      )
      return
    }
    if (!revealLaidOutSpread(scroll, slot)) {
      if (revealTries.current < 8) {
        revealTries.current += 1
        requestAnimationFrame(() => {
          setRevealTick((tick) => tick + 1)
        })
      }
      return
    }
    revealTries.current = 0
    revealSpreadId.current = null
    const top = scroll.scrollTop
    setTrackedScroll((current) =>
      current.top === top && current.epoch === epoch ? current : { top, epoch },
    )
  }, [spreadIds, stride, windowKey, revealTick])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || typeof IntersectionObserver === 'undefined') {
      return
    }
    const ratios = new Map<string, { ratio: number; index: number }>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!(entry.target instanceof HTMLElement)) {
            continue
          }
          const id = entry.target.dataset.spreadId
          const index = Number(entry.target.dataset.slotIndex)
          if (id === undefined || !Number.isFinite(index)) {
            continue
          }
          ratios.set(id, { ratio: entry.intersectionRatio, index })
        }
        const bestId = pickActiveSpread(
          [...ratios.entries()].map(([id, entry]) => ({
            id,
            ratio: entry.ratio,
            index: entry.index,
          })),
        )
        if (bestId !== null) {
          setActiveId(bestId)
        }
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    for (const slot of root.querySelectorAll<HTMLElement>(
      '[data-pasteboard-slot]',
    )) {
      observer.observe(slot)
    }
    return () => {
      observer.disconnect()
    }
  }, [windowKey])

  const onScroll = (event: UIEvent<HTMLDivElement>): void => {
    pendingTop.current = event.currentTarget.scrollTop
    pendingEpoch.current = getCommittedCamera().epoch
    if (scrollRaf.current !== 0) {
      return
    }
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      const top = pendingTop.current
      const epoch = pendingEpoch.current
      setTrackedScroll((current) =>
        current.top === top && current.epoch === epoch
          ? current
          : { top, epoch },
      )
    })
  }

  return (
    <div className="pasteboard" data-testid="pasteboard">
      <SpreadTemplateBar
        spreadId={markedId ?? null}
        onAddSpread={onAddSpread}
      />
      <CameraBar
        onFitSpread={camera.fitSpread}
        onFitWidth={camera.fitWidth}
        onActualSize={camera.actualSize}
      />
      <div
        ref={scrollRef}
        className="pasteboard-scroll"
        data-testid="pasteboard-scroll"
        data-spread-count={spreadIds.length}
        role="region"
        aria-label="Spreads"
        tabIndex={0}
        onScroll={onScroll}
      >
        <div
          ref={worldRef}
          className="pasteboard-world"
          data-testid="pasteboard-world"
          style={{ width: worldWidth }}
        >
          {range.leadPx > 0 ? (
            <div
              className="pasteboard-spacer"
              data-testid="pasteboard-lead"
              style={{ height: range.leadPx }}
            />
          ) : null}
          {mounted.map((spreadId, index) => (
            <div
              key={spreadId}
              className="pasteboard-slot"
              data-pasteboard-slot=""
              data-testid="pasteboard-slot"
              data-spread-id={spreadId}
              data-slot-index={range.start + index}
              data-active={markedId === spreadId ? 'true' : 'false'}
              style={{
                height: stride,
                paddingBottom: PASTEBOARD_GAP_PX * committedZoom,
                containIntrinsicBlockSize: `auto ${String(stride)}px`,
              }}
            >
              <ConnectedSpreadView spreadId={spreadId} pxPerMm={pxPerMm} />
            </div>
          ))}
          {range.tailPx > 0 ? (
            <div
              className="pasteboard-spacer"
              data-testid="pasteboard-tail"
              style={{ height: range.tailPx }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
})

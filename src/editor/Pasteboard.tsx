import {
  memo,
  useEffect,
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
import { usePasteboardReveal } from './usePasteboardReveal'
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
  const reveal = usePasteboardReveal({
    scrollRef,
    worldRef,
    spreadIds,
    stride,
    windowKey,
    setTrackedScroll,
  })
  const camera = usePasteboardCamera({
    scrollRef,
    worldRef,
    spreadCount: spreadIds.length,
    trimWidthMm,
    trimHeightMm,
    activeIndex: activeIndex < 0 ? 0 : activeIndex,
    committedEpoch: cameraFrame.epoch,
    holdScrollRef: reveal.holdCameraScrollRef,
  })

  const onAddSpread = (): void => {
    const before = new Set(getSpreadIdsSnapshot())
    dispatchBookOp({ type: 'addSpread' })
    const newId = getSpreadIdsSnapshot().find((id) => !before.has(id)) ?? null
    reveal.beginRevealForNewSpread(newId)
  }

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

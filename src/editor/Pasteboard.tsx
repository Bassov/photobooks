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
import { usePasteboardReveal } from './usePasteboardReveal'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
  pacePasteboardWindow,
  pasteboardWindow,
  pasteboardWindowsEqual,
  pickActiveSpread,
  type PasteboardWindow,
} from './pasteboardWindow'
import {
  bindGalleryDrop,
  cancelPendingScrollFrame,
  nextTrackedScroll,
  nextViewportSize,
  pasteboardSlotPaddingBottom,
  pasteboardStrideAtZoom,
  pasteboardWindowKey,
  pasteboardWorldWidthPx,
  readPasteboardSlotEntry,
  resolveTrackedScrollTop,
  selectMarkedSpreadId,
  shouldRenderSpacer,
  spreadActiveIndex,
} from './pasteboardView'

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
  const stride = pasteboardStrideAtZoom(trimHeightMm, committedZoom)
  const [trackedScroll, setTrackedScroll] = useState({ top: 0, epoch: 0 })
  const scrollTop = resolveTrackedScrollTop(trackedScroll, cameraFrame)
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
  const pacedRef = useRef<PasteboardWindow | null>(null)
  const paceScheduled = useRef(false)
  const paceWatchdog = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const [paced, setPaced] = useState<PasteboardWindow | null>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }
    const update = (): void => {
      const width = node.clientWidth
      const height = node.clientHeight
      setViewport((current) => nextViewportSize(current, width, height))
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
      scrollRaf.current = cancelPendingScrollFrame(scrollRaf.current)
    }
  }, [])

  useEffect(() => {
    return bindGalleryDrop(scrollRef.current, (scroll) =>
      installGalleryDrop(scroll, () => geometryRef.current),
    )
  }, [])

  const target = pasteboardWindow({
    count: spreadIds.length,
    stridePx: stride,
    scrollTop,
    viewportPx: viewport.height,
    overscanPx: stride,
  })
  const viewportCover = pasteboardWindow({
    count: spreadIds.length,
    stridePx: stride,
    scrollTop,
    viewportPx: viewport.height,
    overscanPx: 0,
  })

  useLayoutEffect(() => {
    let cancelled = false
    const targetWindow: PasteboardWindow = {
      start: target.start,
      end: target.end,
      leadPx: target.leadPx,
      tailPx: target.tailPx,
    }
    const coverWindow: PasteboardWindow = {
      start: viewportCover.start,
      end: viewportCover.end,
      leadPx: viewportCover.leadPx,
      tailPx: viewportCover.tailPx,
    }

    const clearWatchdog = (): void => {
      if (paceWatchdog.current !== undefined) {
        clearTimeout(paceWatchdog.current)
        paceWatchdog.current = undefined
      }
    }

    const advance = (): boolean => {
      const emptyPainted: PasteboardWindow = {
        start: targetWindow.start,
        end: targetWindow.start,
        leadPx: targetWindow.start * stride,
        tailPx: (spreadIds.length - targetWindow.start) * stride,
      }
      const current = pacedRef.current ?? emptyPainted
      const next = pacePasteboardWindow({
        current,
        target: targetWindow,
        viewportCover: coverWindow,
        maxNewMounts: PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
        count: spreadIds.length,
        stridePx: stride,
      })
      pacedRef.current = next
      setPaced((prev) =>
        prev !== null && pasteboardWindowsEqual(prev, next) ? prev : next,
      )
      return next.start !== targetWindow.start || next.end !== targetWindow.end
    }

    const runScheduled = (): void => {
      if (cancelled || !paceScheduled.current) {
        return
      }
      paceScheduled.current = false
      clearWatchdog()
      if (advance()) {
        scheduleStep()
      }
    }

    const scheduleStep = (): void => {
      if (cancelled || paceScheduled.current) {
        return
      }
      paceScheduled.current = true
      requestAnimationFrame(runScheduled)
      paceWatchdog.current = setTimeout(runScheduled, 32)
    }

    if (advance()) {
      scheduleStep()
    }
    return () => {
      cancelled = true
      paceScheduled.current = false
      clearWatchdog()
    }
    // Primitives only: object identity of pasteboardWindow() results must not
    // retrigger this effect on every setPaced commit (that would cascade mounts).
  }, [
    target.start,
    target.end,
    target.leadPx,
    target.tailPx,
    viewportCover.start,
    viewportCover.end,
    viewportCover.leadPx,
    viewportCover.tailPx,
    stride,
    spreadIds.length,
  ])

  const range =
    paced === null
      ? {
          start: target.start,
          end: target.start,
          leadPx: target.start * stride,
          tailPx: (spreadIds.length - target.start) * stride,
        }
      : {
          start: paced.start,
          end: paced.end,
          leadPx: paced.start * stride,
          tailPx: (spreadIds.length - paced.end) * stride,
        }
  const mounted = spreadIds.slice(range.start, range.end)
  const windowKey = pasteboardWindowKey(mounted)
  const markedId = selectMarkedSpreadId(activeId, mounted)
  const activeIndex = spreadActiveIndex(markedId, spreadIds)
  const worldWidth = pasteboardWorldWidthPx({
    viewportWidth: viewport.width,
    trimWidthMm,
    spreadCount: spreadIds.length,
    pxPerMm,
  })
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
    activeIndex,
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
          const parsed = readPasteboardSlotEntry(entry)
          if (parsed === null) {
            continue
          }
          ratios.set(parsed.id, {
            ratio: parsed.ratio,
            index: parsed.index,
          })
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
      setTrackedScroll((current) => nextTrackedScroll(current, top, epoch))
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
          {shouldRenderSpacer(range.leadPx) ? (
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
                paddingBottom: pasteboardSlotPaddingBottom(committedZoom),
                containIntrinsicBlockSize: `auto ${String(stride)}px`,
              }}
            >
              <ConnectedSpreadView spreadId={spreadId} pxPerMm={pxPerMm} />
            </div>
          ))}
          {shouldRenderSpacer(range.tailPx) ? (
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

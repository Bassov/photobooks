import {
  memo,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type UIEvent,
} from 'react'
import { getSpreadPageCount } from '../core'
import { setFrameSource } from './frameSelection'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  getActiveSpreadId,
  setActiveSpreadId,
  subscribeSpreadRevealRequest,
} from './photoRootSession'
import {
  getCommittedCamera,
  registerCameraCommands,
  subscribeCommitted,
} from './cameraStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { installGalleryDrop, type DropGeometry } from './galleryDrop'
import { usePasteboardCamera } from './usePasteboardCamera'
import { usePasteboardReveal } from './usePasteboardReveal'
import {
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
  applyForceMountIndex,
  clearForceMountIndex,
  pacePasteboardWindow,
  pasteboardGapPx,
  pasteboardOverscanPx,
  pasteboardWindow,
  pasteboardWindowsEqual,
  pickActiveSpread,
  type PasteboardWindow,
} from './pasteboardWindow'
import { Icon } from '../ui/Icon'
import { PageLabels } from './PageLabels'
import { pageLabelsFit } from './pageLabelsModel'
import { PageShadows } from './PageShadows'
import { pageShadowRects } from './pageShadowModel'
import { RelinkHost } from './relink'
import { Rulers } from './Rulers'
import { getRulersVisible, subscribeRulersVisible } from './rulersView'
import {
  bindGalleryDrop,
  cancelPendingScrollFrame,
  nextTrackedScroll,
  nextViewportSize,
  PASTEBOARD_PAD_PX,
  pasteboardClickSpreadId,
  pasteboardStrideAtZoom,
  pasteboardWindowKey,
  pasteboardWorldWidthPx,
  readPasteboardSlotEntry,
  resolveTrackedScrollTop,
  resolvePreferredActiveId,
  selectMarkedSpreadId,
  shouldRenderSpacer,
  spreadActiveIndex,
  stackScrollTop,
} from './pasteboardView'

function getTrimHeightMm(): number {
  return getBookStoreSnapshot().book.settings.trim.heightMm
}

function getTrimWidthMm(): number {
  return getBookStoreSnapshot().book.settings.trim.widthMm
}

export const Pasteboard = memo(function Pasteboard({
  fitOnOpen = false,
}: {
  /** Fit the selected spread once the viewport is measured (editor shell). */
  fitOnOpen?: boolean
}) {
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
  const rulersOn = useSyncExternalStore(
    subscribeRulersVisible,
    getRulersVisible,
    getRulersVisible,
  )
  const committedZoom = cameraFrame.zoom
  const pxPerMm = SPREAD_PX_PER_MM * committedZoom
  const stride = pasteboardStrideAtZoom(trimHeightMm, committedZoom)
  const gapPx = pasteboardGapPx(trimHeightMm * pxPerMm)
  const [trackedScroll, setTrackedScroll] = useState({ top: 0, epoch: 0 })
  const scrollTop = stackScrollTop(
    resolveTrackedScrollTop(trackedScroll, cameraFrame),
  )
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    setActiveSpreadId(activeId)
  }, [activeId])
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
  const paceRaf = useRef(0)
  const paceWatchdog = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const paceGeneration = useRef(0)
  const forceMountIndexRef = useRef<number | null>(null)
  /** Pin the just-added spread until the user scrolls (cleared after reveal hold). */
  const preferredActiveRef = useRef<string | null>(null)
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
    overscanPx: pasteboardOverscanPx(spreadIds.length, trimHeightMm * pxPerMm),
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

    const clearPendingStep = (): void => {
      if (paceWatchdog.current !== undefined) {
        clearTimeout(paceWatchdog.current)
        paceWatchdog.current = undefined
      }
      if (paceRaf.current !== 0) {
        cancelAnimationFrame(paceRaf.current)
        paceRaf.current = 0
      }
    }

    const advance = (): boolean => {
      // Bootstrap: treat the viewport cover as already painted so cold start and
      // add-spread reveal see real slots immediately; only overscan (and large
      // cover jumps from a prior paced window) are rate-limited.
      const bootCover: PasteboardWindow = {
        start: coverWindow.start,
        end: coverWindow.end,
        leadPx: coverWindow.start * stride,
        tailPx: (spreadIds.length - coverWindow.end) * stride,
      }
      const current = pacedRef.current ?? bootCover
      let next = pacePasteboardWindow({
        current,
        target: targetWindow,
        viewportCover: coverWindow,
        maxNewMounts: PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
        count: spreadIds.length,
        stridePx: stride,
      })
      const forceIdx = forceMountIndexRef.current
      next = applyForceMountIndex({
        next,
        forceIdx,
        target: targetWindow,
        count: spreadIds.length,
        stridePx: stride,
      })
      forceMountIndexRef.current = clearForceMountIndex(forceIdx, next)
      pacedRef.current = next
      // rAF/IO-driven updates (paced mounts, tracked scroll, active spread) run
      // as transitions so React time-slices them instead of one blocking
      // default-lane render per frame (LoAF during zoom settle remount).
      startTransition(() => {
        setPaced((prev) =>
          prev !== null && pasteboardWindowsEqual(prev, next) ? prev : next,
        )
      })
      return next.start !== targetWindow.start || next.end !== targetWindow.end
    }

    const runScheduled = (generation: number): void => {
      if (
        cancelled ||
        generation !== paceGeneration.current ||
        !paceScheduled.current
      ) {
        return
      }
      paceScheduled.current = false
      clearPendingStep()
      if (advance()) {
        scheduleStep()
      }
    }

    const scheduleStep = (): void => {
      paceScheduled.current = true
      const generation = paceGeneration.current + 1
      paceGeneration.current = generation
      paceRaf.current = requestAnimationFrame(() => {
        runScheduled(generation)
      })
      paceWatchdog.current = setTimeout(() => {
        runScheduled(generation)
      }, 32)
    }

    if (advance()) {
      scheduleStep()
    }
    return () => {
      cancelled = true
      paceScheduled.current = false
      paceGeneration.current += 1
      clearPendingStep()
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

  // Recompute spacer px from indices × current stride so zoom changes cannot
  // leave stale lead/tail from a previous paced step.
  const range =
    paced === null
      ? {
          start: viewportCover.start,
          end: viewportCover.end,
          leadPx: viewportCover.start * stride,
          tailPx: (spreadIds.length - viewportCover.end) * stride,
        }
      : {
          start: paced.start,
          end: paced.end,
          leadPx: paced.start * stride,
          tailPx: (spreadIds.length - paced.end) * stride,
        }
  const mounted = useMemo(
    () => spreadIds.slice(range.start, range.end),
    [spreadIds, range.start, range.end],
  )
  const windowKey = pasteboardWindowKey(mounted)
  const markedId = selectMarkedSpreadId(activeId, mounted)
  const activeIndex = spreadActiveIndex(markedId, spreadIds)
  const worldWidth = pasteboardWorldWidthPx({
    viewportWidth: 0,
    trimWidthMm,
    spreadCount: spreadIds.length,
    pxPerMm,
  })
  // Stable across renders that keep the window and zoom, so the memoised
  // shadow layer skips them (scroll ticks, selection, gesture indicator).
  const shadowRects = useMemo(
    () =>
      pageShadowRects({
        mounted,
        start: range.start,
        spreadCount: spreadIds.length,
        stride,
        spreadHeightPx: trimHeightMm * pxPerMm,
        pageWidthPx: trimWidthMm * pxPerMm,
        worldWidthPx: worldWidth,
      }),
    [
      mounted,
      range.start,
      spreadIds.length,
      stride,
      trimHeightMm,
      trimWidthMm,
      pxPerMm,
      worldWidth,
    ],
  )
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
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  useLayoutEffect(() => {
    if (!fitOnOpen || spreadIds.length === 0) {
      return
    }
    if (viewport.width === 0 || viewport.height === 0) {
      return
    }
    // A trim change (book opened after mount) refits too: Fit is per trim.
    cameraRef.current.refitIfFitted()
  }, [
    fitOnOpen,
    spreadIds.length,
    trimWidthMm,
    trimHeightMm,
    viewport.width,
    viewport.height,
  ])
  useEffect(
    () =>
      registerCameraCommands({
        fitSpread: () => {
          cameraRef.current.fitSpread()
        },
        fitWidth: () => {
          cameraRef.current.fitWidth()
        },
        actualSize: () => {
          cameraRef.current.actualSize()
        },
        zoomTo: (zoom) => {
          cameraRef.current.zoomTo(zoom)
        },
        zoomStep: (direction) => {
          cameraRef.current.zoomStep(direction)
        },
        fitSpreadZoom: () => cameraRef.current.fitSpreadZoom(),
      }),
    [],
  )

  useEffect(
    () =>
      subscribeSpreadRevealRequest((spreadId) => {
        const index = getSpreadIdsSnapshot().indexOf(spreadId)
        if (index < 0) {
          return
        }
        forceMountIndexRef.current = index
        preferredActiveRef.current = spreadId
        setActiveId(spreadId)
        reveal.beginRevealForNewSpread(spreadId)
      }),
    [reveal],
  )

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
        const preferred = resolvePreferredActiveId(preferredActiveRef.current)
        preferredActiveRef.current = preferred.preferredId
        const nextId =
          preferred.activeId ??
          pickActiveSpread(
            [...ratios.entries()].map(([id, entry]) => ({
              id,
              ratio: entry.ratio,
              index: entry.index,
            })),
            getActiveSpreadId(),
          )
        if (nextId !== null) {
          startTransition(() => {
            setActiveId(nextId)
          })
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
    // Reveal nudges scroll while holdCameraScrollRef is set; only user scroll
    // releases the add-spread active pin so pickActiveSpread can take over.
    if (!reveal.holdCameraScrollRef.current) {
      preferredActiveRef.current = null
    }
    pendingTop.current = event.currentTarget.scrollTop
    pendingEpoch.current = getCommittedCamera().epoch
    if (scrollRaf.current !== 0) {
      return
    }
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      const top = pendingTop.current
      const epoch = pendingEpoch.current
      startTransition(() => {
        setTrackedScroll((current) => nextTrackedScroll(current, top, epoch))
      })
    })
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || !(event.target instanceof Element)) {
      return
    }
    const slots = event.currentTarget.querySelectorAll('[data-pasteboard-slot]')
    const id = pasteboardClickSpreadId(event.target, event.clientY, [...slots])
    if (id === null) {
      return
    }
    preferredActiveRef.current = id
    setFrameSource(null)
    startTransition(() => {
      setActiveId(id)
    })
  }

  return (
    <div className="pasteboard" data-testid="pasteboard">
      <div
        className="pasteboard-stage"
        data-testid="pasteboard-stage"
        data-rulers={rulersOn ? 'true' : 'false'}
      >
        <div
          ref={scrollRef}
          className="pasteboard-scroll"
          data-testid="pasteboard-scroll"
          data-spread-count={spreadIds.length}
          // Size the camera last followed: the Fit refit runs in the same
          // commit, so a match with clientWidth/Height means it has landed.
          data-viewport-width={viewport.width}
          data-viewport-height={viewport.height}
          role="region"
          aria-label="Spreads"
          tabIndex={0}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
        >
          <PageShadows originPx={PASTEBOARD_PAD_PX} rects={shadowRects} />
          <div
            ref={worldRef}
            className="pasteboard-world"
            data-testid="pasteboard-world"
            data-stack-inset={PASTEBOARD_PAD_PX}
            style={{
              width: worldWidth + 2 * PASTEBOARD_PAD_PX,
              padding: PASTEBOARD_PAD_PX,
              boxSizing: 'border-box',
            }}
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
                  paddingBottom: gapPx,
                  containIntrinsicBlockSize: `auto ${String(stride)}px`,
                  ['--slot-pad' as string]: `${String(gapPx)}px`,
                }}
              >
                <ConnectedSpreadView spreadId={spreadId} pxPerMm={pxPerMm} />
                {pageLabelsFit(gapPx) ? (
                  <PageLabels
                    spreadIndex={range.start + index}
                    pages={getSpreadPageCount(
                      range.start + index,
                      spreadIds.length,
                    )}
                  />
                ) : null}
                <div
                  className="pasteboard-gap"
                  data-testid="pasteboard-gap"
                  data-gap-insert-index={range.start + index + 1}
                  aria-hidden="true"
                >
                  <Icon name="addSpread" size={14} />
                  Drop here for a new spread
                </div>
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
        {rulersOn ? (
          <Rulers scrollRef={scrollRef} pageMm={trimWidthMm} />
        ) : null}
      </div>
      <RelinkHost />
    </div>
  )
})

import {
  memo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type UIEvent,
} from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { SpreadTemplateBar } from './SpreadTemplateBar'
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
  const stride = pasteboardStridePx(trimHeightMm * SPREAD_PX_PER_MM)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportPx, setViewportPx] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRaf = useRef(0)
  const pendingTop = useRef(0)
  const scrollToEnd = useRef(false)

  useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }
    const update = (): void => {
      setViewportPx(node.clientHeight)
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
    if (!scrollToEnd.current) {
      return
    }
    scrollToEnd.current = false
    const node = scrollRef.current
    if (!node) {
      return
    }
    const top = node.scrollHeight
    node.scrollTop = top
    setScrollTop(top)
  }, [spreadIds])

  const onAddSpread = (): void => {
    scrollToEnd.current = true
    dispatchBookOp({ type: 'addSpread' })
  }

  const range = pasteboardWindow({
    count: spreadIds.length,
    stridePx: stride,
    scrollTop,
    viewportPx,
    overscanPx: stride,
  })
  const mounted = spreadIds.slice(range.start, range.end)
  const windowKey = mounted.join('\0')
  const markedId =
    activeId !== null && mounted.includes(activeId) ? activeId : mounted[0]

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
    if (scrollRaf.current !== 0) {
      return
    }
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      setScrollTop((current) =>
        current === pendingTop.current ? current : pendingTop.current,
      )
    })
  }

  return (
    <div className="pasteboard" data-testid="pasteboard">
      <SpreadTemplateBar
        spreadId={markedId ?? null}
        onAddSpread={onAddSpread}
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
              paddingBottom: PASTEBOARD_GAP_PX,
              containIntrinsicBlockSize: `auto ${String(stride)}px`,
            }}
          >
            <ConnectedSpreadView spreadId={spreadId} />
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
  )
})

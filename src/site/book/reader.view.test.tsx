import { createRef, useState, type CSSProperties } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { viewLabel } from '../siteModel'
import { bookInput } from '../siteRoom.test-helpers'
import type { RoomBook } from '../SiteSlide'
import { EASE, TURN } from './motion'
import { BookReader, type ReaderApi } from './reader'
import {
  backShell,
  backingSize,
  followPlan,
  frontShell,
  geoOf,
  glBox,
  openShell,
  paperStrips,
  releasePlan,
  thetaAt,
  turnShell,
} from './readerGeo'
import { paperLayers } from './slidesGeo'

// BookReader on its own: `alps` (11 spreads, 13 views) at 760 × 460, its box
// at 0, 0 (book px = client px, spine at x 380). Frames run by hand: rAF
// callbacks queue until `frame(t)` runs them at performance.now() = t.

const gl = vi.hoisted(() => ({ wanted: false, open: vi.fn() }))
vi.mock('./gl/three', async (real) => ({
  ...(await real<typeof import('./gl/three')>()),
  glWanted: () => gl.wanted,
}))
vi.mock('./roomGl', () => ({ openReaderGl: gl.open }))

const RB: RoomBook = (() => {
  const { book, images, entry } = bookInput()
  return { book, images, entry }
})()
const W = 760
const H = 460
const N = 13
const G = geoOf(RB.entry, W, H, N)

/** followPlan's turn (not a crossfade). */
function turnPlan(...args: Parameters<typeof followPlan>) {
  const plan = followPlan(...args)
  if ('fade' in plan) throw new Error('a crossfade, not a turn')
  return plan
}
/** turnShell with its board leaf. */
function boardShell(a: number, th: number) {
  const s = turnShell(G, a, th)
  if (s.board === null) throw new Error('a paper leaf, not a board')
  return { ...s, board: s.board }
}

let now = 0
let frames: FrameRequestCallback[] = []
let ratio = 1
let reduce = false
/** where the reader sits on screen, scaled by k */
let box = { x: 0, y: 0, k: 1 }

/** Run the queued frames at time t. */
function frame(t: number) {
  now = t
  const run = frames
  frames = []
  act(() => {
    for (const f of run) f(t)
  })
}

beforeEach(() => {
  now = 0
  frames = []
  box = { x: 0, y: 0, k: 1 }
  ratio = 1
  reduce = false
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = []
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(
        box.x,
        box.y,
        (parseFloat(this.style.width) || 0) * box.k,
        (parseFloat(this.style.height) || 0) * box.k,
      )
    },
  )
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduced-motion') ? reduce : q.includes('fine'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        private readonly cb: (e: { intersectionRatio: number }[]) => void,
      ) {}
      observe() {
        this.cb([{ intersectionRatio: ratio }])
      }
      disconnect() {
        return undefined
      }
    },
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  gl.wanted = false
  gl.open.mockReset()
})

function mount({
  start = 0,
  keys = true,
  rb = RB,
}: { start?: number; keys?: boolean; rb?: RoomBook } = {}) {
  const onView = vi.fn()
  const api = createRef<ReaderApi>()
  let setKeys: (k: boolean) => void = () => undefined
  function Host() {
    const [view, setView] = useState(start)
    const [k, setK] = useState(keys)
    setKeys = setK
    return (
      <BookReader
        ref={api}
        rb={rb}
        view={view}
        onView={(v) => {
          onView(v)
          setView(v)
        }}
        width={W}
        keys={k}
      />
    )
  }
  render(<Host />)
  const capture = vi.fn()
  reader().setPointerCapture = capture
  return {
    onView,
    capture,
    api,
    keys: (k: boolean) => {
      act(() => {
        setKeys(k)
      })
    },
  }
}

const reader = () => screen.getByTestId('ps-reader')
const book = () => reader().querySelector<HTMLElement>(':scope > .sd-rbook')
const turnOf = () => reader().dataset.turn
const viewOf = () => Number(reader().dataset.view)

/** The cssText React writes for `style`. */
function cssOf(style: CSSProperties | null | undefined): string {
  const host = document.createElement('div')
  const r = render(<div style={style ?? undefined} />, { container: host })
  const text = (host.firstElementChild as HTMLElement).style.cssText
  r.unmount()
  return text
}
const cssAll = (root: Element | null, sel: string) =>
  [...(root?.querySelectorAll<HTMLElement>(`:scope > ${sel}`) ?? [])].map(
    (el) => el.style.cssText,
  )

function key(k: string, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: k, cancelable: true, ...init })
  act(() => {
    window.dispatchEvent(e)
  })
  return e
}
function ptr(
  type: string,
  x: number,
  { y = H / 2, pointerType = 'mouse', pointerId = 1, button = 0, t = now } = {},
) {
  const e = Object.assign(
    new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button }),
    { pointerId, pointerType },
  )
  Object.defineProperty(e, 'timeStamp', { value: t })
  fireEvent(reader(), e)
}

describe('BookReader at rest', () => {
  it('is a labelled book region sized to its width', () => {
    mount()
    const el = reader()
    expect(el.style.width).toBe('760px')
    expect(el.style.height).toBe('460px')
    expect(el.style.perspective).toBe('1520px')
    expect(el.style.perspectiveOrigin).toBe('50% 50%')
    expect(el.style.getPropertyValue('--site-paper')).toBe(RB.entry.paper)
    expect(el.getAttribute('role')).toBe('region')
    expect(el.getAttribute('aria-roledescription')).toBe('book')
    expect(el.getAttribute('aria-label')).toBe('Alps')
    expect(el.tabIndex).toBe(0)
    expect(el.dataset).toMatchObject({
      view: '0',
      views: '13',
      turn: 'rest',
      cursor: 'Open',
    })
    const live = screen.getByTestId('ps-reader-live')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe(viewLabel(0, 11))
  })

  it('shows the closed front: the board with the cover over it', () => {
    mount()
    const s = frontShell(G)
    expect(book()?.style.cssText).toBe(
      cssOf({ width: W, height: H, transform: s.transform }),
    )
    expect(cssAll(book(), '.sd-board')).toStrictEqual(s.boards.map(cssOf))
    expect(cssAll(book(), '.sd-edge')).toStrictEqual(s.edges.map(cssOf))
    expect(cssAll(book(), '.sd-pg')).toStrictEqual(
      s.pages.map((p) => cssOf(p.style)),
    )
    const cover = book()?.querySelector(':scope > div:not([class])')
    expect((cover as HTMLElement).style.cssText).toBe(cssOf(s.cover))
    expect(cover?.querySelector('.sb-cover')).not.toBeNull()
  })

  it('shows an open spread with its edges, tail and gutter', () => {
    mount({ start: 4 })
    const s = openShell(G, 4)
    expect(book()?.style.cssText).toBe(
      cssOf({ width: W, height: H, transform: s.transform }),
    )
    expect(cssAll(book(), '.sd-board')).toStrictEqual(s.boards.map(cssOf))
    expect(cssAll(book(), '.sd-edge')).toStrictEqual(s.edges.map(cssOf))
    expect(cssAll(book(), '.sd-tail')).toStrictEqual([cssOf(s.tail)])
    expect(cssAll(book(), '.sd-gutter')).toStrictEqual([cssOf(s.gutter)])
    const pages = [...(book()?.querySelectorAll(':scope > .sd-pg') ?? [])]
    expect(cssAll(book(), '.sd-pg')).toStrictEqual(
      s.pages.map((p) => cssOf(p.style)),
    )
    expect(
      pages.filter((pg) => pg.querySelector('.spread-frame') !== null),
    ).toHaveLength(2)
  })

  it('shows the endpaper beside a one-page spread', () => {
    mount({ start: 1 })
    const s = openShell(G, 1)
    const left = s.pages.findIndex((p) => p.side === 'L')
    const pg = book()?.querySelectorAll(':scope > .sd-pg')[left]
    const fill = pg?.querySelector<HTMLElement>(':scope > .sd-fill')
    expect(fill?.style.background).toBe(RB.entry.endpaper)
    expect(pg?.querySelector('.spread-frame')).toBeNull()
  })

  it('shows the closed back board', () => {
    mount({ start: 12 })
    const s = backShell(G)
    expect(book()?.style.cssText).toBe(
      cssOf({ width: W, height: H, transform: s.transform }),
    )
    expect(cssAll(book(), '.sd-board')).toStrictEqual(s.boards.map(cssOf))
    const back = book()?.querySelector(':scope > div:not([class])')
    expect((back as HTMLElement).style.cssText).toBe(cssOf(s.back))
    expect(reader().dataset.cursor).toBe('←')
  })
})

describe('BookReader turns', () => {
  it('opens the board leaf on the clock: cover face out, endpaper behind', () => {
    mount()
    key('ArrowRight')
    const plan = turnPlan(1, 0, N, false, null)
    expect(turnOf()).toBe('anim')
    frame(plan.ms / 2)
    const th = plan.th0 + (plan.th1 - plan.th0) * TURN(0.5)
    const s = boardShell(0, th)
    expect(book()?.style.cssText).toBe(
      cssOf({ width: W, height: H, transform: s.transform }),
    )
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(s.casts.map(cssOf))
    const leaf = screen.getByTestId('ps-leaf')
    expect(leaf.dataset.leaf).toBe('board')
    expect(leaf.style.cssText).toBe(cssOf(s.board.style))
    const [front, back] = [...leaf.children] as HTMLElement[]
    expect(front?.style.cssText).toBe(cssOf(s.board.face))
    expect(back?.className).toBe('sd-face sd-back')
    expect(front?.querySelector('.sb-cover')).not.toBeNull()
    expect((front?.lastElementChild as HTMLElement).style.cssText).toBe(
      cssOf({ background: s.board.frontShade }),
    )
    const endpaper = back?.firstElementChild as HTMLElement
    expect(endpaper.style.cssText).toBe(
      cssOf({
        position: 'absolute',
        ...s.board.endpaper,
        background: RB.entry.endpaper,
      }),
    )
    expect(
      back?.querySelector<HTMLElement>(':scope > .sd-fill')?.style.cssText,
    ).toBe(cssOf({ background: s.board.backShade }))
    frame(plan.ms)
    expect(turnOf()).toBe('rest')
    expect(viewOf()).toBe(1)
  })

  it('closes the back board with the endpaper on its front face', () => {
    mount({ start: 12 })
    key('ArrowLeft')
    const plan = turnPlan(11, 12, N, false, null)
    frame(plan.ms / 4)
    const th = plan.th0 + (plan.th1 - plan.th0) * TURN(0.25)
    const s = boardShell(11, th)
    const leaf = screen.getByTestId('ps-leaf')
    expect(leaf.style.cssText).toBe(cssOf(s.board.style))
    const [front, back] = [...leaf.children] as HTMLElement[]
    expect(front?.querySelector('.sb-cover')).toBeNull()
    expect((front?.firstElementChild as HTMLElement).style.background).toBe(
      RB.entry.endpaper,
    )
    expect(back?.children).toHaveLength(1)
  })

  it('bends a dragged paper leaf into strips under the pointer', () => {
    mount({ start: 4 })
    ptr('pointerdown', 700)
    ptr('pointermove', 600)
    const th = thetaAt(600, 380, 380)
    expect(turnOf()).toBe('drag')
    const s = turnShell(G, 4, th)
    expect(book()?.style.cssText).toBe(
      cssOf({ width: W, height: H, transform: s.transform }),
    )
    const strips = paperStrips(G, th)
    let el: HTMLElement | null =
      book()?.querySelector<HTMLElement>('[data-leaf="paper"]') ?? null
    for (const [i, st] of strips.entries()) {
      if (el === null) throw new Error(`no strip ${String(i)}`)
      expect(el.style.cssText).toBe(cssOf(st.style))
      expect(el.dataset.testid).toBe(
        i === 0 || i === strips.length - 1 ? 'ps-leaf' : undefined,
      )
      const [front, back, inner] = [...el.children] as HTMLElement[]
      expect(front?.style.cssText).toBe(
        'position: absolute; inset: 0; backface-visibility: hidden; overflow: hidden; background: var(--site-paper);',
      )
      expect(back?.style.transform).toBe('rotateY(180deg)')
      expect((front?.firstElementChild as HTMLElement).style.cssText).toBe(
        cssOf({
          position: 'absolute',
          top: 0,
          left: st.frontX,
          width: 380,
          height: H,
        }),
      )
      expect((back?.firstElementChild as HTMLElement).style.left).toBe(
        cssOf({ left: st.backX }).slice('left: '.length, -1),
      )
      const shade = front?.querySelector<HTMLElement>(':scope > .sd-fill')
      expect(shade?.style.cssText).toBe(
        cssOf({
          background: `rgb(255 255 255/${String(st.hi)})`,
          boxShadow: `inset 0 0 0 999px rgb(0 0 0/${String(st.front)})`,
        }),
      )
      expect(
        back?.querySelector<HTMLElement>(':scope > .sd-fill')?.style.cssText,
      ).toBe(cssOf({ background: `rgb(0 0 0/${String(st.back)})` }))
      const grain = (face: HTMLElement | undefined) =>
        [
          ...(face?.querySelectorAll<HTMLElement>(':scope > [aria-hidden]') ??
            []),
        ].map((d) => d.style.cssText)
      expect(grain(front)).toStrictEqual(paperLayers(st.frontX, 380).map(cssOf))
      expect(grain(back)).toStrictEqual(paperLayers(st.backX, 380).map(cssOf))
      el = inner ?? null
    }
    expect(el).toBeNull()
  })

  it('turns a dragged leaf on past the spine and lands on the next view', () => {
    const { onView } = mount({ start: 4 })
    ptr('pointerdown', 700, { t: 0 })
    ptr('pointermove', 600, { t: 100 })
    ptr('pointermove', 300, { t: 200 })
    const th = thetaAt(300, 380, 380)
    const plan = releasePlan(true, th, -3, 300, 4)
    ptr('pointerup', 300, { t: 500 })
    expect(turnOf()).toBe('anim')
    frame(plan.ms / 2)
    const at = th + (plan.to - th) * EASE(0.5)
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(
      turnShell(G, 4, at).casts.map(cssOf),
    )
    frame(plan.ms)
    expect(onView).toHaveBeenCalledExactlyOnceWith(5)
    expect(viewOf()).toBe(5)
    expect(turnOf()).toBe('rest')
  })

  it('flings a short fast drag on, springs a slow one back', () => {
    const { onView } = mount({ start: 4 })
    // 50 px in the last 80 ms: 0.625 px/ms, released 10 ms later
    ptr('pointerdown', 700, { t: 0 })
    ptr('pointermove', 690, { t: 100 })
    ptr('pointermove', 640, { t: 180 })
    ptr('pointerup', 640, { t: 190 })
    frame(5000)
    expect(onView).toHaveBeenCalledExactlyOnceWith(5)
    ptr('pointerdown', 700, { t: 100 })
    ptr('pointermove', 690, { t: 110 })
    ptr('pointermove', 640, { t: 1000 })
    ptr('pointerup', 640, { t: 1010 })
    frame(10000)
    expect(onView).toHaveBeenCalledTimes(1)
    expect(viewOf()).toBe(5)
  })

  it('drags the left page back over the spine', () => {
    const { onView } = mount({ start: 4 })
    ptr('pointerdown', 60, { t: 0 })
    ptr('pointermove', 100, { t: 50 })
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(
      turnShell(G, 3, thetaAt(100, 380, 380)).casts.map(cssOf),
    )
    ptr('pointermove', 500, { t: 100 })
    ptr('pointerup', 500, { t: 300 })
    frame(5000)
    expect(onView).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('drops a drag on cancel and ignores other buttons and pointers', () => {
    const { onView } = mount({ start: 4 })
    ptr('pointerdown', 700)
    ptr('pointermove', 600)
    expect(turnOf()).toBe('drag')
    ptr('pointercancel', 600)
    expect(turnOf()).toBe('rest')
    ptr('pointerup', 600)
    ptr('pointerdown', 700, { button: 2 })
    ptr('pointerup', 700)
    ptr('pointerdown', 700, { pointerId: 1 })
    ptr('pointerup', 700, { pointerId: 2 })
    frame(5000)
    expect(onView).not.toHaveBeenCalled()
  })

  it('does not drag under reduced motion; the release is a click', () => {
    reduce = true
    const { onView } = mount({ start: 4 })
    ptr('pointerdown', 700)
    ptr('pointermove', 600)
    expect(turnOf()).toBe('rest')
    ptr('pointerup', 600)
    expect(onView).toHaveBeenCalledExactlyOnceWith(5)
  })

  it('sets the cursor for the side under the pointer', () => {
    mount({ start: 4 })
    ptr('pointermove', 100)
    expect(reader().dataset.cursor).toBe('←')
    ptr('pointermove', 600)
    expect(reader().dataset.cursor).toBe('→')
  })

  it('lifts the corner under the mouse and lays it back', () => {
    mount({ start: 4 })
    ptr('pointermove', 755, { y: 200 })
    expect(turnOf()).toBe('lift')
    frame(240)
    expect(turnOf()).toBe('lift')
    ptr('pointermove', 600, { y: 200 })
    frame(480)
    expect(turnOf()).toBe('rest')
    ptr('pointermove', 5, { y: 200 })
    expect(turnOf()).toBe('lift')
    fireEvent.pointerLeave(reader())
    frame(1000)
    expect(turnOf()).toBe('rest')
  })

  it('lifts nothing for a touch', () => {
    mount({ start: 4 })
    ptr('pointermove', 755, { y: 200, pointerType: 'touch' })
    expect(turnOf()).toBe('rest')
  })

  it('turns from a lifted corner on a click', () => {
    const { onView } = mount({ start: 4 })
    ptr('pointermove', 755, { y: 200 })
    frame(240)
    ptr('pointerdown', 755, { y: 200 })
    ptr('pointerup', 755, { y: 200 })
    expect(onView).toHaveBeenCalledExactlyOnceWith(5)
    const plan = turnPlan(5, 4, N, false, { a: 4, th: 10, kind: 'lift' })
    expect(plan.th0).toBe(10)
    frame(240 + plan.ms)
    expect(viewOf()).toBe(5)
  })
})

describe('BookReader in a moved, scaled box', () => {
  // the reader at (100, 50) shown at 2×: book x → client 100 + 2x
  const cx = (x: number) => 100 + 2 * x
  const cy = (y: number) => 50 + 2 * y
  beforeEach(() => {
    box = { x: 100, y: 50, k: 2 }
  })

  it('splits the sides at the spine on screen', () => {
    mount({ start: 4 })
    ptr('pointermove', cx(380) - 1)
    expect(reader().dataset.cursor).toBe('←')
    ptr('pointermove', cx(380))
    expect(reader().dataset.cursor).toBe('→')
  })

  it('drags by book px', () => {
    const { onView, capture } = mount({ start: 4 })
    ptr('pointerdown', cx(700), { y: cy(200) })
    ptr('pointermove', cx(600), { y: cy(200) })
    expect(capture).toHaveBeenCalledExactlyOnceWith(1)
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(
      turnShell(G, 4, thetaAt(600, 380, 380)).casts.map(cssOf),
    )
    ptr('pointercancel', cx(600))
    expect(onView).not.toHaveBeenCalled()
  })

  it('lifts the corner by book px', () => {
    mount({ start: 4 })
    ptr('pointermove', cx(600), { y: cy(200) })
    expect(turnOf()).toBe('rest')
    ptr('pointermove', cx(755), { y: cy(200) })
    expect(turnOf()).toBe('lift')
    ptr('pointermove', cx(755), { y: cy(470) })
    frame(1000)
    expect(turnOf()).toBe('rest')
  })

  it('opens a closed book only on a click on the book', () => {
    const { onView } = mount()
    ptr('pointerdown', cx(100))
    ptr('pointerup', cx(100))
    expect(onView).not.toHaveBeenCalled()
    ptr('pointerdown', cx(400))
    ptr('pointerup', cx(400))
    expect(onView).toHaveBeenCalledExactlyOnceWith(1)
  })
})

describe('BookReader pointer intent', () => {
  it('waits out a 3 px mouse move', () => {
    const { capture } = mount({ start: 4 })
    ptr('pointerdown', 700)
    ptr('pointermove', 703)
    expect(turnOf()).toBe('rest')
    expect(capture).not.toHaveBeenCalled()
  })

  it('drags a sideways touch, scrolls a vertical one', () => {
    mount({ start: 4 })
    const touch = { pointerType: 'touch', y: 300 }
    ptr('pointerdown', 700, touch)
    ptr('pointermove', 680, touch)
    expect(turnOf()).toBe('drag')
    ptr('pointercancel', 680, touch)
    ptr('pointerdown', 700, touch)
    ptr('pointermove', 698, { ...touch, y: 340 })
    ptr('pointermove', 600, { ...touch, y: 340 })
    expect(turnOf()).toBe('rest')
  })

  it('follows only the pointer that went down', () => {
    mount({ start: 4 })
    ptr('pointerdown', 700)
    ptr('pointermove', 600, { pointerId: 2 })
    expect(turnOf()).toBe('rest')
  })

  it('lays a lifted corner back the way it came', () => {
    mount({ start: 4 })
    ptr('pointermove', 755, { y: 200 })
    frame(240)
    ptr('pointermove', 600, { y: 200 })
    frame(360)
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(
      turnShell(G, 4, 10 - 10 * EASE(0.5)).casts.map(cssOf),
    )
    frame(1000)
    ptr('pointermove', 5, { y: 200 })
    frame(1240)
    ptr('pointermove', 300, { y: 200 })
    frame(1360)
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(
      turnShell(G, 3, 170 + 10 * EASE(0.5)).casts.map(cssOf),
    )
  })

  it('times a turn from its start', () => {
    mount({ start: 4 })
    now = 1000
    key('ArrowRight')
    const plan = turnPlan(5, 4, N, false, null)
    frame(1000 + plan.ms / 2)
    expect(cssAll(book(), '.sd-cast')).toStrictEqual(
      turnShell(G, 4, 180 * TURN(0.5)).casts.map(cssOf),
    )
  })
})

describe('BookReader keys and jumps', () => {
  it('takes window keys by default', () => {
    const onView = vi.fn()
    render(<BookReader rb={RB} view={4} onView={onView} width={W} />)
    key('ArrowRight')
    expect(onView).toHaveBeenCalledExactlyOnceWith(5)
  })

  it('drops a press queued past the end', () => {
    const { onView } = mount({ start: 11 })
    key('ArrowRight')
    key('ArrowRight')
    frame(5000)
    frame(10000)
    expect(onView.mock.calls).toStrictEqual([[12]])
  })

  it('turns per arrow when at least half in view', () => {
    ratio = 0.5
    const { onView } = mount({ start: 4 })
    const e = key('ArrowRight')
    expect(e.defaultPrevented).toBe(true)
    expect(onView).toHaveBeenCalledExactlyOnceWith(5)
  })

  it('leaves the keys alone when under half in view or off', () => {
    ratio = 0.49
    const { onView } = mount({ start: 4 })
    expect(key('ArrowRight').defaultPrevented).toBe(false)
    cleanup()
    ratio = 1
    const off = mount({ start: 4, keys: false })
    key('ArrowRight')
    off.keys(true)
    key('ArrowRight')
    off.keys(false)
    key('End')
    expect(onView).not.toHaveBeenCalled()
    expect(off.onView).toHaveBeenCalledExactlyOnceWith(5)
  })

  it('goes to the last spread on End and the cover on Home, crossfading', () => {
    const { onView } = mount({ start: 4 })
    key('End')
    expect(onView).toHaveBeenLastCalledWith(11)
    expect(turnOf()).toBe('fade')
    const [fade] = reader().getElementsByClassName('sd-fade') as unknown as [
      HTMLElement,
    ]
    expect(fade.style.getPropertyValue('--fd')).toBe('240ms')
    expect(viewOf()).toBe(11)
    act(() => {
      fireEvent.animationEnd(fade)
    })
    expect(reader().querySelector('.sd-fade')).toBeNull()
    expect(turnOf()).toBe('rest')
    key('Home')
    expect(onView).toHaveBeenLastCalledWith(0)
  })

  it('queues one press made mid-turn and runs it after the landing', () => {
    const { onView } = mount({ start: 4 })
    key('ArrowRight')
    key('ArrowRight')
    key('ArrowLeft')
    expect(onView).toHaveBeenCalledTimes(1)
    frame(5000)
    expect(onView).toHaveBeenLastCalledWith(6)
    frame(10000)
    expect(viewOf()).toBe(6)
    expect(onView).toHaveBeenCalledTimes(2)
  })

  it('stays put past either end', () => {
    const { onView } = mount({ start: 12 })
    key('ArrowRight')
    cleanup()
    const first = mount()
    key('ArrowLeft')
    expect(onView).not.toHaveBeenCalled()
    expect(first.onView).not.toHaveBeenCalled()
  })

  it('jumps without a turn or a fade, clamped to the book', () => {
    const { api, onView } = mount({ start: 4 })
    act(() => {
      api.current?.jump(99)
    })
    expect(onView).toHaveBeenLastCalledWith(12)
    expect(viewOf()).toBe(12)
    expect(turnOf()).toBe('rest')
    expect(reader().querySelector('.sd-fade')).toBeNull()
    act(() => {
      api.current?.jump(-5)
    })
    expect(viewOf()).toBe(0)
    act(() => {
      api.current?.go(1)
    })
    expect(onView).toHaveBeenLastCalledWith(1)
  })

  it('drops a queued press on a jump', () => {
    const { api, onView } = mount({ start: 4 })
    key('ArrowRight')
    key('ArrowRight')
    act(() => {
      api.current?.jump(8)
    })
    frame(5000)
    frame(10000)
    expect(onView.mock.calls.map(([v]) => v as number)).toStrictEqual([5, 8])
    expect(viewOf()).toBe(8)
  })

  it('crossfades a step under reduced motion', () => {
    reduce = true
    mount({ start: 4 })
    key('ArrowRight')
    expect(turnOf()).toBe('fade')
    expect(
      reader()
        .querySelector<HTMLElement>('.sd-fade')
        ?.style.getPropertyValue('--fd'),
    ).toBe('160ms')
  })
})

describe('BookReader with WebGL', () => {
  function fakeGl(loading = false) {
    return {
      book: {
        set: vi.fn(),
        frame: vi.fn(),
        dispose: vi.fn(),
        onChange: () => undefined,
        loading,
      },
      faces: { focus: vi.fn(), dispose: vi.fn() },
      draw: vi.fn(),
    }
  }
  const flush = async () => {
    await act(async () => {
      await vi.dynamicImportSettled()
      await Promise.resolve()
    })
  }
  async function glMount(made = fakeGl(), start = 4) {
    gl.wanted = true
    gl.open.mockResolvedValue(made)
    const m = mount({ start })
    await flush()
    return { ...m, made }
  }
  const canvas = () => screen.getByTestId<HTMLCanvasElement>('ps-reader-canvas')

  it('opens no GL book for a reader gone before the module loads', async () => {
    gl.wanted = true
    mount()
    cleanup()
    await flush()
    expect(gl.open).not.toHaveBeenCalled()
  })

  it('marks the back board closing as a board leaf', async () => {
    await glMount(fakeGl(), 12)
    key('ArrowLeft')
    frame(50)
    expect(screen.getByTestId('ps-leaf').dataset.leaf).toBe('board')
  })

  it('opens the GL book for the room book at the page size of its width', async () => {
    await glMount()
    expect(gl.open).toHaveBeenCalledExactlyOnceWith({ ...RB, pagePx: 1024 })
  })

  it('places the canvas over its box and sizes its backing to the device', async () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const { made } = await glMount()
    const box = glBox(W, H)
    const place = {
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      pointerEvents: 'none',
    } as const
    expect(canvas().style.cssText).toBe(cssOf(place))
    expect(canvas().getAttribute('role')).toBe('img')
    expect(canvas().getAttribute('aria-label')).toBe(viewLabel(4, 11))
    const over = canvas().nextElementSibling as HTMLCanvasElement
    expect(over.style.cssText).toBe(cssOf({ ...place, opacity: 0 }))
    const size = backingSize(box, 2)
    expect([canvas().width, canvas().height]).toStrictEqual([size.w, size.h])
    expect(made.book.frame).toHaveBeenLastCalledWith(
      W,
      H,
      W / (2 * (RB.entry.trimMm.w / 10) + 10),
      box,
    )
    expect(made.draw).toHaveBeenLastCalledWith(canvas())
    expect(made.book.set).toHaveBeenLastCalledWith(4, 0)
    expect(made.faces.focus).toHaveBeenLastCalledWith(4)
  })

  it('reports faces still loading, redraws when a texture lands', async () => {
    const { made } = await glMount(fakeGl(true))
    expect(screen.getByTestId('ps-reader-gl').dataset.faces).toBe('loading')
    const draws = made.draw.mock.calls.length
    act(() => {
      made.book.onChange()
    })
    expect(made.draw).toHaveBeenCalledTimes(draws + 1)
  })

  it('poses the GL book mid-turn and marks the leaf for tests', async () => {
    const { made } = await glMount()
    key('ArrowRight')
    const plan = turnPlan(5, 4, N, false, null)
    frame(plan.ms / 2)
    const th = TURN(0.5) * 180
    expect(made.book.set).toHaveBeenLastCalledWith(4, th)
    const leaf = screen.getByTestId('ps-leaf')
    expect(leaf.dataset.leaf).toBe('paper')
    expect(leaf.dataset.theta).toBe(th.toFixed(1))
    expect(leaf.getAttribute('aria-hidden')).toBe('true')
    frame(plan.ms)
    expect(made.faces.focus).toHaveBeenLastCalledWith(5)
    expect(screen.queryByTestId('ps-leaf')).toBeNull()
  })

  it('marks a board leaf turning off the cover', async () => {
    await glMount(fakeGl(), 0)
    key('ArrowRight')
    frame(50)
    expect(screen.getByTestId('ps-leaf').dataset.leaf).toBe('board')
  })

  it('rests the closed back as the back board at 180', async () => {
    const { made } = await glMount(fakeGl(), 12)
    expect(made.book.set).toHaveBeenLastCalledWith(11, 180)
  })

  it('snapshots the last frame into the overlay for a crossfade, once', async () => {
    const fade = { onfinish: null as (() => void) | null }
    const animate = vi.fn(() => fade as never)
    HTMLCanvasElement.prototype.animate = animate
    const { made } = await glMount()
    key('End')
    expect(animate).toHaveBeenCalledExactlyOnceWith(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 240, easing: 'linear', fill: 'forwards' },
    )
    const over = canvas().nextElementSibling as HTMLCanvasElement
    expect([over.width, over.height]).toStrictEqual([
      canvas().width,
      canvas().height,
    ])
    act(() => {
      made.book.onChange()
    })
    expect(animate).toHaveBeenCalledTimes(1)
    expect(turnOf()).toBe('fade')
    act(() => {
      fade.onfinish?.()
    })
    expect(turnOf()).toBe('rest')
  })

  it('lets go of the GL book when the reader goes', async () => {
    const { made } = await glMount()
    cleanup()
    expect(made.book.dispose).toHaveBeenCalledTimes(1)
    expect(made.faces.dispose).toHaveBeenCalledTimes(1)
  })

  it('stays on the CSS book for a host-painted book', async () => {
    gl.wanted = true
    mount({ rb: { ...RB, renderSlide: () => null } })
    await flush()
    expect(gl.open).not.toHaveBeenCalled()
    expect(screen.queryByTestId('ps-reader-gl')).toBeNull()
  })

  it('does not report a failure after the reader is gone', async () => {
    gl.wanted = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let fail: (e: Error) => void = () => undefined
    gl.open.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject
      }),
    )
    mount()
    await flush()
    cleanup()
    fail(new Error('lost'))
    await flush()
    expect(warn).not.toHaveBeenCalled()
  })
})

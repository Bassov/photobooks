import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpreadPager } from './SpreadPager'

function Harness({
  count = 3,
  start = 0,
  onExit = () => undefined,
}: {
  count?: number
  start?: number
  onExit?: () => void
}) {
  const [index, setIndex] = useState(start)
  return (
    <SpreadPager
      count={count}
      index={index}
      onIndexChange={setIndex}
      onExit={onExit}
      renderSpread={(i) => <div data-testid={`spread-${String(i)}`} />}
    />
  )
}

const position = () => screen.getByTestId('pager-position').textContent

const firstShadowBox = () =>
  screen.getAllByTestId('presentation-slide')[0]?.firstElementChild as
    HTMLElement | null | undefined

const firstFit = () =>
  firstShadowBox()?.firstElementChild as HTMLElement | null | undefined

function stubSizes(sizes: {
  w: number
  h: number
  stageW: number
  stageH: number
}) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(sizes.w)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(
    sizes.h,
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
    sizes.stageW,
  )
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
    sizes.stageH,
  )
}

function stubStageRect(stage: HTMLElement) {
  stage.getBoundingClientRect = () =>
    ({ left: 0, width: 100 }) as unknown as DOMRect
}

describe('SpreadPager', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('moves with arrow keys and Space, and stops at the last spread', () => {
    render(<Harness />)
    expect(position()).toBe('1 / 3')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: ' ' })
    expect(position()).toBe('3 / 3')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(position()).toBe('3 / 3')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(position()).toBe('2 / 3')
  })

  it('writes the position line with a custom label', () => {
    const label = vi.fn(
      (i: number, n: number) => `item ${String(i)} of ${String(n)}`,
    )
    render(
      <SpreadPager
        count={4}
        index={2}
        onIndexChange={() => undefined}
        onExit={() => undefined}
        renderSpread={() => null}
        position={label}
      />,
    )
    expect(position()).toBe('item 2 of 4')
    expect(label).toHaveBeenCalledWith(2, 4)
  })

  it('leaves the position line empty without spreads', () => {
    const label = vi.fn(() => 'never')
    render(
      <SpreadPager
        count={0}
        index={0}
        onIndexChange={() => undefined}
        onExit={() => undefined}
        renderSpread={() => null}
        position={label}
      />,
    )
    expect(position()).toBe('')
    expect(label).not.toHaveBeenCalled()
  })

  it('exits on Escape and on the exit button', () => {
    const onExit = vi.fn()
    render(<Harness onExit={onExit} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('presentation-exit'))
    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('pages by clicking either half', () => {
    render(<Harness start={1} />)
    const stage = screen.getByTestId('presentation')
    stubStageRect(stage)
    fireEvent.click(stage, { clientX: 80 })
    expect(position()).toBe('3 / 3')
    fireEvent.click(stage, { clientX: 20 })
    expect(position()).toBe('2 / 3')
  })

  it('pages by swipe and swallows the click that follows it', () => {
    render(<Harness start={1} />)
    const stage = screen.getByTestId('presentation')
    stubStageRect(stage)
    // Pointer-up without a pointer-down is not a swipe.
    fireEvent.pointerUp(stage, { clientX: 10 })
    expect(position()).toBe('2 / 3')
    fireEvent.pointerDown(stage, { clientX: 300 })
    fireEvent.pointerUp(stage, { clientX: 100 })
    expect(position()).toBe('3 / 3')
    // The click after a swipe would page back (left half); it is swallowed.
    fireEvent.click(stage, { clientX: 10 })
    expect(position()).toBe('3 / 3')
    // Swallowing happens once: the next plain click pages again.
    fireEvent.click(stage, { clientX: 10 })
    expect(position()).toBe('2 / 3')
  })

  it('swipes back, and a short tap after a swipe pages by its click', () => {
    render(<Harness start={1} />)
    const stage = screen.getByTestId('presentation')
    stubStageRect(stage)
    fireEvent.pointerDown(stage, { clientX: 100 })
    fireEvent.pointerUp(stage, { clientX: 300 })
    expect(position()).toBe('1 / 3')
    fireEvent.pointerDown(stage, { clientX: 50 })
    fireEvent.pointerUp(stage, { clientX: 50 })
    fireEvent.click(stage, { clientX: 90 })
    expect(position()).toBe('2 / 3')
  })

  it('does not page when the exit button is clicked', () => {
    const onExit = vi.fn()
    render(<Harness start={1} onExit={onExit} />)
    stubStageRect(screen.getByTestId('presentation'))
    fireEvent.click(screen.getByTestId('presentation-exit'), { clientX: 90 })
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(position()).toBe('2 / 3')
  })

  it('marks neighbours inert and offsets slides by 100% per spread', () => {
    render(<Harness start={1} />)
    const slides = screen.getAllByTestId('presentation-slide')
    expect(slides.map((el) => el.dataset.active)).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(slides.map((el) => el.style.transform)).toEqual([
      'translateX(-100%)',
      'translateX(0%)',
      'translateX(100%)',
    ])
    expect(slides.map((el) => el.getAttribute('aria-hidden'))).toEqual([
      'true',
      null,
      'true',
    ])
    expect(slides.map((el) => el.hasAttribute('inert'))).toEqual([
      true,
      false,
      true,
    ])
  })

  it('handles paging keys before bubbling listeners and ignores others', () => {
    const onExit = vi.fn()
    const bubbled = vi.fn()
    document.addEventListener('keydown', bubbled)
    render(<Harness onExit={onExit} />)
    for (const key of ['ArrowRight', ' ', 'ArrowLeft', 'Escape']) {
      expect(fireEvent.keyDown(document.body, { key }), key).toBe(false)
    }
    expect(bubbled).not.toHaveBeenCalled()
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(fireEvent.keyDown(document.body, { key: 'a' })).toBe(true)
    expect(bubbled).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', bubbled)
  })

  it('stops handling keys after unmount', () => {
    const onExit = vi.fn()
    const { unmount } = render(<Harness onExit={onExit} />)
    unmount()
    expect(fireEvent.keyDown(window, { key: 'Escape' })).toBe(true)
    expect(onExit).not.toHaveBeenCalled()
  })

  it('takes focus on open, keeps Tab inside and returns focus to the opener', () => {
    const opener = document.createElement('button')
    const behind = document.createElement('button')
    document.body.append(opener, behind)
    opener.focus()
    const bubbled = vi.fn()
    document.addEventListener('keydown', bubbled)
    const { unmount } = render(<Harness />)
    const stage = screen.getByTestId('presentation')
    expect(document.activeElement).toBe(stage)
    // Focusable by script only: never a stop in the page's Tab order.
    expect(stage.getAttribute('tabindex')).toBe('-1')
    for (const shiftKey of [false, false, true, true]) {
      const key = { key: 'Tab', shiftKey }
      expect(
        fireEvent.keyDown(document.activeElement ?? document.body, key),
      ).toBe(false)
      expect(document.activeElement).toBe(
        screen.getByTestId('presentation-exit'),
      )
    }
    expect(bubbled).not.toHaveBeenCalled()
    unmount()
    expect(document.activeElement).toBe(opener)
    document.removeEventListener('keydown', bubbled)
    opener.remove()
    behind.remove()
  })

  it('skips the focus return when the opener is gone', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(<Harness />)
    opener.remove()
    const focus = vi.spyOn(opener, 'focus')
    unmount()
    expect(focus).not.toHaveBeenCalled()
  })

  it('does not report an index change at the edges', () => {
    const onIndexChange = vi.fn()
    render(
      <SpreadPager
        count={2}
        index={1}
        onIndexChange={onIndexChange}
        onExit={() => undefined}
        renderSpread={() => null}
      />,
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onIndexChange).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onIndexChange).toHaveBeenCalledWith(0)
  })

  it('ignores unrelated keys', () => {
    const onExit = vi.fn()
    render(<Harness onExit={onExit} />)
    expect(fireEvent.keyDown(window, { key: 'a' })).toBe(true)
    expect(onExit).not.toHaveBeenCalled()
    expect(position()).toBe('1 / 3')
  })

  it('scales the spread to fit the stage', () => {
    stubSizes({ w: 1000, h: 500, stageW: 2000, stageH: 1064 })
    render(<Harness />)
    // min(2000*.94/1000, (1064-64)*.96/500) = min(1.88, 1.92)
    // `zoom` lays the spread out at its on-screen size (no scale transform).
    expect(firstFit()?.style.zoom).toBe('1.88')
    expect(firstFit()?.style.transform).toBe('')
    // The shadow box stays unzoomed and wraps the zoomed spread exactly.
    expect(firstShadowBox()?.style.width).toBe('1880px')
    expect(firstShadowBox()?.style.height).toBe('940px')
    expect(firstShadowBox()?.style.transform).toBe('')
  })

  it('lets the height bound the scale when the stage is wide', () => {
    stubSizes({ w: 1000, h: 500, stageW: 4000, stageH: 1064 })
    render(<Harness />)
    expect(firstFit()?.style.zoom).toBe('1.92')
  })

  it.each([
    ['width', 0, 500],
    ['height', 1000, 0],
  ])('keeps scale 1 while the spread has no %s', (_, w, h) => {
    stubSizes({ w, h, stageW: 2000, stageH: 1064 })
    render(<Harness />)
    expect(firstFit()?.style.zoom).toBe('1')
    expect(firstShadowBox()?.style.width).toBe('0px')
  })

  it('observes stage and spread, re-observes per index, disconnects on unmount', () => {
    const observed: Element[] = []
    const disconnect = vi.fn()
    let created = 0
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          created += 1
        }
        observe(el: Element) {
          observed.push(el)
        }
        disconnect = disconnect
      },
    )
    const { unmount } = render(<Harness />)
    expect(created).toBe(1)
    expect(observed[0]).toBe(screen.getByTestId('presentation'))
    expect(observed[1]).toBe(firstFit())
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(created).toBe(2)
    expect(disconnect).toHaveBeenCalledTimes(1)
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(2)
  })

  it('re-renders on a resize only when scale, width or height changed', () => {
    let measure: () => void = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          measure = cb
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    const sizes = { w: 1000, h: 500, stageW: 2000, stageH: 1064 }
    stubSizes(sizes)
    const renderSpread = vi.fn(() => null)
    render(
      <SpreadPager
        count={1}
        index={0}
        onIndexChange={() => undefined}
        onExit={() => undefined}
        renderSpread={renderSpread}
      />,
    )
    const box = () => firstShadowBox()
    expect(box()?.style.width).toBe('1880px')
    const baseline = renderSpread.mock.calls.length

    // Same measurements: state is kept, nothing re-renders.
    act(() => {
      measure()
    })
    expect(renderSpread).toHaveBeenCalledTimes(baseline)

    // Height only: the scale stays width-bound (1.88), the height grows.
    sizes.h = 450
    stubSizes(sizes)
    act(() => {
      measure()
    })
    expect(renderSpread.mock.calls.length).toBeGreaterThan(baseline)
    expect(firstFit()?.style.zoom).toBe('1.88')
    expect(parseFloat(box()?.style.height ?? '')).toBeCloseTo(846, 6)
    expect(box()?.style.width).toBe('1880px')

    // Stage only: the spread size is unchanged, the scale alone differs.
    const afterHeight = renderSpread.mock.calls.length
    sizes.stageW = 1000
    stubSizes(sizes)
    act(() => {
      measure()
    })
    expect(renderSpread.mock.calls.length).toBeGreaterThan(afterHeight)
    expect(firstFit()?.style.zoom).toBe('0.94')

    // Width halves while the stage halves too: the scale is back to 1.88.
    sizes.w = 500
    sizes.stageW = 1000
    stubSizes(sizes)
    act(() => {
      measure()
    })
    expect(firstFit()?.style.zoom).toBe('1.88')
    expect(box()?.style.width).toBe('940px')
  })

  it('renders no slides or position for an empty book and still exits', () => {
    const onExit = vi.fn()
    render(<Harness count={0} onExit={onExit} />)
    expect(screen.queryAllByTestId('presentation-slide')).toHaveLength(0)
    expect(position()).toBe('')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('keeps only the current spread and its neighbours mounted', () => {
    render(<Harness count={5} start={2} />)
    expect(screen.getAllByTestId('presentation-slide')).toHaveLength(3)
    expect(screen.getByTestId('spread-1')).toBeTruthy()
    expect(screen.getByTestId('spread-3')).toBeTruthy()
    expect(screen.queryByTestId('spread-0')).toBeNull()
  })
})

function LightboxHarness({
  count = 3,
  start = 0,
  onExit = () => undefined,
}: {
  count?: number
  start?: number
  onExit?: () => void
}) {
  const [index, setIndex] = useState(start)
  return (
    <SpreadPager
      variant="lightbox"
      ariaLabel="Alps — fullscreen"
      testId="lightbox"
      count={count}
      index={index}
      onIndexChange={setIndex}
      onExit={onExit}
      renderSpread={(i) => <div data-testid={`spread-${String(i)}`} />}
    />
  )
}

/** Alps 190×230 spread (380 × 230 natural) in a 1440 × 900 viewport. */
function stubAlps(hover = true) {
  stubSizes({ w: 380, h: 230, stageW: 1440, stageH: 900 })
  vi.stubGlobal('matchMedia', () => ({
    matches: hover,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

const lightbox = () => screen.getByTestId('lightbox')
const activeSlide = () =>
  screen
    .getAllByTestId('lightbox-slide')
    .find((slide) => slide.dataset.active === 'true')
/** By label: an inert arrow is out of the accessibility tree. */
const arrow = (name: string) => {
  const el = document.querySelector<HTMLElement>(`[aria-label="${name}"]`)
  if (el === null) throw new Error(`no ${name}`)
  return el
}

describe('SpreadPager lightbox', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fits the slide inside the control insets as a named dialog', () => {
    stubAlps()
    render(<LightboxHarness />)
    const style = activeSlide()?.style
    expect(Number.parseFloat(style?.left ?? '')).toBeCloseTo(69.04, 2)
    expect(style?.top).toBe('64px')
    expect(Number.parseFloat(style?.width ?? '')).toBeCloseTo(1301.91, 2)
    expect(style?.height).toBe('788px')
    expect(lightbox().getAttribute('role')).toBe('dialog')
    expect(lightbox().getAttribute('aria-label')).toBe('Alps — fullscreen')
    expect(lightbox().dataset.zoom).toBe('1.00')
    expect(screen.queryByTestId('presentation')).toBeNull()
    expect(screen.queryByText('Esc')).toBeNull()
  })

  it('labels Close and Zoom, and hides the arrows at the ends', () => {
    stubAlps()
    render(<LightboxHarness count={2} />)
    const close = screen.getByTestId('site-fullscreen-close')
    expect(close.getAttribute('aria-label')).toBe('Exit fullscreen')
    expect(close.getAttribute('title')).toBe('Close (Esc)')
    expect(
      screen.getByTestId('site-fullscreen-zoom').getAttribute('aria-label'),
    ).toBe('Zoom in')
    expect(arrow('Previous spread').style.visibility).toBe('hidden')
    expect(arrow('Previous spread').hasAttribute('inert')).toBe(true)
    expect(arrow('Next spread').style.visibility).toBe('')
    fireEvent.click(arrow('Next spread'))
    expect(arrow('Next spread').style.visibility).toBe('hidden')
    expect(arrow('Previous spread').style.visibility).toBe('')
  })

  it('has no arrows and 8 px sides without a hover pointer', () => {
    stubAlps(false)
    render(<LightboxHarness />)
    expect(screen.queryByRole('button', { name: 'Next spread' })).toBeNull()
    expect(Number.parseFloat(activeSlide()?.style.left ?? '')).toBeCloseTo(
      69.04,
      2,
    )
    // Height-bound: the narrower sides do not widen the Alps spread.
    expect(activeSlide()?.style.height).toBe('788px')
  })

  it('does not page or close on a click on the spread or the backdrop', () => {
    stubAlps()
    const onExit = vi.fn()
    render(<LightboxHarness onExit={onExit} />)
    fireEvent.click(screen.getByTestId('spread-0'))
    fireEvent.click(lightbox(), { clientX: 1400, clientY: 450 })
    expect(screen.getByTestId('site-fullscreen-indicator').textContent).toBe(
      '1 / 3',
    )
    expect(onExit).not.toHaveBeenCalled()
  })

  it('steps with the arrows, Space, Home and End', () => {
    stubAlps()
    render(<LightboxHarness count={5} />)
    const at = () => screen.getByTestId('site-fullscreen-indicator').textContent
    fireEvent.keyDown(window, { key: 'End' })
    expect(at()).toBe('5 / 5')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(at()).toBe('4 / 5')
    fireEvent.keyDown(window, { key: 'Home' })
    expect(at()).toBe('1 / 5')
    fireEvent.keyDown(window, { key: ' ' })
    expect(at()).toBe('2 / 5')
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    expect(at()).toBe('2 / 5')
  })

  it('closes on Esc while zoomed in', () => {
    stubAlps()
    const onExit = vi.fn()
    render(<LightboxHarness onExit={onExit} />)
    fireEvent.click(screen.getByTestId('site-fullscreen-zoom'))
    expect(lightbox().dataset.zoom).toBe('2.00')
    expect(
      screen.getByTestId('site-fullscreen-zoom').getAttribute('aria-label'),
    ).toBe('Zoom out')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('site-fullscreen-close'))
    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('opens the next slide at 1× while the old one slides away at its zoom', () => {
    stubAlps()
    render(<LightboxHarness />)
    fireEvent.keyDown(window, { key: '+' })
    expect(lightbox().dataset.zoom).toBe('1.50')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(lightbox().dataset.zoom).toBe('1.00')
    const old = screen.getAllByTestId('lightbox-slide')[0]
    expect(old?.dataset.active).toBe('false')
    expect(
      (old?.firstElementChild as HTMLElement | null)?.style.transform,
    ).toContain('scale(1.5)')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(lightbox().dataset.zoom).toBe('1.00')
  })

  it('keeps Tab on Previous, Next, Zoom and Close', () => {
    stubAlps()
    render(<LightboxHarness start={1} />)
    expect(document.activeElement).toBe(lightbox())
    const names: (string | null)[] = []
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(window, { key: 'Tab' })
      names.push(document.activeElement?.getAttribute('aria-label') ?? null)
    }
    expect(names).toStrictEqual([
      'Previous spread',
      'Next spread',
      'Zoom in',
      'Exit fullscreen',
      'Previous spread',
    ])
  })
})

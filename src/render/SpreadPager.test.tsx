import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    expect(firstFit()?.style.transform).toBe('scale(1.88)')
    // The shadow box stays unscaled and wraps the scaled spread exactly.
    expect(firstShadowBox()?.style.width).toBe('1880px')
    expect(firstShadowBox()?.style.height).toBe('940px')
    expect(firstShadowBox()?.style.transform).toBe('')
  })

  it('lets the height bound the scale when the stage is wide', () => {
    stubSizes({ w: 1000, h: 500, stageW: 4000, stageH: 1064 })
    render(<Harness />)
    expect(firstFit()?.style.transform).toBe('scale(1.92)')
  })

  it.each([
    ['width', 0, 500],
    ['height', 1000, 0],
  ])('keeps scale 1 while the spread has no %s', (_, w, h) => {
    stubSizes({ w, h, stageW: 2000, stageH: 1064 })
    render(<Harness />)
    expect(firstFit()?.style.transform).toBe('scale(1)')
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

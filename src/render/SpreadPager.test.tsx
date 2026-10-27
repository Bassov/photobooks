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

describe('SpreadPager', () => {
  afterEach(() => {
    cleanup()
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
    stage.getBoundingClientRect = () =>
      ({ left: 0, width: 100 }) as unknown as DOMRect
    fireEvent.click(stage, { clientX: 80 })
    expect(position()).toBe('3 / 3')
    fireEvent.click(stage, { clientX: 20 })
    expect(position()).toBe('2 / 3')
  })

  it('pages by swipe without a trailing click double-step', () => {
    render(<Harness />)
    const stage = screen.getByTestId('presentation')
    stage.getBoundingClientRect = () =>
      ({ left: 0, width: 100 }) as unknown as DOMRect
    fireEvent.pointerUp(stage, { clientX: 10 })
    fireEvent.pointerDown(stage, { clientX: 300 })
    fireEvent.pointerUp(stage, { clientX: 100 })
    fireEvent.click(stage, { clientX: 90 })
    expect(position()).toBe('2 / 3')
  })

  it('ignores unrelated keys', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: 'a' })
    expect(position()).toBe('1 / 3')
  })

  it('scales the spread to fit the stage', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(500)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(2000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1064)
    render(<Harness />)
    const fit = screen.getAllByTestId('presentation-slide')[0]
      ?.firstElementChild as HTMLElement | null | undefined
    // min(2000*.94/1000, (1064-64)*.96/500) = min(1.88, 1.92)
    expect(fit?.style.transform).toBe('scale(1.88)')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

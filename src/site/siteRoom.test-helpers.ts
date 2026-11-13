import { act, fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { sampleSiteInput } from './sampleSite'

/** A sample book page input (`alps` portrait, `sea` landscape, `lake` square). */
export function bookInput(id = 'alps') {
  const input = sampleSiteInput(`?book=${id}`)
  if (input.kind !== 'book') throw new Error('sample book missing')
  return input
}

/**
 * The room box (it measures itself) and the media it reads: no GL in
 * happy-dom (the CSS reader), a fine pointer; `reduce`: reduced motion;
 * `inView`: the reader is in view (its window keys are live).
 */
export function stubBox(
  w: number,
  h: number,
  { reduce = false, inView = false } = {},
) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(h)
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduced-motion') ? reduce : q.includes('fine'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        return undefined
      }
      disconnect() {
        return undefined
      }
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        private readonly cb: (e: { intersectionRatio: number }[]) => void,
      ) {}
      observe() {
        this.cb([{ intersectionRatio: inView ? 1 : 0 }])
      }
      disconnect() {
        return undefined
      }
    },
  )
}

export const id = (testId: string) => screen.queryByTestId(testId)
export const label = () => id('site-label')?.textContent

export function key(k: string, target: Element | Window = window) {
  act(() => {
    fireEvent.keyDown(target, { key: k })
  })
}

/** A pointer event of `pointerType` on `el` at (x, y), stamped at `t` ms. */
export function pointer(
  el: Element,
  type: string,
  x: number,
  y: number,
  { id: pointerId = 1, kind = 'touch', t = 1 } = {},
) {
  const e = Object.assign(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
    { pointerId, pointerType: kind },
  )
  Object.defineProperty(e, 'timeStamp', { value: t })
  fireEvent(el, e)
}

/** The inline style values of `el` (px values as numbers). */
export function px(el: Element | null, prop: string): number {
  if (!(el instanceof HTMLElement)) throw new Error('no element')
  return parseFloat(el.style.getPropertyValue(prop))
}

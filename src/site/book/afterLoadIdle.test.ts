import { describe, expect, it, vi } from 'vitest'
import { afterLoadIdle, type IdleWindow } from './afterLoadIdle'

/** a window stand-in: `load` events, the document's ready state, idle / timer queues */
function fakeWindow(readyState: DocumentReadyState, idle: boolean) {
  const events = new EventTarget()
  const queue: (() => void)[] = []
  const timer = vi.fn((f: () => void) => queue.push(f))
  const win = {
    document: { readyState },
    addEventListener: events.addEventListener.bind(events),
    setTimeout: timer,
    ...(idle ? { requestIdleCallback: (f: () => void) => queue.push(f) } : {}),
  }
  return {
    win: win as unknown as IdleWindow,
    timer,
    load: () => events.dispatchEvent(new Event('load')),
    queue,
  }
}

const settled = async (p: Promise<void>): Promise<boolean> => {
  let done = false
  void p.then(() => {
    done = true
  })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

describe('afterLoadIdle', () => {
  it('waits for the next idle once the page has loaded', async () => {
    const { win, timer, queue } = fakeWindow('complete', true)

    const p = afterLoadIdle(win)

    expect(await settled(p)).toBe(false)
    expect(timer).not.toHaveBeenCalled()
    queue.forEach((f) => {
      f()
    })
    expect(await settled(p)).toBe(true)
  })

  it('waits for `load` before asking for idle', async () => {
    const { win, load, queue } = fakeWindow('loading', true)

    const p = afterLoadIdle(win)
    expect(queue).toHaveLength(0)
    load()
    load()

    expect(queue).toHaveLength(1)
    queue.forEach((f) => {
      f()
    })
    expect(await settled(p)).toBe(true)
  })

  it('falls back to a 1 ms timer without requestIdleCallback', async () => {
    const { win, timer, queue } = fakeWindow('complete', false)

    const p = afterLoadIdle(win)

    expect(timer).toHaveBeenCalledWith(expect.any(Function), 1)
    queue.forEach((f) => {
      f()
    })
    expect(await settled(p)).toBe(true)
  })
})

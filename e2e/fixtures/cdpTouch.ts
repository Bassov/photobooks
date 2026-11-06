import type { Page } from '@playwright/test'

interface Pt {
  x: number
  y: number
}

/**
 * One finger on CDP touch input, the event times (`event.timeStamp`) set by the test so a gesture's speed is exact:
 * `move(…, stepMs)` puts its steps `stepMs` apart and sends each after the page's next frame, so the browser never
 * coalesces them into one pointermove; stepMs 0 sends them at once (they may coalesce). `hold(ms)` keeps the finger
 * still for `ms` of event time. Unpaced events carry the current time; the release follows the last paced step or
 * hold at its exact time.
 */
export async function cdpTouch(page: Page, start: Pt) {
  const cdp = await page.context().newCDPSession(page)
  let at = start
  let t = Date.now() / 1000
  // the last move was paced or held: the release keeps that exact time (no real-time gap before it)
  let timed = false
  const now = () => (t = Math.max(t, Date.now() / 1000))
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', ts: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ ...at, id: 1 }],
      timestamp: ts,
    })
  await send('touchStart', now())
  return {
    move: async (to: Pt, steps = 12, stepMs = 0) => {
      const from = at
      timed = stepMs > 0
      if (timed) now()
      for (let i = 1; i <= steps; i++) {
        if (stepMs)
          await page.evaluate(
            () =>
              new Promise((r) => {
                requestAnimationFrame(() => {
                  r(null)
                })
              }),
          )
        at = {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        }
        await send('touchMove', stepMs ? (t += stepMs / 1000) : now())
      }
    },
    hold: (ms: number) => {
      t += ms / 1000
      timed = true
    },
    up: async () => {
      await send('touchEnd', timed ? t : now())
      await cdp.detach()
    },
  }
}

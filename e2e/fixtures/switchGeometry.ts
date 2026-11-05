import type { Locator } from '@playwright/test'
import { expect } from './coverage'
import { pixelsAt } from './paintProbe'

/**
 * Kit `Switch size="sm"` (uikit/src/components/ui/switch.tsx): track `h-5 w-9`
 * with a 2 px transparent border, knob `size-4` at the content-box origin,
 * `translate-x-4` when on. The prod `ToggleSwitch` matches it (#491 note).
 */
export const KIT_SWITCH_SM = {
  width: 36,
  height: 20,
  knob: 16,
  inset: 2,
  travel: 16,
} as const

/** Knob box relative to the track's top-left corner, and the track size. */
async function geometry(track: Locator, knob: Locator) {
  const [t, k] = await Promise.all([track.boundingBox(), knob.boundingBox()])
  if (t === null || k === null) throw new Error('switch has no box')
  return {
    width: t.width,
    height: t.height,
    knobWidth: k.width,
    knobHeight: k.height,
    dx: k.x - t.x,
    dy: k.y - t.y,
  }
}

/** Track 36×20, knob 16×16 at +2 / +18 (±0.5 px), knob painted in its slot. */
export async function expectKitSwitchSm(
  track: Locator,
  knob: Locator,
  on: boolean,
) {
  const S = KIT_SWITCH_SM
  const dx = S.inset + (on ? S.travel : 0)
  // The knob slides (prod `left`, kit `transform`): wait for it to settle.
  await expect
    .poll(async () => (await geometry(track, knob)).dx)
    .toBeCloseTo(dx, 0)
  const g = await geometry(track, knob)
  expect(g.width).toBeCloseTo(S.width, 0)
  expect(g.height).toBeCloseTo(S.height, 0)
  expect(g.knobWidth).toBeCloseTo(S.knob, 0)
  expect(g.knobHeight).toBeCloseTo(S.knob, 0)
  expect(g.dy).toBeCloseTo(S.inset, 0)

  // Paint: the knob centre differs from the free slot at the other end.
  const y = S.height / 2
  const half = S.knob / 2
  const [knobPx = [], slotPx = []] = await pixelsAt(track, [
    { x: dx + half, y },
    { x: S.inset + (on ? 0 : S.travel) + half, y },
  ])
  const diff = [0, 1, 2].reduce(
    (sum, i) => sum + Math.abs((knobPx[i] ?? 0) - (slotPx[i] ?? 0)),
    0,
  )
  expect(
    diff,
    `knob ${knobPx.join()} vs slot ${slotPx.join()}`,
  ).toBeGreaterThan(30)
}

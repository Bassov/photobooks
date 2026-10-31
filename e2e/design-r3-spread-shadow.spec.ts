import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { addSpreads } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { STACK_GAP_RATIO } from './fixtures/stackGap'
import { chooseZoom, readZoomPercent } from './fixtures/zoomMenu'

// Owner 2026-10-31 (design-r3-spread-shadow):
// M35 the page shadow is the kit --page-shadow in screen px at every zoom
//     (the slot's paint containment cut it into a hard band down the gap);
// M36 the stack gap is 72 / 588 of the spread height;
// M37 page numbers sit a constant 8 screen px under their page, 11 px font,
//     centred under it, with no drift while a zoom gesture scales the world.

const KIT_SHADOW =
  'rgba(0, 0, 0, 0.1) 0px 2px 6px 0px, rgba(0, 0, 0, 0.14) 0px 12px 32px 0px'

interface StackProbe {
  gesture: string | null
  scale: number
  shadow: number[][]
  clipMarginPx: number
  spreads: { top: number; bottom: number; height: number }[]
  labels: {
    text: string
    dy: number
    dx: number
    fontPx: number
  }[]
}

/**
 * One-frame read of the first mounted spreads in SCREEN px: the effective
 * world scale (1 at rest, the gesture scale mid-zoom), the shadow layers as
 * [x, y, blur, alpha] × scale, the slot clip margin, and each shown page
 * number against its own page (single page = whole spread view).
 */
function probeStack(): StackProbe {
  const world = document.querySelector<HTMLElement>(
    '[data-testid="pasteboard-world"]',
  )
  const slots = [
    ...document.querySelectorAll<HTMLElement>('[data-pasteboard-slot]'),
  ].slice(0, 3)
  const views = slots.map((slot) =>
    slot.querySelector<HTMLElement>('[data-testid="spread-view"]'),
  )
  const first = views[0]
  if (world === null || slots[0] === undefined || !first) {
    throw new Error('no mounted spread')
  }
  const scale = first.getBoundingClientRect().height / first.offsetHeight
  const shadow = getComputedStyle(first)
    .boxShadow.split(/,(?![^(]*\))/)
    .map((layer) => {
      const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(layer)?.[1] ?? '1'
      const lengths = [
        ...layer.replace(/rgba?\([^)]*\)/, '').matchAll(/-?[\d.]+px/g),
      ]
        .slice(0, 3)
        .map((m) => Number.parseFloat(m[0]) * scale)
      return [...lengths, Number(alpha)]
    })
  // Paint containment clips at the slot box plus overflow-clip-margin
  // (content-visibility: auto implies it); without it nothing is clipped.
  const slotStyle = getComputedStyle(slots[0])
  const paintClipped =
    /paint|content|strict/.test(slotStyle.contain) ||
    slotStyle.contentVisibility === 'auto'
  const clipMarginPx = paintClipped
    ? Number.parseFloat(slotStyle.overflowClipMargin) * scale
    : Number.MAX_SAFE_INTEGER
  const spreads = views.flatMap((view) => {
    if (!view) return []
    const r = view.getBoundingClientRect()
    return [{ top: r.top, bottom: r.bottom, height: r.height }]
  })
  const labels = slots.flatMap((slot, i) => {
    const view = views[i]?.getBoundingClientRect()
    if (view === undefined) return []
    const shown = [...slot.querySelectorAll<HTMLElement>('.page-label')].filter(
      (label) => label.textContent !== '',
    )
    const pageWidth = view.width / shown.length
    return shown.map((label, k) => {
      const r = label.getBoundingClientRect()
      return {
        text: label.textContent,
        dy: r.top - view.bottom,
        dx: Math.abs(
          r.left + r.width / 2 - (view.left + pageWidth * (k + 0.5)),
        ),
        fontPx: Number.parseFloat(getComputedStyle(label).fontSize) * scale,
      }
    })
  })
  return {
    gesture: world.dataset.gesture ?? null,
    scale,
    shadow,
    clipMarginPx,
    spreads,
    labels,
  }
}

const KIT_LAYERS = [
  [0, 2, 6, 0.1],
  [0, 12, 32, 0.14],
]
/** Lowest screen px the kit shadow reaches below the page (offset + blur). */
const KIT_REACH_PX = 12 + 32

/** Painted shadow layers: Tailwind v4 pads utilities with transparent rings. */
function visibleLayers(boxShadow: string): string {
  return boxShadow
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim())
    .filter((layer) => !layer.startsWith('rgba(0, 0, 0, 0) '))
    .join(', ')
}

function expectKitShadow(probe: StackProbe): void {
  expect(probe.shadow).toHaveLength(KIT_LAYERS.length)
  probe.shadow.forEach((layer, i) => {
    layer.forEach((value, k) => {
      expect(Math.abs(value - (KIT_LAYERS[i]?.[k] ?? Number.NaN))).toBeLessThan(
        0.05,
      )
    })
  })
  // The slot no longer clips the soft shadow into a hard band.
  expect(probe.clipMarginPx).toBeGreaterThanOrEqual(KIT_REACH_PX)
}

function expectPageNumbers(probe: StackProbe): void {
  expect(probe.labels.length).toBeGreaterThan(0)
  for (const label of probe.labels) {
    expect(Math.abs(label.dy - 8), label.text).toBeLessThanOrEqual(0.5)
    expect(Math.abs(label.fontPx - 11), label.text).toBeLessThanOrEqual(0.05)
    expect(label.dx, label.text).toBeLessThanOrEqual(1)
  }
}

function gapsPx(probe: StackProbe): number[] {
  return probe.spreads.slice(1).map((next, i) => {
    const prev = probe.spreads[i]
    if (prev === undefined) throw new Error('missing spread')
    return next.top - prev.bottom
  })
}

function expectStackGap(probe: StackProbe): void {
  const gaps = gapsPx(probe)
  expect(gaps.length).toBeGreaterThan(0)
  gaps.forEach((gap, i) => {
    const height = probe.spreads[i]?.height ?? 0
    expect(Math.abs(gap - height * STACK_GAP_RATIO)).toBeLessThanOrEqual(0.5)
  })
}

async function settledProbe(page: Page): Promise<StackProbe> {
  await expect
    .poll(() =>
      page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
    )
    .toBeNull()
  await expect
    .poll(async () => (await page.evaluate(probeStack)).spreads.length)
    .toBeGreaterThanOrEqual(2)
  return page.evaluate(probeStack)
}

function percent(label: string): number {
  return Number.parseFloat(label)
}

/** Toolbar-step until the zoom percent crosses `target` (≤ or ≥). */
async function stepZoomPast(page: Page, target: number): Promise<void> {
  const start = percent(await readZoomPercent(page))
  const dir = target < start ? 'zoom-out' : 'zoom-in'
  for (let guard = 0; guard < 20; guard += 1) {
    const now = percent(await readZoomPercent(page))
    if (dir === 'zoom-out' ? now <= target : now >= target) return
    const before = await readZoomPercent(page)
    await page.getByTestId(dir).click()
    await expect.poll(() => readZoomPercent(page)).not.toBe(before)
  }
  throw new Error(`zoom never crossed ${String(target)}%`)
}

test.describe('design-r3-spread-shadow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    const count = Number(
      await page
        .getByTestId('pasteboard-scroll')
        .getAttribute('data-spread-count'),
    )
    await addSpreads(page, Math.max(0, 3 - count))
    await chooseZoom(page, 'Fit spread')
  })

  test('M35–M37: kit shadow, 72/588 gap and 8 px page numbers at 18 %, Fit and 138 %', async ({
    page,
  }) => {
    const fit = await settledProbe(page)
    expectKitShadow(fit)
    expectStackGap(fit)
    expectPageNumbers(fit)
    // At Fit and above, the whole shadow reach stays inside the gap.
    for (const gap of gapsPx(fit)) expect(gap).toBeGreaterThan(KIT_REACH_PX)

    await stepZoomPast(page, 138)
    const zoomedIn = await settledProbe(page)
    expect(zoomedIn.spreads[0]?.height ?? 0).toBeGreaterThan(
      (fit.spreads[0]?.height ?? 0) * 3,
    )
    expectKitShadow(zoomedIn)
    expectStackGap(zoomedIn)
    expectPageNumbers(zoomedIn)
    for (const gap of gapsPx(zoomedIn)) {
      expect(gap).toBeGreaterThan(KIT_REACH_PX)
    }

    await stepZoomPast(page, 19)
    const zoomedOut = await settledProbe(page)
    expect(percent(await readZoomPercent(page))).toBeLessThanOrEqual(19)
    // Same screen-px shadow when zoomed out; a gap shorter than its 44 px
    // reach lets the soft tail fade under the next spread (painted later).
    expectKitShadow(zoomedOut)
    expectStackGap(zoomedOut)
    expectPageNumbers(zoomedOut)
  })

  test('M35/M37: mid-gesture the shadow and page numbers keep their screen px', async ({
    page,
  }) => {
    const before = await settledProbe(page)
    // Install the probe out of band (CDP evaluate, not page CSP) so the read
    // lands in the gesture's first painted frame, before the 80 ms settle.
    await page.evaluate(`window.__probeStack = ${probeStack.toString()}`)
    const during = await page
      .getByTestId('pasteboard-scroll')
      .evaluate(async (scroll) => {
        const probe = (window as unknown as { __probeStack: () => StackProbe })
          .__probeStack
        const r = scroll.getBoundingClientRect()
        scroll.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -240,
            ctrlKey: true,
            clientX: r.x + r.width / 2,
            clientY: r.y + r.height / 3,
            bubbles: true,
            cancelable: true,
          }),
        )
        return new Promise<StackProbe>((resolve) => {
          requestAnimationFrame(() => {
            resolve(probe())
          })
        })
      })
    expect(during.gesture).toBe('zoom')
    expect(during.scale).toBeGreaterThan(1.05)
    expectKitShadow(during)
    expectPageNumbers(during)
    // Same label → page offsets as before the gesture: no drift.
    expect(during.labels.map((l) => Math.round(l.dy))).toEqual(
      before.labels.slice(0, during.labels.length).map((l) => Math.round(l.dy)),
    )

    const after = await settledProbe(page)
    expectKitShadow(after)
    expectPageNumbers(after)
  })

  test('M35: the product shadow is the rendered kit #/demo spread shadow', async ({
    page,
  }) => {
    const product = await page
      .locator('[data-pasteboard-slot] [data-testid="spread-view"]')
      .first()
      .evaluate((el) => getComputedStyle(el).boxShadow)
    expect(product).toBe(KIT_SHADOW)
    // #/demo paints every spread with the kit `shadow-page` utility
    // (uikit/src/sandbox/canvas.tsx); read it from the rendered kit bundle.
    await page.goto('/uikit/#/demo')
    await expect(page.getByTestId('demo')).toBeVisible()
    const kit = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'shadow-page'
      document.body.append(probe)
      const shadow = getComputedStyle(probe).boxShadow
      probe.remove()
      return shadow
    })
    expect(visibleLayers(kit)).toBe(product)
  })
})

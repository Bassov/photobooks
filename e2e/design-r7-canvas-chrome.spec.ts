import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { addSpreads, applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { chooseZoom } from './fixtures/zoomMenu'

// Owner Must, round 7, relayed by Designer 2026-11-01 (design-r7-canvas-chrome):
// M51 in-canvas chrome is locked to the zoom like the page numbers: the
//     "Drop photo" icon and label keep their screen px and stay centred in
//     their frame, and the fold follows the spread centre, on every frame.
// M52 the selected-frame size pill is gone in every mode.
//
// Kit DOM, uikit#/demo step 08 (blank spread, empty frame) at 1440x900,
// measured 2026-11-01 at rest (spread 829 px wide) and after a ctrl-wheel
// zoom (1213 px): ImagePlus 16 x 16 px, "Drop photo" 11 px, 4 px gap, icon
// and label centred in the frame (dx -0.008, dy 0); the gutter fold centred
// on the spread (mid -0.008). Selecting the frame shows the kit "296 x 210 mm"
// pill, which the Owner removed (M52).

const KIT_ICON_PX = 16
const KIT_LABEL_PX = 11
const KIT_GAP_PX = 4

interface ChromeSample {
  gesture: string | null
  scale: number
  icon: number[]
  labelPx: number
  gap: number
  /** Icon / label centre x and the hint group's centre y off the frame's. */
  offCentre: number[]
  fold: { dx: number; width: number }
}

/**
 * One-frame read in SCREEN px of the watched spread's fold and the watched
 * empty frame's hints. Installed via CDP evaluate (no page CSP) and called
 * from a rAF loop.
 */
function sampleChrome(spreadId: string, frameId: string): ChromeSample {
  const view = document.querySelector<HTMLElement>(
    `[data-testid="spread-view"][data-spread-id="${spreadId}"]`,
  )
  const frame = view?.querySelector<HTMLElement>(
    `[data-testid="spread-frame"][data-frame-id="${frameId}"]`,
  )
  const body = frame?.querySelector<HTMLElement>('.spread-frame-body')
  const hints = frame?.querySelector<HTMLElement>('[data-testid="frame-hints"]')
  const icon = hints?.querySelector('svg')
  const label = hints?.querySelector<HTMLElement>(
    '[data-testid="frame-empty-label"]',
  )
  const cut = view?.querySelector('[data-testid="spread-page-cut"]')
  if (!view || !body || !hints || !icon || !label || !cut) {
    throw new Error('watched spread chrome missing')
  }
  const v = view.getBoundingClientRect()
  const b = body.getBoundingClientRect()
  const h = hints.getBoundingClientRect()
  const i = icon.getBoundingClientRect()
  const l = label.getBoundingClientRect()
  const c = cut.getBoundingClientRect()
  const midX = b.left + b.width / 2
  return {
    gesture:
      document.querySelector<HTMLElement>('[data-testid="pasteboard-world"]')
        ?.dataset.gesture ?? null,
    scale: v.height / view.offsetHeight,
    icon: [i.width, i.height],
    labelPx:
      Number.parseFloat(getComputedStyle(label).fontSize) *
      (l.height / label.offsetHeight),
    gap: l.top - i.bottom,
    offCentre: [
      i.left + i.width / 2 - midX,
      l.left + l.width / 2 - midX,
      h.top + h.height / 2 - (b.top + b.height / 2),
    ],
    fold: { dx: c.left + c.width / 2 - (v.left + v.width / 2), width: c.width },
  }
}

function expectLocked(sample: ChromeSample): void {
  const at = `${String(sample.gesture)} x${sample.scale.toFixed(3)}`
  for (const side of sample.icon) {
    expect(Math.abs(side - KIT_ICON_PX), at).toBeLessThanOrEqual(0.05)
  }
  expect(Math.abs(sample.labelPx - KIT_LABEL_PX), at).toBeLessThanOrEqual(0.05)
  expect(Math.abs(sample.gap - KIT_GAP_PX), at).toBeLessThanOrEqual(0.5)
  for (const off of sample.offCentre) {
    expect(Math.abs(off), at).toBeLessThanOrEqual(0.5)
  }
  expect(Math.abs(sample.fold.dx), at).toBeLessThanOrEqual(0.5)
  expect(Math.abs(sample.fold.width - 1), at).toBeLessThanOrEqual(0.05)
}

function boxOf<T>(value: T | null): T {
  if (value === null) throw new Error('expected a bounding box')
  return value
}

test.describe('design-r7-canvas-chrome', () => {
  test('M51: through wheel steps and a ctrl-wheel burst the hints and fold hold every frame', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    const scroll = page.getByTestId('pasteboard-scroll')
    const count = Number(await scroll.getAttribute('data-spread-count'))
    await addSpreads(page, Math.max(0, 3 - count))
    await chooseZoom(page, 'Fit spread')
    await expect(page.getByTestId('pasteboard-world')).not.toHaveAttribute(
      'data-gesture',
      'zoom',
    )

    // A two-page spread (fold) with a labelled empty frame.
    const view = page
      .getByTestId('spread-view')
      .filter({ has: page.getByTestId('spread-page-cut') })
      .filter({ has: page.getByTestId('frame-empty-label') })
      .first()
    await view.scrollIntoViewIfNeeded()
    const spreadId = (await view.getAttribute('data-spread-id')) ?? ''
    const frameId =
      (await view
        .getByTestId('spread-frame')
        .filter({ has: page.getByTestId('frame-empty-label') })
        .first()
        .getAttribute('data-frame-id')) ?? ''
    expect(spreadId).not.toBe('')
    expect(frameId).not.toBe('')
    await page.evaluate(`window.__sampleChrome = ${sampleChrome.toString()}`)

    const samples = await scroll.evaluate(
      async (port, ids) => {
        const sample = (
          window as unknown as {
            __sampleChrome: (s: string, f: string) => ChromeSample
          }
        ).__sampleChrome
        const out: ChromeSample[] = []
        let running = true
        const loop = (): void => {
          out.push(sample(ids.spreadId, ids.frameId))
          if (running) requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
        const frames = (n: number): Promise<void> =>
          new Promise((resolve) => {
            let left = n
            const tick = (): void => {
              left -= 1
              if (left <= 0) resolve()
              else requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          })
        const anchor = document
          .querySelector(`[data-spread-id="${ids.spreadId}"]`)
          ?.getBoundingClientRect()
        const r = port.getBoundingClientRect()
        const wheel = (deltaY: number, ctrlKey: boolean): void => {
          port.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              ctrlKey,
              clientX: anchor ? anchor.x + anchor.width / 2 : r.x + r.width / 2,
              clientY: anchor
                ? anchor.y + anchor.height / 2
                : r.y + r.height / 2,
              bubbles: true,
              cancelable: true,
            }),
          )
        }
        // 8 plain wheel steps out, then 8 back in.
        for (const deltaY of [...Array(8).fill(40), ...Array(8).fill(-40)]) {
          wheel(deltaY as number, false)
          await frames(2)
        }
        // Pinch-style ctrl-wheel burst: many small deltas per task.
        for (const deltaY of [-6, 6]) {
          for (let task = 0; task < 6; task += 1) {
            for (let k = 0; k < 4; k += 1) wheel(deltaY, true)
            await frames(1)
          }
        }
        // Keep sampling through the settle commit.
        await new Promise((resolve) => setTimeout(resolve, 400))
        await frames(2)
        running = false
        return out
      },
      { spreadId, frameId },
    )

    // The samples catch the live gesture scaling the world both ways.
    const live = samples.filter((s) => s.gesture === 'zoom')
    expect(live.length).toBeGreaterThan(10)
    expect(Math.min(...live.map((s) => s.scale))).toBeLessThan(0.9)
    expect(Math.max(...live.map((s) => s.scale))).toBeGreaterThan(1.02)
    expect(samples.at(-1)?.gesture).toBeNull()
    for (const sample of samples) expectLocked(sample)
  })

  test('M52: select, resize, drag and crop show no size tag and no mm text', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    ensurePhotoFixtures({ includeLargeJpeg: false })
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await applyLayout(page, 'Full bleed', { restorePanel: true })
    await dragPlaceFirstFilmstripItem(page, 0)
    const frame = page.locator(
      '[data-testid="spread-frame"][data-filled="true"]',
    )
    const world = page.getByTestId('pasteboard-world')
    const noSizeTag = async (): Promise<void> => {
      await expect(page.getByTestId('frame-size-tag')).toHaveCount(0)
      await expect(page.locator('.spread-frame-size-tag')).toHaveCount(0)
      expect(await world.innerText()).not.toMatch(/\d\s*mm\b/)
    }

    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
    await noSizeTag()

    // Mid resize from the se handle.
    const se = boxOf(await frame.locator('[data-handle="se"]').boundingBox())
    const sx = se.x + se.width / 2
    const sy = se.y + se.height / 2
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(sx - 60, sy - 40, { steps: 4 })
    await noSizeTag()
    await page.keyboard.press('Escape')
    await page.mouse.up()

    // Mid drag of the selected photo.
    const box = boxOf(await frame.boundingBox())
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 60, cy + 36, { steps: 6 })
    await noSizeTag()
    await page.keyboard.press('Escape')
    await page.mouse.up()

    // Crop mode.
    await frame.dblclick()
    await expect(frame).toHaveAttribute('data-crop-active', 'true')
    await expect(page.getByTestId('crop-overlay-tag')).toHaveText('Crop · 100%')
    await noSizeTag()
  })
})

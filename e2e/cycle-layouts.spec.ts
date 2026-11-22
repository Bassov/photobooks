import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt, topAt } from './fixtures/paintProbe'
import { waitForPasteboardSettled } from './fixtures/pasteboardSettled'
import { chooseZoom } from './fixtures/zoomMenu'

// Designer cycle-layouts CL3 (Owner Q-27): the prod layout pill above the
// active spread = kit `#/demo` `editor-layout-cycle-*` (CL2 #707). Spec
// numbers at 1440×900 Fit on spread 2–3: centre x 676, y 71.02–99.02.

test.use({ viewport: { width: 1440, height: 900 } })

const PILL = '[data-testid="layout-cycle"]'
const ACTIVE = '[data-pasteboard-slot][data-active="true"]'

const pill = (page: Page) => page.getByTestId('layout-cycle')
const pillName = (page: Page) => page.getByTestId('layout-cycle-name')

async function openSpread23(page: Page): Promise<void> {
  await openSessionEditor(page)
  await waitForPasteboardSettled(page)
  await page.getByTestId('spread-list-item-spread-2').click()
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Pages 2–3/,
  )
  await page.mouse.move(0, 899)
  await expect(pill(page)).toBeVisible()
}

/** Pill and active paper rects in one frame. */
const boxes = (page: Page) =>
  page.evaluate(
    ([pillSel, activeSel]) => {
      const rect = (el: Element | null) => {
        if (el === null) throw new Error('no pill / paper')
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return {
        pill: rect(document.querySelector(pillSel)),
        paper: rect(
          document.querySelector(`${activeSel} [data-testid="spread-view"]`),
        ),
      }
    },
    [PILL, ACTIVE] as const,
  )

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('no box')
  return box
}

/**
 * Per animation frame while a live zoom runs: pill centre x − paper centre
 * x, pill bottom − (paper top − 8) and pill height.
 */
const sampleLock = (page: Page) =>
  page.evaluate(
    ([pillSel, activeSel]) =>
      new Promise<number[][]>((resolve) => {
        const out: number[][] = []
        const tick = () => {
          const p = document.querySelector(pillSel)
          const s = document.querySelector(
            `${activeSel} [data-testid="spread-view"]`,
          )
          if (
            p !== null &&
            s !== null &&
            getComputedStyle(p).display !== 'none'
          ) {
            const a = p.getBoundingClientRect()
            const b = s.getBoundingClientRect()
            out.push([
              a.x + a.width / 2 - (b.x + b.width / 2),
              a.bottom - (b.top - 8),
              a.height,
            ])
          }
          if (out.length < 24) requestAnimationFrame(tick)
          else resolve(out)
        }
        requestAnimationFrame(tick)
      }),
    [PILL, ACTIVE] as const,
  )

const undoLabel = (page: Page) =>
  page.getByTestId('undo').getAttribute('aria-label')

test('the pill sits 8 px over the paper top centre at Fit and keeps its width', async ({
  page,
}) => {
  await openSpread23(page)
  const { pill: box, paper } = await boxes(page)
  // Before: nothing rendered above the spread. After: Spec numbers.
  expect(paper.x + paper.width / 2).toBeCloseTo(676, 0)
  expect(box.x + box.width / 2).toBeCloseTo(paper.x + paper.width / 2, 0)
  expect(Math.abs(box.y + box.height - (paper.y - 8))).toBeLessThanOrEqual(0.5)
  expect(box.height).toBeCloseTo(28, 1)
  // Painted, not clipped by the slot: the pill is the top hit at its centre.
  expect((await topAt(pill(page)))[0]).toContain('layout-cycle')
  // Chrome face `--chrome` = top-bar `BAR`: P10 warm #E3E1DD (was #E1E1E1).
  await expect(pill(page)).toHaveCSS('background-color', 'rgb(227, 225, 221)')
  await expect(pill(page)).toHaveCSS('border-radius', '8px')
  const next = page.getByTestId('layout-cycle-next')
  expect((await next.boundingBox())?.width).toBeCloseTo(24, 1)

  // Same width while stepping through the set (D7).
  const widths = new Set<number>()
  const names = new Set<string>()
  for (let i = 0; i < 3; i += 1) {
    widths.add((await pill(page).boundingBox())?.width ?? 0)
    names.add((await pillName(page).textContent()) ?? '')
    await next.click()
  }
  expect(names.size).toBeGreaterThan(1)
  expect(widths.size).toBe(1)
})

test('‹ › hover shows the top-bar dark tooltip 6 px above the button (design-r46 M155)', async ({
  page,
}) => {
  await openSpread23(page)
  for (const [id, label, keys] of [
    ['layout-cycle-prev', 'Previous layout', '⇧['],
    ['layout-cycle-next', 'Next layout', '⇧]'],
  ] as const) {
    const button = page.getByTestId(id)
    const tip = button.locator('.e7-tt')
    // Before: the light Snap-style RAC tooltip (rgb 225, 12 px, r 8).
    await button.hover()
    await expect(tip).toHaveCSS('opacity', '1')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    expect(await tip.evaluate((el) => el.firstChild?.textContent)).toBe(label)
    const look = await tip.evaluate((el) => {
      const s = getComputedStyle(el)
      const k = el.querySelector('kbd')
      const ks = k === null ? null : getComputedStyle(k)
      return {
        bg: s.backgroundColor,
        color: s.color,
        size: s.fontSize,
        weight: s.fontWeight,
        radius: s.borderRadius,
        padding: s.padding,
        kbd: ks && {
          text: k?.textContent,
          opacity: ks.opacity,
          marginLeft: ks.marginLeft,
        },
      }
    })
    expect(look).toEqual({
      bg: 'rgb(83, 81, 82)',
      color: 'rgb(242, 242, 242)',
      size: '11px',
      weight: '400',
      radius: '5px',
      padding: '3px 7px',
      kbd: { text: keys, opacity: '0.7', marginLeft: '6px' },
    })
    const b = await boxOf(button)
    const t = await boxOf(tip)
    expect(Math.abs(b.y - (t.y + t.height) - 6)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(t.x + t.width / 2 - (b.x + b.width / 2))).toBeLessThan(1)
    expect(t.height).toBeCloseTo(22, 0)
    // Painted: the left padding of the tip is the dark ink on screen.
    const [px] = await pixelsAt(tip, [{ x: 3, y: t.height / 2 }])
    expect(px?.slice(0, 3)).toEqual([83, 81, 82])
    await page.mouse.move(0, 899)
    await expect(tip).toHaveCSS('opacity', '0')
  }
})

test('⇧] cycles while ] still toggles the inspector; 3 presses undo in one step; caption kept', async ({
  page,
}) => {
  await openSpread23(page)
  const frameId = await page
    .locator(`${ACTIVE} [data-testid="spread-frame"]`)
    .first()
    .getAttribute('data-frame-id')
  await page.evaluate((id) => {
    window.__photobooksProject?.dispatchBookOpForTests({
      type: 'setFrameCaption',
      spreadId: 'spread-2',
      frameId: id ?? '',
      caption: 'Lake at dawn',
    })
  }, frameId)
  const first = await pillName(page).textContent()
  const ids = () =>
    page
      .locator(`${ACTIVE} [data-testid="spread-frame"]`)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-frame-id')))
  const idsBefore = await ids()

  await page.getByTestId('pasteboard-scroll').focus()
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Shift+BracketRight')
  }
  await expect(pillName(page)).not.toHaveText(first ?? '')
  expect(await undoLabel(page)).toContain('Change layout')
  expect(await ids()).toEqual(idsBefore)
  await expect(
    page.locator(`${ACTIVE} [data-testid="frame-caption"]`).first(),
  ).toContainText('Lake at dawn')

  await page.keyboard.press('Control+z')
  await expect(pillName(page)).toHaveText(first ?? '')
  // The step before the run is the caption, not another layout step.
  expect(await undoLabel(page)).not.toContain('Change layout')

  // Bare ] is still the inspector toggle.
  const inspector = page.locator('.editor-panel-r')
  await page.keyboard.press(']')
  await expect(inspector).toHaveAttribute('data-open', 'false')
  await page.keyboard.press(']')
  await expect(inspector).toHaveAttribute('data-open', 'true')
})

test('a press on the pill neither activates nor starts a marquee; wheel zoom keeps it locked', async ({
  page,
}) => {
  await openSpread23(page)
  const name = await boxOf(pillName(page))
  await page.mouse.move(name.x + 4, name.y + name.height / 2)
  await page.mouse.down()
  await page.mouse.move(name.x - 60, name.y + 80, { steps: 4 })
  await expect(page.getByTestId('marquee')).toHaveCount(0)
  await page.mouse.up()
  await expect(page.locator(ACTIVE)).toHaveAttribute(
    'data-spread-id',
    'spread-2',
  )

  // Live zoom: every frame the pill stays 8 px over the paper top centre.
  const samples = sampleLock(page)
  await dispatchCtrlWheel(page, -40, 6, { settle: false })
  for (const [dx, dy, h] of await samples) {
    expect(Math.abs(dx ?? 99)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(dy ?? 99)).toBeLessThanOrEqual(0.5)
    expect(h).toBeCloseTo(28, 0)
  }
})

test('hidden under a short gap (keys still act), in Masters, in Preview and during an asset drag', async ({
  page,
}) => {
  await openSpread23(page)
  // Zoom floor: the stack gap drops under 63 px.
  await expect
    .poll(
      async () => {
        await dispatchCtrlWheel(page, 200, 4)
        return pill(page).count()
      },
      { intervals: [0], timeout: 20_000 },
    )
    .toBe(0)
  await expect(page.locator(ACTIVE)).toHaveAttribute(
    'data-spread-id',
    'spread-2',
  )
  await page.getByTestId('pasteboard-scroll').focus()
  await page.keyboard.press('Shift+BracketRight')
  await expect.poll(() => undoLabel(page)).toContain('Change layout')
  await chooseZoom(page, 'Fit spread')
  await page.getByTestId('spread-list-item-spread-2').click()
  await expect(pill(page)).toBeVisible()

  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    el.setAttribute('data-asset-drag', 'true')
  })
  await expect(pill(page)).toBeHidden()
  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    el.removeAttribute('data-asset-drag')
  })
  await expect(pill(page)).toBeVisible()

  await page.getByRole('tab', { name: 'Masters' }).click()
  await expect(pill(page)).toHaveCount(0)
  await page.getByRole('tab', { name: 'Pages' }).click()
  await expect(pill(page)).toBeVisible()

  // Preview: ⇧] records no layout step (same layout name after Esc).
  const before = await pillName(page).textContent()
  await page.getByTestId('present').click()
  await expect(pill(page)).toBeHidden()
  await page.keyboard.press('Shift+BracketRight')
  await page.keyboard.press('Escape')
  await expect(pill(page)).toBeVisible()
  await expect(pillName(page)).toHaveText(before ?? '')
})

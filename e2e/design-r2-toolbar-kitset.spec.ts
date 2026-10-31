import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'

test.use({ viewport: { width: 1440, height: 900 } })

// Kit #/demo bar (uikit/src/sandbox/chrome.tsx TopBar, demo-parts/editor.tsx),
// minus the controls the Owner removed (rulers, guides, bleed/safe, DPI) and
// minus Print / Publish (known gaps: the product has no such actions).
const BAR_CONTROLS = [
  'Library',
  'Book settings',
  'Nothing to undo',
  'Nothing to redo',
  'Select (V)',
  'Frame (F)',
  'Text (T)',
  'Pan (H)',
  'Snap (Shift+S)',
  "Layout grid (Ctrl ')",
  'Zoom out (Ctrl −)',
  'Zoom',
  'Zoom in (Ctrl +)',
  'Hide spreads',
  'Hide photos',
  'Hide inspector',
  'Preview',
  'Settings',
]

async function barControlNames(page: Page): Promise<string[]> {
  return page
    .getByTestId('editor-bar')
    .locator('button, [role="radio"], [role="checkbox"]')
    .evaluateAll((els) =>
      els
        .map((el) => ({
          x: el.getBoundingClientRect().x,
          name: el.getAttribute('aria-label') ?? el.textContent.trim(),
        }))
        .sort((a, b) => a.x - b.x)
        .map((item) => item.name),
    )
}

test('top bar holds exactly the kit tool set, left to right', async ({
  page,
}) => {
  await openSessionEditor(page)
  const names = await barControlNames(page)
  // Panel toggles flip Show / Hide with state; the kit order and targets are fixed.
  expect(names.map((n) => n.replace(/^(Show|Hide) /, 'Hide '))).toEqual(
    BAR_CONTROLS,
  )
  for (const id of [
    'view-menu',
    'rulers-topbar-toggle',
    'guides-topbar-toggle',
    'dpi-topbar-toggle',
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }
})

test('tool group sits centred on the canvas area, clear of the side groups', async ({
  page,
}) => {
  await openSessionEditor(page)
  const box = async (locator: Locator) => {
    return locator.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, width: r.width }
    })
  }
  const group = await box(page.getByRole('toolbar', { name: 'Editor' }))
  const redo = await box(page.getByTestId('redo'))
  const zoomOut = await box(page.getByTestId('zoom-out'))
  const left = await box(page.getByTestId('panel-l'))
  const inspector = await box(page.getByTestId('panel-r'))
  // Designer round 4 (M39): centred between the left panel and the inspector.
  const spaceLeft = group.x - (redo.x + redo.width)
  const spaceRight = zoomOut.x - (group.x + group.width)
  expect(spaceLeft).toBeGreaterThan(0)
  expect(spaceRight).toBeGreaterThan(0)
  const canvasCentre = (left.x + left.width + inspector.x) / 2
  expect(
    Math.abs(group.x + group.width / 2 - canvasCentre),
  ).toBeLessThanOrEqual(1)
})

async function openWithFrames(page: Page) {
  await openSessionEditor(page)
  await applyContactSheet(page, 2, 2)
  for (let i = 0; i < 3; i++) await page.getByTestId('zoom-in').click()
  const port = page.getByTestId('pasteboard-scroll')
  await port.evaluate((el) => {
    el.scrollLeft = 300
    el.scrollTop = 300
  })
  const scroll = () =>
    port.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))
  const start = await scroll()
  const b = await port.boundingBox()
  if (b === null) throw new Error('no pasteboard')
  return {
    scroll,
    start,
    cx: b.x + b.width / 2,
    cy: b.y + b.height / 2,
  }
}

async function expectNoFrameTouched(page: Page, undoLabel: string | null) {
  await expect(
    page.locator('[data-testid="spread-frame"][aria-pressed="true"]'),
  ).toHaveCount(0)
  expect(await page.getByTestId('undo').getAttribute('aria-label')).toBe(
    undoLabel,
  )
}

test('Hand tool pans on a plain drag, no Space', async ({ page }) => {
  const { scroll, start, cx, cy } = await openWithFrames(page)
  const undo = await page.getByTestId('undo').getAttribute('aria-label')
  await page.getByTestId('tool-hand').click()
  await expect(page.getByTestId('tool-hand')).toBeChecked()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy + 30, { steps: 5 })
  await page.mouse.move(cx + 80, cy + 60, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(async () => (await scroll()).x)
    .toBeCloseTo(start.x - 80, -1)
  await expect
    .poll(async () => (await scroll()).y)
    .toBeCloseTo(start.y - 60, -1)
  await expectNoFrameTouched(page, undo)
})

test('Space + drag pans from the Select tool; Select stays active', async ({
  page,
}) => {
  const { scroll, start, cx, cy } = await openWithFrames(page)
  const undo = await page.getByTestId('undo').getAttribute('aria-label')
  await expect(page.getByTestId('tool-select')).toBeChecked()
  await page.mouse.move(cx, cy)
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(cx + 40, cy + 30, { steps: 5 })
  await page.mouse.move(cx + 80, cy + 60, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect
    .poll(async () => (await scroll()).x)
    .toBeCloseTo(start.x - 80, -1)
  await expect
    .poll(async () => (await scroll()).y)
    .toBeCloseTo(start.y - 60, -1)
  await expect(page.getByTestId('tool-select')).toBeChecked()
  await expectNoFrameTouched(page, undo)
})

test('panel hotkeys keep working with Hand active and after a Space pan; Space alone toggles nothing', async ({
  page,
}) => {
  const { cx, cy } = await openWithFrames(page)
  const open = async () => ({
    l: await page.getByTestId('panel-l').getAttribute('data-open'),
    b: await page.getByTestId('panel-b').getAttribute('data-open'),
    r: await page.getByTestId('panel-r').getAttribute('data-open'),
  })
  const initial = await open()
  await page.mouse.move(cx, cy)

  // Space alone toggles no panel.
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  expect(await open()).toEqual(initial)

  const flip: Record<string, string> = { true: 'false', false: 'true' }
  const hotkeys = [
    ['[', 'panel-l', 'l'],
    ['\\', 'panel-b', 'b'],
    [']', 'panel-r', 'r'],
  ] as const
  const checkAll = async () => {
    for (const [key, id, k] of hotkeys) {
      const before = (await open())[k]
      await page.keyboard.press(key)
      await expect(page.getByTestId(id)).toHaveAttribute(
        'data-open',
        flip[before ?? 'false'] ?? '',
      )
      await page.keyboard.press(key)
      await expect(page.getByTestId(id)).toHaveAttribute(
        'data-open',
        before ?? 'false',
      )
    }
  }

  await page.getByTestId('tool-hand').click()
  await page.mouse.move(cx, cy)
  await checkAll()

  await page.getByTestId('tool-select').click()
  await page.mouse.move(cx, cy)
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(cx + 30, cy + 30, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  await checkAll()
})

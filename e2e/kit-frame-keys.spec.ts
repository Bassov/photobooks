import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// kit-gaps (Designer, multi-select-move review2 on #417): the kit `#/demo`
// editor catches up to prod on two frame keys. Del / Backspace delete the
// selected frames (locked ones stay, text editing keeps its keys); a nudge of
// an all-locked selection moves nothing and says so in the status, with the
// same message the drag shows.

const LOCKED = 'Frame is locked — unlock it in the inspector (Ctrl+Shift+L)'

const demo = (page: Page) => page.getByTestId('demo')
// spread 4 is the sample t-hero4 layout: five empty frames
const hero = (page: Page) => demo(page).locator('[data-spread="4"]')
const frames = (page: Page) => hero(page).locator('[data-testid="frame"]')

async function openDemoBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(frames(page)).toHaveCount(5)
  // a click on one of its frames makes spread 4 current; Esc drops the pick
  await frames(page).first().click({ force: true })
  await expect(hero(page)).toHaveAttribute('data-current', 'true')
  await page.keyboard.press('Escape')
  await expect(demo(page).getByTestId('sel-outline')).toHaveCount(0)
}

/** Keys go to the window, not to the spread list row the setup clicked. */
async function blur(page: Page) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  )
}

async function select(page: Page, indexes: number[]) {
  for (const [n, i] of indexes.entries()) {
    await frames(page)
      .nth(i)
      .click({ force: true, modifiers: n ? ['Shift'] : [] })
  }
  await expect(demo(page).getByTestId('sel-outline')).toHaveCount(
    indexes.length,
  )
}

/** The lock toggle sits in the inspector's "Position & size" section, collapsed by default. */
async function lockSelected(page: Page) {
  const section = demo(page).getByRole('button', { name: 'Position & size' })
  const lock = demo(page).getByRole('button', { name: 'Lock (Ctrl+Shift+L)' })
  await expect(section).toBeVisible()
  if (!(await lock.isVisible())) await section.click()
  await lock.click()
  await expect(
    demo(page).getByRole('button', { name: 'Unlock (Ctrl+Shift+L)' }),
  ).toBeVisible()
}

/** Distinct colours in the element's clipped screenshot: painted text gives many, a blank box one. */
async function paintedColours(page: Page, el: Locator) {
  const png = (await el.screenshot({ scale: 'css' })).toString('base64')
  const scratch = await page.context().newPage()
  try {
    return await scratch.evaluate(async (png) => {
      const img = new Image()
      img.src = `data:image/png;base64,${png}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx === null) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, img.width, img.height)
      const seen = new Set<number>()
      for (let i = 0; i < data.length; i += 4) {
        seen.add(
          ((data[i] ?? 0) << 16) |
            ((data[i + 1] ?? 0) << 8) |
            (data[i + 2] ?? 0),
        )
      }
      return seen.size
    }, png)
  } finally {
    await scratch.close()
  }
}

const rects = (page: Page) =>
  frames(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height]
    }),
  )

test.describe('kit #/demo frame keys', () => {
  test('Del deletes the selected frame, Backspace the whole selection', async ({
    page,
  }) => {
    await openDemoBook(page)
    const n = await frames(page).count()
    await select(page, [0])
    await blur(page)
    await page.keyboard.press('Delete')
    await expect(frames(page)).toHaveCount(n - 1)
    await select(page, [0, 1])
    await blur(page)
    await page.keyboard.press('Backspace')
    await expect(frames(page)).toHaveCount(n - 3)
  })

  test('Del keeps a locked frame and deletes the unlocked rest', async ({
    page,
  }) => {
    await openDemoBook(page)
    const n = await frames(page).count()
    await select(page, [0])
    await lockSelected(page)
    await blur(page)
    await page.keyboard.press('Delete')
    await expect(frames(page)).toHaveCount(n)
    await select(page, [0, 1])
    await blur(page)
    await page.keyboard.press('Delete')
    await expect(frames(page)).toHaveCount(n - 1)
    await expect(frames(page).first().locator('.lucide-lock')).toHaveCount(1)
  })

  test('Del and Backspace in the text editor edit the text only', async ({
    page,
  }) => {
    await openDemoBook(page)
    await demo(page).locator('[aria-label="Text (T)"]').click()
    await hero(page).click({ position: { x: 12, y: 12 } })
    // the on-canvas editor, not the inspector's Text field
    const editor = hero(page).getByRole('textbox', { name: 'Text' })
    await expect(editor).toBeFocused()
    const n = await frames(page).count()
    await page.keyboard.type('Lake')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Delete')
    await expect(editor).toHaveValue('La')
    await expect(frames(page)).toHaveCount(n)
  })

  test('ArrowRight on an all-locked selection moves nothing and shows the locked status', async ({
    page,
  }) => {
    await openDemoBook(page)
    await select(page, [0])
    await lockSelected(page)
    await select(page, [1])
    await lockSelected(page)
    await select(page, [0, 1])
    await blur(page)
    const before = await rects(page)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    const status = demo(page).getByTestId('status')
    await expect(status).toHaveText(LOCKED)
    const box = await status.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(0)
    expect(box?.height ?? 0).toBeGreaterThan(0)
    expect(await paintedColours(page, status)).toBeGreaterThan(8)
    expect(await rects(page)).toEqual(before)
  })
})

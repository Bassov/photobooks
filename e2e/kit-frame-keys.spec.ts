import type { Page } from '@playwright/test'
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

/** Marquee from the pasteboard left of the hero spread across its whole paper. */
async function marqueeAll(page: Page) {
  const box = await hero(page).boundingBox()
  if (box === null) throw new Error('hero spread has no box')
  await page.mouse.move(box.x - 16, box.y + 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 4,
  })
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, {
    steps: 4,
  })
  await page.mouse.up()
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

  for (const key of ['ArrowRight', 'Shift+ArrowRight']) {
    test(`${key} on an all-locked selection moves nothing and shows the locked status`, async ({
      page,
    }) => {
      await openDemoBook(page)
      // a pointer-down on a locked frame already shows the locked status, so
      // each frame is clicked while unlocked and the marquee selects them all
      const n = await frames(page).count()
      for (let i = 0; i < n; i++) {
        await select(page, [i])
        await lockSelected(page)
      }
      await marqueeAll(page)
      await expect(demo(page).getByTestId('sel-outline')).toHaveCount(n)
      await blur(page)
      const status = demo(page).getByTestId('status')
      await expect(status).not.toHaveText(LOCKED)
      const before = await rects(page)
      await page.keyboard.press(key)
      await expect(status).toHaveText(LOCKED)
      // M149, prod isStatusPillVisible: the locked status is a live-region
      // announcement only (no pill), as in prod
      await expect(status).toHaveAttribute('aria-live', 'polite')
      const box = await status.boundingBox()
      expect(box?.width ?? 0).toBeLessThanOrEqual(1)
      expect(await rects(page)).toEqual(before)
    })
  }
})

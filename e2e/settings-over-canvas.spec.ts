import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { topAt } from './fixtures/paintProbe'
import { waitForPasteboardSettled } from './fixtures/pasteboardSettled'

// QA-2 (prod QA 2026-11-25): the canvas layout-cycle pill painted over the
// editor Settings and took its clicks; Settings now covers an inert editor.

test.use({ viewport: { width: 1440, height: 900 } })

/** The plain hit at a viewport point: its own and its ancestors' testids. */
const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([px, py]) => {
      const out: string[] = []
      for (
        let n = document.elementFromPoint(px, py);
        n !== null;
        n = n.parentElement
      ) {
        const id = n.getAttribute('data-testid')
        if (id !== null) out.push(id)
      }
      return out
    },
    [x, y] as const,
  )

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('no box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('Settings covers the layout-cycle pill; ⇧] does not act behind it', async ({
  page,
}) => {
  await openSessionEditor(page)
  await waitForPasteboardSettled(page)
  await page.getByTestId('spread-list-item-spread-2').click()
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Pages 2–3/,
  )
  await page.mouse.move(0, 899)
  const pill = page.getByTestId('layout-cycle')
  const name = page.getByTestId('layout-cycle-name')
  await expect(pill).toBeVisible()
  const layout = await name.innerText()
  const at = await centreOf(pill)

  await page.getByTestId('editor-settings-open').click()
  const settings = page.getByTestId('editor-settings')
  await expect(settings).toBeVisible()
  await expect(pill).toBeHidden()
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('inert', '')

  // Paint and hit at the pill's old centre: Settings, never the pill.
  const hit = await hitAt(page, at.x, at.y)
  expect(hit).toContain('editor-settings')
  expect(hit).not.toContain('layout-cycle')
  const [top] = await topAt(settings, at)
  expect(top).toContain('editor-settings')
  // Nothing of the canvas paints anywhere over the Settings page.
  for (const [x, y] of [
    [700, 60],
    [700, 450],
    [100, 800],
    [1400, 200],
  ] as const) {
    const [stack] = await topAt(settings, { x, y })
    expect(stack, `topmost at ${String(x)},${String(y)}`).toContain(
      'editor-settings',
    )
  }

  // ⇧] behind Settings leaves the layout alone.
  await page.keyboard.press('Shift+BracketRight')
  await page.keyboard.press('Shift+BracketRight')

  await page.getByTestId('editor-settings-back').click()
  await expect(settings).toHaveCount(0)
  await expect(page.getByTestId('editor-shell')).not.toHaveAttribute(
    'inert',
    '',
  )
  await expect(page.getByTestId('editor-settings-open')).toBeFocused()
  await page.mouse.move(0, 899)
  await expect(pill).toBeVisible()
  await expect(name).toHaveText(layout)
  // Control: back on the book the same key does cycle.
  await page.keyboard.press('Shift+BracketRight')
  await expect(name).not.toHaveText(layout)
})

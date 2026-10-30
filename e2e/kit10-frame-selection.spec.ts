import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

const INK = 'rgb(35, 34, 35)'
const WHITE = 'rgb(255, 255, 255)'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
})

test.describe('kit v0.10 frame selection (demo steps 16–18)', () => {
  test('selected frame: #232223 outline, white handles with ink rings, no blue', async ({
    page,
  }) => {
    const frame = page.getByTestId('spread-frame').first()
    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')

    const ring = await frame.evaluate((el) => {
      const s = getComputedStyle(el, '::after')
      return { color: s.outlineColor, width: s.outlineWidth }
    })
    expect(ring).toEqual({ color: INK, width: '2px' })

    const handles = frame.getByTestId('sel-handle')
    await expect(handles).toHaveCount(8)
    const paint = await frame.locator('[data-handle]').evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el)
        return { bg: s.backgroundColor, shadow: s.boxShadow }
      }),
    )
    expect(paint).toHaveLength(9)
    for (const p of paint) {
      expect(p.bg).toBe(WHITE)
      expect(p.shadow).toContain(INK)
    }
    await assertDocumentFitsViewport(page)
  })

  test('Esc mid-drag puts the frame back where it was', async ({ page }) => {
    const frame = page.getByTestId('spread-frame').first()
    await frame.click()
    const before = await frame.boundingBox()
    expect(before).not.toBeNull()
    const x = (before?.x ?? 0) + (before?.width ?? 0) / 2
    const y = (before?.y ?? 0) + (before?.height ?? 0) / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(x - 25 * i, y + 15 * i)
    }
    const mid = await frame.boundingBox()
    expect(Math.abs((mid?.x ?? 0) - (before?.x ?? 0))).toBeGreaterThan(5)
    await expect(frame.getByTestId('sel-handle')).toHaveCount(8)

    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.up()
    const after = await frame.boundingBox()
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0)
    expect(after?.y).toBeCloseTo(before?.y ?? 0, 0)
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
  })
})

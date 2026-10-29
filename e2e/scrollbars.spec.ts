import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('editor uses kit v5 thin scrollbars and no scrollbar-width override', async ({
  page,
}) => {
  await openSessionEditor(page)
  const probe = await page.evaluate(() => {
    const inspector = document.querySelector('.editor-inspector')
    const target = inspector ?? document.body
    const bar = getComputedStyle(target, '::-webkit-scrollbar')
    const thumb = getComputedStyle(target, '::-webkit-scrollbar-thumb')
    return {
      hasInspector: inspector !== null,
      inspectorWidth: inspector
        ? getComputedStyle(inspector).scrollbarWidth
        : '',
      width: bar.width,
      height: bar.height,
      radius: thumb.borderTopLeftRadius,
      border: thumb.borderTopWidth,
      minHeight: thumb.minHeight,
      clip: thumb.backgroundClip,
    }
  })
  expect(probe.hasInspector).toBe(true)
  expect(probe.inspectorWidth).toBe('auto')
  expect(probe.width).toBe('10px')
  expect(probe.height).toBe('10px')
  expect(probe.border).toBe('3px')
  expect(probe.radius).toBe('99px')
  expect(probe.minHeight).toBe('32px')
  expect(probe.clip).toBe('content-box')
})

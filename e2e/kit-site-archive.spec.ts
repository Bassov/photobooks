import type { Frame, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// site-demo-archive (DEMO archive branch, never merged): the archive index
// lists every personal-site demo; each Desktop and Phone link opens its demo
// with no console errors and paint at the centre of the demo (not a blank page).

const DEMOS = [
  'site-demo-1',
  'site-demo-2',
  'site-demo-3',
  'site-demo-4',
  'site-demo-5',
  'site-demo-6',
  'site-demo-7',
  'site-demo-8',
  'site-demo-9',
  'site-fresh-a',
  'site-fresh-b',
  'site-fresh-c',
]

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** the top element painted at the centre of the frame: a demo node, not the bare root */
const centreTop = (frame: Page | Frame) =>
  frame.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    const root = document.getElementById('root')
    return {
      inRoot: !!el && !!root && root.contains(el) && el !== root,
      tag: el?.tagName ?? '',
    }
  })

/** the Phone link's iframe document */
async function phoneFrame(page: Page) {
  const frame = await (
    await page.locator('iframe').elementHandle()
  ).contentFrame()
  if (!frame) throw new Error('no phone frame')
  return frame
}

test('the archive lists every demo with source, idea and both links', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/uikit/#/full/site-demos')
  await page.getByTestId('site-archive-link').click()
  const rows = page.getByTestId('site-archive-row')
  await expect(rows).toHaveCount(DEMOS.length)
  expect(
    await rows.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-demo')),
    ),
  ).toEqual(DEMOS)
  await expect(page.getByTestId('site-archive-source')).toHaveCount(
    DEMOS.length,
  )
  await expect(page.getByTestId('site-archive-desktop')).toHaveCount(
    DEMOS.length,
  )
  await expect(page.getByTestId('site-archive-phone-link')).toHaveCount(
    DEMOS.length,
  )
  expect(errors).toEqual([])
})

for (const slug of DEMOS) {
  test(`${slug} opens from the archive on desktop and phone`, async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await page.goto('/uikit/#/full/site-archive')
    const row = page.locator(
      `[data-testid="site-archive-row"][data-demo="${slug}"]`,
    )

    await row.getByTestId('site-archive-desktop').click()
    await expect(page).toHaveURL(new RegExp(`#/full/${slug}$`))
    await expect(page.getByTestId('site-archive')).toHaveCount(0)
    await expect.poll(async () => (await centreTop(page)).inRoot).toBe(true)

    await page.goto('/uikit/#/full/site-archive')
    await row.getByTestId('site-archive-phone-link').click()
    await expect(page.frameLocator('iframe').locator('#root')).not.toBeEmpty()
    const child = await phoneFrame(page)
    expect(child.url()).toMatch(new RegExp(`#/full/${slug}$`))
    expect(await child.evaluate(() => [innerWidth, innerHeight])).toEqual([
      390, 844,
    ])
    await expect.poll(async () => (await centreTop(child)).inRoot).toBe(true)
    expect(errors).toEqual([])
  })
}

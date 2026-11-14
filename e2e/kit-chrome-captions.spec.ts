import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit chrome photo captions on every #/feature/* page: the credits-block `bad`
// list of the frozen uikit/scripts/qa.mjs v0.6.0, which built it but never
// asserted it. No credit inside the demo; under it, the kit chrome captions
// exactly the Commons (photos/hi/) photos the demo paints, as
// "Photo: Author · licence · modified" with Commons + licence links, 11px
// #535152, painted. The old "no chrome captions" rule assumed every listed
// page shows a hi/ photo; demos with only CC0 photos owe no caption, so it is
// asserted as "every hi/ photo shown has its caption, and no other caption".

test.use({ viewport: { width: 1440, height: 900 } })

const MANIFEST = path.resolve(
  process.cwd(),
  'uikit',
  'src',
  'kit',
  'pages.json',
)
const slugs = (
  JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { slug: string }[]
).map((p) => p.slug)

const demo = '[data-testid="demo"]'
const chrome = '[data-testid="kit-photo-credits"] [data-testid="photo-credit"]'

async function captionProblems(page: Page): Promise<string[]> {
  const bad: string[] = []
  const { text, shown } = await page.locator(demo).evaluate((root) => {
    const ids = new Set<string>()
    const add = (s: string | null | undefined) => {
      for (const m of (s ?? '').matchAll(/photos\/hi\/([\w-]+)\.jpg/g))
        ids.add(m[1] ?? '')
    }
    for (const e of [root, ...root.querySelectorAll('*')]) {
      add(getComputedStyle(e).backgroundImage)
      if (e instanceof HTMLImageElement) add(e.currentSrc || e.src)
      if (e instanceof SVGImageElement) add(e.href.baseVal)
    }
    // v8: in-screen captions (Welcome / empty library) are product UI, not kit credits.
    const c = root.cloneNode(true) as HTMLElement
    c.querySelectorAll('[data-testid="screen-credit"]').forEach((x) => {
      x.remove()
    })
    return { text: c.textContent, shown: [...ids].sort() }
  })
  if (
    (await page.locator(`${demo} [data-testid="photo-credit"]`).count()) ||
    /Photo: |Sources/.test(text)
  )
    bad.push('credit inside demo')
  const caps = await page.locator(chrome).evaluateAll((els) =>
    els.map((e) => {
      e.scrollIntoView({ block: 'center' })
      const r = e.getBoundingClientRect()
      const hit = document.elementFromPoint(
        r.left + Math.min(r.width / 2, 20),
        r.top + r.height / 2,
      )
      return {
        id: (e as HTMLElement).dataset.photo ?? '',
        text: e.textContent,
        author: e.querySelectorAll('a')[0]?.href ?? '',
        license: e.querySelectorAll('a')[1]?.href ?? '',
        size: getComputedStyle(e).fontSize,
        color: getComputedStyle(e).color,
        inDemo: e.closest('[data-testid=demo]') !== null,
        painted: hit !== null && e.contains(hit),
      }
    }),
  )
  const captioned = caps
    .map((c) => c.id)
    .sort()
    .join()
  if (captioned !== shown.join())
    bad.push(`captions [${captioned}] for hi/ photos [${shown.join()}]`)
  for (const c of caps) {
    if (
      !/^Photo: [^·]+ · (CC BY-SA 4\.0|Public domain) · modified$/.test(c.text)
    )
      bad.push(`"${c.text}"`)
    if (!c.author.includes('commons.wikimedia.org/wiki/File:'))
      bad.push(`author href ${c.author}`)
    if (
      c.text.includes('CC BY-SA')
        ? c.license !== 'https://creativecommons.org/licenses/by-sa/4.0/'
        : !c.license.includes('Public_domain')
    )
      bad.push(`license href ${c.license}`)
    if (c.size !== '11px' || c.color !== 'rgb(83, 81, 82)' || c.inDemo)
      bad.push(`${c.size} ${c.color} inDemo=${String(c.inDemo)}`)
    if (!c.painted) bad.push(`"${c.text}" not painted`)
  }
  return bad
}

test('feature pages with hi/ photos carry chrome captions', async ({
  page,
}) => {
  for (const slug of ['open-save-project', 'spread-templates-ui']) {
    await page.goto(`/uikit/#/feature/${slug}`)
    await expect(page.locator(chrome).first()).toBeVisible()
  }
})

for (const slug of slugs) {
  test(`#/feature/${slug}: kit chrome captions the demo photos`, async ({
    page,
  }) => {
    await page.goto(`/uikit/#/feature/${slug}`)
    await expect(page.locator(demo)).toBeVisible()
    await expect.poll(() => captionProblems(page)).toEqual([])
  })
}

import { expect, type Locator, type Page } from '@playwright/test'

/** no finite CSS transition / animation / WAAPI animation runs on `loc`, its ancestors or its subtree */
export async function animationsSettled(loc: Locator): Promise<void> {
  await expect
    .poll(() =>
      loc.evaluate(
        (el) =>
          document.getAnimations().filter((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target
            const finite = a.effect?.getComputedTiming().endTime !== Infinity
            return finite && a.playState === 'running' && t
              ? t.contains(el) || el.contains(t)
              : false
          }).length,
      ),
    )
    .toBe(0)
}

/**
 * Input pacing, not a state wait: resolves once the page's own clock has moved `ms` on (polled per frame),
 * so pointer / touch steps keep the speed a gesture test is about.
 */
export async function pageTimePasses(page: Page, ms: number): Promise<void> {
  const until = await page.evaluate((d) => performance.now() + d, ms)
  await page.waitForFunction((t) => performance.now() >= t, until)
}

import { expect, type Locator } from '@playwright/test'

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

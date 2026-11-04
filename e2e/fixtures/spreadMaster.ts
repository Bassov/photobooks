import { expect, type Page } from '@playwright/test'

const DEFAULT_SUFFIX = ' · default'

/** Spread inspector Master & spacing select (default-master: always a select). */
export const masterSelect = (page: Page) =>
  page.getByRole('combobox', { name: 'Master' })

/** The master names in the select, the default's " · default" kept. */
export const masterOptions = (page: Page) =>
  masterSelect(page)
    .locator('option')
    .evaluateAll((options) => options.map((option) => option.textContent))

/** The master the spread shows, without the default's " · default". */
export async function shownMaster(page: Page): Promise<string> {
  const text = await masterSelect(page).locator('option:checked').textContent()
  return (text ?? '').replace(DEFAULT_SUFFIX, '')
}

/** Pick a master by name ("None" clears it); the default's option reads "{name} · default". */
export async function pickMaster(page: Page, name: string): Promise<void> {
  const select = masterSelect(page)
  const value = await select
    .locator('option')
    .evaluateAll(
      (options, labels: readonly string[]) =>
        options
          .find((option) => labels.includes(option.textContent))
          ?.getAttribute('value') ?? null,
      [name, `${name}${DEFAULT_SUFFIX}`],
    )
  if (value === null) {
    throw new Error(`No master option "${name}"`)
  }
  await select.selectOption(value)
  await expect.poll(() => shownMaster(page)).toBe(name)
}

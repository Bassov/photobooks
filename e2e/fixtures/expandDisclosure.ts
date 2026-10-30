import { expect, type Page } from '@playwright/test'

/** Open a collapsed kit disclosure in the inspector (e.g. `Position & size`). */
export async function expandDisclosure(page: Page, name: string) {
  const trigger = page.getByRole('button', { name, exact: true })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
}

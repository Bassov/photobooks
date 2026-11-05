import { describe, expect, it } from 'vitest'
import { builtInPrintProfiles, printShopProfiles } from './catalog'
import { genericPrintProfile } from './genericProfile'
import { parsePrintProfile } from './profileSchema'
import { editableProfileIssues } from './profileText'

describe('print catalog (D8)', () => {
  it('lists Generic first, then every shop profile', () => {
    expect(builtInPrintProfiles()).toEqual([
      genericPrintProfile(),
      ...printShopProfiles(),
    ])
  })

  it('keeps shops A→Z with unique ids, each sourced, dated and valid', () => {
    const shops = printShopProfiles()
    const names = shops.map(({ name }) => name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    const ids = builtInPrintProfiles().map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const shop of shops) {
      expect(shop.source).toMatch(/^https:\/\//)
      expect(shop.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const parsed = parsePrintProfile(shop)
      expect(parsed.ok).toBe(true)
      expect(editableProfileIssues(shop)).toEqual([])
    }
  })
})

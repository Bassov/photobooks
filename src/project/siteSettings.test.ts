import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  parseLibrary,
  parseSiteSettings,
  serializeLibrary,
  SITE_TEXT_MAX,
} from './libraryDocument'
import { createMemoryLibraryStorage } from './memory'
import type { SiteSettings } from './types'

const PBT_RUNS = { numRuns: 500 }

function readSite(raw: unknown) {
  const parsed = parseLibrary({ schemaVersion: 4, books: {}, site: raw })
  if (!parsed.ok) {
    throw new Error('library.json did not parse')
  }
  return parsed.meta
}

describe('library.json site settings', () => {
  it('trims and collapses inner whitespace', () => {
    expect(
      readSite({
        title: '  My\n\n  books\t',
        author: ' Ann  Lee ',
        intro: 'Line one.\r\nLine two.',
      }).site,
    ).toEqual({
      title: 'My books',
      author: 'Ann Lee',
      intro: 'Line one. Line two.',
    })
  })

  it('drops empty, non-string and unknown values', () => {
    expect(
      readSite({ title: '   ', author: 7, intro: '', theme: 'dark' }),
    ).not.toHaveProperty('site')
    expect(readSite({ author: 'Ann', theme: 'dark' }).site).toEqual({
      author: 'Ann',
    })
    for (const raw of [undefined, null, 'dark', ['Ann'], {}]) {
      expect(readSite(raw)).not.toHaveProperty('site')
    }
  })

  it('clips title and author at 80 and intro at 160 characters', () => {
    expect(SITE_TEXT_MAX).toEqual({ title: 80, author: 80, intro: 160 })
    const site = readSite({
      title: 't'.repeat(81),
      author: 'a'.repeat(80),
      intro: `${'i'.repeat(159)} tail`,
    }).site
    expect(site).toEqual({
      title: 't'.repeat(80),
      author: 'a'.repeat(80),
      intro: 'i'.repeat(159),
    })
  })

  it('counts characters, not UTF-16 units, and never splits one', () => {
    const intro = '📷'.repeat(161)
    expect(parseSiteSettings({ intro })?.intro).toBe('📷'.repeat(160))
  })

  it('writes site only when a field is set', () => {
    expect(serializeLibrary({})).not.toHaveProperty('site')
    expect(serializeLibrary({ site: {} })).not.toHaveProperty('site')
    expect(serializeLibrary({ site: { author: ' Ann ' } }).site).toEqual({
      author: 'Ann',
    })
  })

  it('the memory adapter stores what library.json would read back', async () => {
    const library = createMemoryLibraryStorage()
    await library.updateLibrary({
      site: { title: ' Mine ', theme: 'dark' } as never,
    })
    const meta = await library.getLibrary()
    expect(meta.ok && meta.value.site).toEqual({ title: 'Mine' })
    await library.updateLibrary({})
    const cleared = await library.getLibrary()
    expect(cleared.ok && cleared.value).not.toHaveProperty('site')
  })

  const text = fc.string({ unit: 'grapheme-composite', maxLength: 200 })
  const looseSite = fc.record(
    {
      title: fc.oneof(text, fc.constant(' \n '), fc.integer()),
      author: text,
      intro: fc.oneof(text, fc.string({ unit: 'binary', maxLength: 200 })),
      theme: fc.constantFrom('light', 'dark'),
    },
    { requiredKeys: [] },
  )

  test.prop([looseSite], PBT_RUNS)(
    'every kept field is clean, short and non-empty',
    (raw) => {
      const site: SiteSettings = parseSiteSettings(raw) ?? {}
      for (const key of ['title', 'author', 'intro'] as const) {
        const value = site[key]
        if (value === undefined) {
          continue
        }
        expect(value).not.toBe('')
        expect(value).toBe(value.trim())
        expect(value).not.toMatch(/\s\s|[^\S ]/)
        expect(Array.from(value).length).toBeLessThanOrEqual(SITE_TEXT_MAX[key])
      }
      expect(site).not.toHaveProperty('theme')
      expect(Object.keys(site).length > 0).toBe(
        parseSiteSettings(raw) !== undefined,
      )
    },
  )

  test.prop([looseSite], PBT_RUNS)(
    'round trip: serialize → JSON → parse keeps the normalised site',
    (raw) => {
      const site = parseSiteSettings(raw)
      const json: unknown = JSON.parse(
        JSON.stringify(serializeLibrary({ site: raw as SiteSettings })),
      )
      const parsed = parseLibrary(json)
      expect(parsed.ok ? parsed.meta.site : 'failed').toEqual(site)
      expect(parsed.ok && 'site' in parsed.meta).toBe(site !== undefined)
      expect(parseSiteSettings(site)).toEqual(site)
    },
  )
})

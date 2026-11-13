import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryLibraryStorage } from '../project/memory'
import type { LibraryMeta } from '../project/types'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import {
  bindSiteSettingsLibrary,
  getSiteSettings,
  resetSiteSettingsForTests,
  seedSiteSettingsFromQuery,
  setSiteSettings,
  siteSettingsSettled,
  subscribeSiteSettings,
} from './siteSettingsStore'

afterEach(() => {
  resetSiteSettingsForTests()
  setEditorStatus('')
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const FAILED = "Couldn't save site settings to the library folder"

type Library = ReturnType<typeof createMemoryLibraryStorage>

async function storedSite(library: Library) {
  await siteSettingsSettled()
  const meta = await library.getLibrary()
  return meta.ok ? meta.value.site : 'unreadable'
}

describe('site settings store', () => {
  it('starts empty', () => {
    expect(getSiteSettings()).toEqual({})
  })

  it('normalises a patch and persists it; a rebind reloads it', async () => {
    const library = createMemoryLibraryStorage()
    await library.updateLibrary({ books: { b1: { status: 'published' } } })
    await bindSiteSettingsLibrary(library)
    setSiteSettings({ title: '  Alps\n\n& Sea ', author: 'Ann' })
    expect(getSiteSettings()).toEqual({ title: 'Alps & Sea', author: 'Ann' })
    expect(await storedSite(library)).toEqual({
      title: 'Alps & Sea',
      author: 'Ann',
    })
    const meta = await library.getLibrary()
    expect(meta.ok && meta.value.books).toEqual({ b1: { status: 'published' } })
    resetSiteSettingsForTests()
    await bindSiteSettingsLibrary(library)
    expect(getSiteSettings()).toEqual({ title: 'Alps & Sea', author: 'Ann' })
  })

  it("clears a field with '' and drops site when nothing is left", async () => {
    const library = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(library)
    setSiteSettings({ author: 'Ann', intro: 'Hi' })
    setSiteSettings({ author: '' })
    expect(getSiteSettings()).toEqual({ intro: 'Hi' })
    setSiteSettings({ intro: undefined })
    expect(getSiteSettings()).toEqual({})
    expect(await storedSite(library)).toBeUndefined()
  })

  it('writes nothing and notifies no one when the value is unchanged', async () => {
    const library = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(library)
    setSiteSettings({ author: 'Ann', intro: 'Hi' })
    await siteSettingsSettled()
    const write = vi.spyOn(library, 'updateLibrary')
    const listener = vi.fn()
    subscribeSiteSettings(listener)
    setSiteSettings({ author: ' Ann ' })
    setSiteSettings({ intro: ' Hi\n' })
    setSiteSettings({ title: '   ' })
    await siteSettingsSettled()
    expect(write).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('writes in call order, each over the previous write', async () => {
    const library = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(library)
    const writes: LibraryMeta['site'][] = []
    const update = library.updateLibrary.bind(library)
    vi.spyOn(library, 'updateLibrary').mockImplementation(async (meta) => {
      // A slow first write must not let the second one read ahead of it.
      await new Promise((resolve) => setTimeout(resolve, writes.length ? 0 : 5))
      writes.push(meta.site)
      return update(meta)
    })
    setSiteSettings({ title: 'One' })
    setSiteSettings({ author: 'Ann' })
    setSiteSettings({ title: 'Two' })
    expect(await storedSite(library)).toEqual({ title: 'Two', author: 'Ann' })
    expect(writes).toEqual([
      { title: 'One' },
      { title: 'One', author: 'Ann' },
      { title: 'Two', author: 'Ann' },
    ])
  })

  it('keeps the session values and says so when the write fails', async () => {
    const library = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(library)
    vi.spyOn(library, 'updateLibrary').mockRejectedValue(new Error('denied'))
    setSiteSettings({ author: 'Ann' })
    await siteSettingsSettled()
    expect(getSiteSettings()).toEqual({ author: 'Ann' })
    expect(getEditorStatus()).toBe(FAILED)
  })

  it('says so when the write returns a failure or library.json turns unreadable; quiet on success', async () => {
    const library = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(library)
    setSiteSettings({ author: 'Ann' })
    await siteSettingsSettled()
    expect(getEditorStatus()).toBe('')
    const read = vi.spyOn(library, 'getLibrary').mockResolvedValue({
      ok: false,
      error: { kind: 'unknown' },
    } as never)
    setSiteSettings({ author: 'Bea' })
    await siteSettingsSettled()
    expect(getEditorStatus()).toBe(FAILED)
    read.mockRestore()
    setEditorStatus('')
    library.setLockedElsewhere(true)
    setSiteSettings({ author: 'Cy' })
    await siteSettingsSettled()
    expect(getEditorStatus()).toBe(FAILED)
  })

  it('an unreadable library.json keeps the session values and writes nothing', async () => {
    const library = createMemoryLibraryStorage()
    vi.spyOn(library, 'getLibrary').mockResolvedValue({
      ok: false,
      error: { kind: 'unknown' },
    } as never)
    const write = vi.spyOn(library, 'updateLibrary')
    await bindSiteSettingsLibrary(library)
    setSiteSettings({ title: 'Mine' })
    await siteSettingsSettled()
    expect(getSiteSettings()).toEqual({ title: 'Mine' })
    expect(write).not.toHaveBeenCalled()
  })

  it('switches libraries without leaking settings; a newer bind wins', async () => {
    const first = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(first)
    setSiteSettings({ title: 'First' })
    await siteSettingsSettled()
    resetSiteSettingsForTests()
    const second = createMemoryLibraryStorage()
    void bindSiteSettingsLibrary(first)
    await bindSiteSettingsLibrary(second)
    expect(getSiteSettings()).toEqual({})
    await bindSiteSettingsLibrary(second)
    expect(getSiteSettings()).toEqual({})
    await bindSiteSettingsLibrary(null)
    expect(getSiteSettings()).toEqual({})
  })

  it('stops notifying after unsubscribe; binding notifies', async () => {
    const listener = vi.fn()
    const off = subscribeSiteSettings(listener)
    await bindSiteSettingsLibrary(createMemoryLibraryStorage())
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    setSiteSettings({ title: 'X' })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('seeds from ?siteSettings= JSON, normalised; bad JSON is ignored', () => {
    seedSiteSettingsFromQuery('?siteSettings=not-json')
    seedSiteSettingsFromQuery('?other=1')
    expect(getSiteSettings()).toEqual({})
    seedSiteSettingsFromQuery(
      `?siteSettings=${encodeURIComponent('{"author":" Ann ","intro":"Hi","x":1}')}`,
    )
    expect(getSiteSettings()).toEqual({ author: 'Ann', intro: 'Hi' })
  })

  it('seeds only in dev or a fixtures build', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '0')
    seedSiteSettingsFromQuery('?siteSettings={"title":"T"}')
    expect(getSiteSettings()).toEqual({})
    vi.stubEnv('VITE_TEST_FIXTURES', '1')
    seedSiteSettingsFromQuery('?siteSettings={"title":"T"}')
    expect(getSiteSettings()).toEqual({ title: 'T' })
  })

  it('re-seeds from the page URL when a library (or none) is bound', async () => {
    window.history.replaceState(null, '', '/?siteSettings={"title":"Seed"}')
    try {
      const library = createMemoryLibraryStorage()
      await bindSiteSettingsLibrary(library)
      expect(getSiteSettings()).toEqual({ title: 'Seed' })
      expect(await storedSite(library)).toEqual({ title: 'Seed' })
      await bindSiteSettingsLibrary(null)
      expect(getSiteSettings()).toEqual({ title: 'Seed' })
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })
})

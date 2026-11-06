import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PRINT_PROFILE_ID, genericPrintProfile } from '../core'
import { makeCustomPrintProfile } from '../core/testing/fixtures'
import { createMemoryLibraryStorage } from '../project/memory'
import {
  dispatchBookOp,
  getBookPrintProfiles,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import {
  bindPrintProfilesLibrary,
  copyName,
  deletePrintProfile,
  duplicatePrintProfile,
  getPrintProfiles,
  getPrintProfilesState,
  kitSampleProfile,
  newPrintProfile,
  printProfilesSettled,
  resetPrintProfilesForTests,
  savePrintProfile,
  seedPrintProfilesFromQuery,
  setDefaultPrintProfileId,
  subscribePrintProfiles,
} from './printProfilesStore'

afterEach(() => {
  resetPrintProfilesForTests()
  resetBookStore()
  setEditorStatus('')
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

type Library = ReturnType<typeof createMemoryLibraryStorage>

async function stored(library: Library) {
  await printProfilesSettled()
  const meta = await library.getLibrary()
  return meta.ok
    ? [meta.value.printProfiles, meta.value.defaultPrintProfileId]
    : undefined
}

describe('copyName (D9)', () => {
  it('adds (copy), then counts up past taken names', () => {
    expect(copyName('Generic', [])).toBe('Generic (copy)')
    expect(copyName('Generic', ['Generic (copy)'])).toBe('Generic (copy 2)')
    expect(
      copyName('Generic (copy 2)', ['Generic (copy)', 'Generic (copy 2)']),
    ).toBe('Generic (copy 3)')
  })

  it('strips only a trailing (copy) / (copy n), any number of digits', () => {
    expect(copyName('Lab (copy)', [])).toBe('Lab (copy)')
    expect(copyName('Lab (copy 12)', [])).toBe('Lab (copy)')
    expect(copyName('Lab (copy) A', [])).toBe('Lab (copy) A (copy)')
  })
})

describe('print profiles store', () => {
  it('starts with no customs and Generic as the default', () => {
    expect(getPrintProfilesState()).toEqual({
      customs: [],
      defaultId: DEFAULT_PRINT_PROFILE_ID,
    })
  })

  it('duplicates into the list at once, based on the source', () => {
    const listener = vi.fn()
    const stop = subscribePrintProfiles(listener)
    const copy = duplicatePrintProfile(genericPrintProfile(), ['Generic'])
    stop()
    expect(copy).toMatchObject({ name: 'Generic (copy)', basedOn: 'Generic' })
    expect(copy.id).toMatch(/^custom-/)
    expect(getPrintProfiles()).toEqual([copy])
    expect(getBookPrintProfiles()).toBe(getPrintProfiles())
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps a new profile out of the list until it is saved', () => {
    const fresh = newPrintProfile()
    expect(fresh).toMatchObject({ name: 'New profile', basedOn: 'Generic' })
    expect(getPrintProfiles()).toEqual([])
    savePrintProfile(fresh)
    savePrintProfile({ ...fresh, name: 'Renamed' })
    expect(getPrintProfiles()).toEqual([{ ...fresh, name: 'Renamed' }])
  })

  it('refreshes the open book that uses a saved profile', () => {
    const custom = makeCustomPrintProfile()
    savePrintProfile(custom)
    dispatchBookOp({
      type: 'setPrintProfile',
      id: custom.id,
      customs: [custom],
    })
    savePrintProfile({ ...custom, safeMarginMm: 9 })
    const { book } = getBookStoreSnapshot()
    expect(book.printProfile?.snapshot?.safeMarginMm).toBe(9)
    expect(book.settings.safeMarginMm).toBe(9)
  })

  it('falls back to Generic when the default is deleted', () => {
    const custom = makeCustomPrintProfile()
    savePrintProfile(custom)
    setDefaultPrintProfileId(custom.id)
    expect(getPrintProfilesState().defaultId).toBe(custom.id)
    const before = getPrintProfilesState()
    setDefaultPrintProfileId(custom.id)
    expect(getPrintProfilesState()).toBe(before)
    deletePrintProfile(custom.id)
    expect(getPrintProfilesState()).toEqual({
      customs: [],
      defaultId: DEFAULT_PRINT_PROFILE_ID,
    })
  })

  it('persists to library.json and reloads after a rebind', async () => {
    const library = createMemoryLibraryStorage()
    await bindPrintProfilesLibrary(library)
    const custom = makeCustomPrintProfile()
    savePrintProfile(custom)
    setDefaultPrintProfileId(custom.id)
    expect(await stored(library)).toEqual([[custom], custom.id])
    resetPrintProfilesForTests()
    expect(getPrintProfiles()).toEqual([])
    await bindPrintProfilesLibrary(library)
    expect(getPrintProfilesState()).toEqual({
      customs: [custom],
      defaultId: custom.id,
    })
  })

  it('keeps session profiles and says so when the write fails', async () => {
    const library = createMemoryLibraryStorage()
    await bindPrintProfilesLibrary(library)
    vi.spyOn(library, 'updateLibrary').mockRejectedValue(new Error('denied'))
    savePrintProfile(makeCustomPrintProfile())
    await printProfilesSettled()
    expect(getPrintProfiles()).toHaveLength(1)
    expect(getEditorStatus()).toBe(
      "Couldn't save print profiles to the library folder",
    )
  })

  it('switches libraries without leaking profiles', async () => {
    const first = createMemoryLibraryStorage()
    await bindPrintProfilesLibrary(first)
    savePrintProfile(makeCustomPrintProfile())
    await bindPrintProfilesLibrary(createMemoryLibraryStorage())
    expect(getPrintProfiles()).toEqual([])
    await bindPrintProfilesLibrary(null)
    expect(getPrintProfiles()).toEqual([])
  })

  it('seeds the kit sample once from ?printProfiles=kit', () => {
    seedPrintProfilesFromQuery('?printProfiles=other')
    expect(getPrintProfiles()).toEqual([])
    const custom = makeCustomPrintProfile()
    savePrintProfile(custom)
    seedPrintProfilesFromQuery('?printProfiles=kit')
    seedPrintProfilesFromQuery('?printProfiles=kit')
    expect(getPrintProfiles()).toEqual([custom, kitSampleProfile()])
  })

  it('seeds only in dev or a fixtures build', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_TEST_FIXTURES', '0')
    seedPrintProfilesFromQuery('?printProfiles=kit')
    expect(getPrintProfiles()).toEqual([])
    vi.stubEnv('VITE_TEST_FIXTURES', '1')
    seedPrintProfilesFromQuery('?printProfiles=kit')
    expect(getPrintProfiles()).toEqual([kitSampleProfile()])
  })

  it('is the kit sample: 15.2–30.5 cm, bleed and safe, 24–240 by 2, 300 / 150 ppi', () => {
    expect(kitSampleProfile()).toEqual({
      ...genericPrintProfile(),
      id: 'custom-kit-sample',
      name: 'Photo book 300 ppi',
      basedOn: 'Generic',
      trimMinMm: 152,
      trimMaxMm: 305,
      bleedMinMm: 5,
      bleedMaxMm: 5,
      safeMarginMm: 15,
      pageCount: { min: 24, step: 2, max: 240 },
      dpi: { warn: 300, min: 150 },
    })
  })

  it('re-seeds from the page URL when a library (or none) is bound', async () => {
    window.history.replaceState(null, '', '/?printProfiles=kit')
    try {
      await bindPrintProfilesLibrary(createMemoryLibraryStorage())
      expect(getPrintProfiles()).toEqual([kitSampleProfile()])
      await bindPrintProfilesLibrary(null)
      expect(getPrintProfiles()).toEqual([kitSampleProfile()])
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('replaces only the saved profile and adds a new one after the others', () => {
    const a = makeCustomPrintProfile()
    const b = { ...makeCustomPrintProfile(), id: 'custom-b', name: 'B' }
    savePrintProfile(a)
    savePrintProfile(b)
    savePrintProfile({ ...a, name: 'A2' })
    expect(getPrintProfiles()).toEqual([{ ...a, name: 'A2' }, b])
  })

  it('deletes one profile and keeps a default it did not hold', () => {
    const a = makeCustomPrintProfile()
    const b = { ...makeCustomPrintProfile(), id: 'custom-b', name: 'B' }
    savePrintProfile(a)
    savePrintProfile(b)
    setDefaultPrintProfileId(b.id)
    deletePrintProfile(a.id)
    expect(getPrintProfilesState()).toEqual({ customs: [b], defaultId: b.id })
  })

  it('stops notifying after unsubscribe; binding notifies', async () => {
    const listener = vi.fn()
    const stop = subscribePrintProfiles(listener)
    await bindPrintProfilesLibrary(createMemoryLibraryStorage())
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    await bindPrintProfilesLibrary(null)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    savePrintProfile(makeCustomPrintProfile())
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rebinding the same library keeps its profiles', async () => {
    const library = createMemoryLibraryStorage()
    await bindPrintProfilesLibrary(library)
    const custom = makeCustomPrintProfile()
    savePrintProfile(custom)
    await bindPrintProfilesLibrary(library)
    expect(getPrintProfiles()).toEqual([custom])
  })

  it('a library bound meanwhile wins over a slower load', async () => {
    const first = createMemoryLibraryStorage()
    await bindPrintProfilesLibrary(first)
    savePrintProfile(makeCustomPrintProfile())
    await printProfilesSettled()
    resetPrintProfilesForTests()
    const second = createMemoryLibraryStorage()
    void bindPrintProfilesLibrary(first)
    await bindPrintProfilesLibrary(second)
    expect(getPrintProfiles()).toEqual([])
    const write = vi.spyOn(first, 'updateLibrary')
    savePrintProfile(makeCustomPrintProfile())
    await printProfilesSettled()
    expect(write).not.toHaveBeenCalled()
  })

  it('an unreadable library.json keeps the session list and writes nothing', async () => {
    const library = createMemoryLibraryStorage()
    vi.spyOn(library, 'getLibrary').mockResolvedValue({
      ok: false,
      error: { kind: 'unknown' },
    } as never)
    const write = vi.spyOn(library, 'updateLibrary')
    await bindPrintProfilesLibrary(library)
    savePrintProfile(makeCustomPrintProfile())
    await printProfilesSettled()
    expect(getPrintProfiles()).toHaveLength(1)
    expect(write).not.toHaveBeenCalled()
  })

  it('says so when library.json turns unreadable before a write; quiet on success', async () => {
    const library = createMemoryLibraryStorage()
    await bindPrintProfilesLibrary(library)
    savePrintProfile(makeCustomPrintProfile())
    await printProfilesSettled()
    expect(getEditorStatus()).toBe('')
    vi.spyOn(library, 'getLibrary').mockResolvedValue({
      ok: false,
      error: { kind: 'unknown' },
    } as never)
    setDefaultPrintProfileId('generic-x')
    await printProfilesSettled()
    expect(getEditorStatus()).toBe(
      "Couldn't save print profiles to the library folder",
    )
  })

  it('the test reset also clears the book store customs', () => {
    savePrintProfile(makeCustomPrintProfile())
    resetPrintProfilesForTests()
    expect(getBookPrintProfiles()).toEqual([])
  })
})

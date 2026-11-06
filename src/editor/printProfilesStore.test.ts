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
    seedPrintProfilesFromQuery('?printProfiles=kit')
    seedPrintProfilesFromQuery('?printProfiles=kit')
    expect(getPrintProfiles()).toEqual([kitSampleProfile()])
  })
})

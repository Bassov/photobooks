import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryLibraryStorage } from '../project/memory'
import {
  KIT_TEMPLATES,
  addSavedTemplate,
  bindSavedTemplatesLibrary,
  deleteSavedTemplate,
  duplicateSavedTemplate,
  findSavedTemplate,
  flushSavedTemplatesForTests,
  getSavedTemplates,
  nextTemplateName,
  renameSavedTemplate,
  resetSavedTemplatesForTests,
  seedSavedTemplatesFromQuery,
  subscribeSavedTemplates,
  type SavedTemplate,
} from './savedTemplates'

const LEGACY_KEY = 'photobooks.templates.v1'
const SLOTS = [{ x: 0, y: 0, w: 50, h: 100 }]

afterEach(() => {
  window.localStorage.clear()
  resetSavedTemplatesForTests()
  vi.restoreAllMocks()
})

/** Simulates a reload: the store forgets everything and binds `library` again. */
async function reopen(library: ReturnType<typeof createMemoryLibraryStorage>) {
  await flushSavedTemplatesForTests()
  resetSavedTemplatesForTests()
  await bindSavedTemplatesLibrary(library)
  return getSavedTemplates()
}

async function storedTemplates(
  library: ReturnType<typeof createMemoryLibraryStorage>,
) {
  await flushSavedTemplatesForTests()
  const meta = await library.getLibrary()
  return meta.ok ? meta.value.templates : undefined
}

const template = (id: string, pages: 1 | 2 = 2): SavedTemplate => ({
  id,
  name: id,
  pages,
  slots: SLOTS,
})

describe('saved templates store (kit My templates)', () => {
  it('a new user has none', () => {
    expect(getSavedTemplates()).toEqual([])
    expect(nextTemplateName()).toBe('My layout 1')
  })

  it('saves under the next free name with its page count and persists in library.json', async () => {
    const library = createMemoryLibraryStorage()
    await bindSavedTemplatesLibrary(library)
    const listener = vi.fn()
    const off = subscribeSavedTemplates(listener)
    const first = addSavedTemplate(nextTemplateName(), SLOTS)
    expect(first.id).toMatch(/^user-/)
    expect(first.name).toBe('My layout 1')
    expect(first.pages).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    const page = addSavedTemplate(nextTemplateName(), SLOTS, 1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect((await reopen(library)).map((t) => [t.name, t.pages])).toEqual([
      ['My layout 1', 2],
      ['My layout 2', 1],
    ])
    expect(findSavedTemplate(first.id)?.slots).toEqual(SLOTS)
    expect(findSavedTemplate('user-nope')).toBeUndefined()
    // With a page count, only a layout saved on that count is found.
    expect(findSavedTemplate(first.id, 2)?.id).toBe(first.id)
    expect(findSavedTemplate(first.id, 1)).toBeUndefined()
    expect(findSavedTemplate(page.id, 1)?.id).toBe(page.id)
  })

  it('fills the first gap in "My layout N"', () => {
    addSavedTemplate('My layout 1', SLOTS)
    addSavedTemplate('My layout 3', SLOTS)
    expect(nextTemplateName()).toBe('My layout 2')
  })

  it('renames (trimmed) and ignores a blank name', async () => {
    const library = createMemoryLibraryStorage()
    await bindSavedTemplatesLibrary(library)
    const t = addSavedTemplate('My layout 1', SLOTS)
    renameSavedTemplate(t.id, '  Trip opener ')
    expect(findSavedTemplate(t.id)?.name).toBe('Trip opener')
    renameSavedTemplate(t.id, '   ')
    expect((await reopen(library))[0]?.name).toBe('Trip opener')
  })

  it('duplicates right after the source as "<name> copy", then "copy 2"', async () => {
    const library = createMemoryLibraryStorage()
    await bindSavedTemplatesLibrary(library)
    const a = addSavedTemplate('A', SLOTS, 1)
    const b = addSavedTemplate('B', SLOTS)
    const copy = duplicateSavedTemplate(a.id)
    const copy2 = duplicateSavedTemplate(a.id)
    expect(copy?.name).toBe('A copy')
    expect(copy2?.name).toBe('A copy 2')
    const copy3 = duplicateSavedTemplate(a.id)
    expect(copy3?.name).toBe('A copy 3')
    deleteSavedTemplate(copy3?.id ?? '')
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'A',
      'A copy 2',
      'A copy',
      'B',
    ])
    expect(copy?.slots).toEqual(SLOTS)
    // A copy keeps the page count of its source.
    expect(copy?.pages).toBe(1)
    expect(duplicateSavedTemplate('user-gone')).toBeUndefined()
    deleteSavedTemplate(b.id)
    expect((await reopen(library)).map((t) => t.name)).toEqual([
      'A',
      'A copy 2',
      'A copy',
    ])
  })
})

describe('saved templates in library.json', () => {
  it('loads the open library list and reloads it when another library opens', async () => {
    const first = createMemoryLibraryStorage()
    const second = createMemoryLibraryStorage()
    await first.updateLibrary({ templates: [template('user-a')] })
    await second.updateLibrary({ templates: [template('user-b', 1)] })
    const listener = vi.fn()
    subscribeSavedTemplates(listener)
    const loading = bindSavedTemplatesLibrary(first)
    // Cleared at once, then filled when library.json is read.
    expect(getSavedTemplates()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(1)
    await loading
    expect(getSavedTemplates().map((t) => t.id)).toEqual(['user-a'])
    expect(listener).toHaveBeenCalledTimes(2)
    await bindSavedTemplatesLibrary(second)
    expect(getSavedTemplates()).toEqual([template('user-b', 1)])
    expect(listener).toHaveBeenCalledTimes(4)
    // Binding the same library again keeps the list (no reload).
    const spy = vi.spyOn(second, 'getLibrary')
    await bindSavedTemplatesLibrary(second)
    expect(spy).not.toHaveBeenCalled()
    // Leaving the library: a session-only list.
    await bindSavedTemplatesLibrary(null)
    expect(getSavedTemplates()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(5)
    addSavedTemplate('Session', SLOTS)
    expect(await storedTemplates(second)).toEqual([template('user-b', 1)])
  })

  it('a slow load of the previous library never lands in the next one', async () => {
    const slow = createMemoryLibraryStorage()
    await slow.updateLibrary({ templates: [template('user-slow')] })
    const fast = createMemoryLibraryStorage()
    await fast.updateLibrary({ templates: [template('user-fast')] })
    const loading = bindSavedTemplatesLibrary(slow)
    void bindSavedTemplatesLibrary(fast)
    await loading
    await flushSavedTemplatesForTests()
    expect(getSavedTemplates().map((t) => t.id)).toEqual(['user-fast'])
  })

  it('a load that finishes after leaving the library changes nothing', async () => {
    const library = createMemoryLibraryStorage()
    await library.updateLibrary({ templates: [template('user-a')] })
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([template('user-x')]),
    )
    const empty = createMemoryLibraryStorage()
    void bindSavedTemplatesLibrary(library)
    void bindSavedTemplatesLibrary(empty)
    void bindSavedTemplatesLibrary(null)
    await flushSavedTemplatesForTests()
    expect(getSavedTemplates()).toEqual([])
    // The stale load of the empty library imported nothing either.
    expect(await storedTemplates(empty)).toEqual([])
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('a save while the library is still loading keeps the stored templates', async () => {
    const library = createMemoryLibraryStorage()
    await library.updateLibrary({ templates: [template('user-a')] })
    void bindSavedTemplatesLibrary(library)
    const added = addSavedTemplate('X', SLOTS)
    await flushSavedTemplatesForTests()
    expect(getSavedTemplates()).toEqual([template('user-a'), added])
    expect(await storedTemplates(library)).toEqual([template('user-a'), added])
  })

  it('a save queued just before another library opens lands in its own library', async () => {
    const first = createMemoryLibraryStorage()
    const second = createMemoryLibraryStorage()
    await second.updateLibrary({ templates: [template('user-b')] })
    await bindSavedTemplatesLibrary(first)
    const added = addSavedTemplate('X', SLOTS)
    void bindSavedTemplatesLibrary(second)
    await flushSavedTemplatesForTests()
    expect(await storedTemplates(first)).toEqual([added])
    expect(await storedTemplates(second)).toEqual([template('user-b')])
    expect(getSavedTemplates()).toEqual([template('user-b')])
  })

  it('a library.json read without a templates list reads as none', async () => {
    const library = createMemoryLibraryStorage()
    vi.spyOn(library, 'getLibrary').mockResolvedValue({
      ok: true,
      value: {},
    })
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates()).toEqual([])
  })

  it('writes every change through updateLibrary and keeps the publish statuses', async () => {
    const library = createMemoryLibraryStorage()
    const books = { b1: { status: 'published' as const } }
    await library.updateLibrary({ books })
    await bindSavedTemplatesLibrary(library)
    const update = vi.spyOn(library, 'updateLibrary')
    const a = addSavedTemplate('A', SLOTS)
    renameSavedTemplate(a.id, 'A2')
    addSavedTemplate('B', SLOTS, 1)
    await flushSavedTemplatesForTests()
    expect(update).toHaveBeenCalledTimes(3)
    const meta = await library.getLibrary()
    // Serialized writes: the last change wins.
    expect(meta).toEqual({
      ok: true,
      value: {
        books,
        templates: [
          { ...a, name: 'A2' },
          expect.objectContaining({ name: 'B', pages: 1 }),
        ],
      },
    })
  })

  it('an unreadable library lists none and is never written', async () => {
    const library = createMemoryLibraryStorage()
    await library.updateLibrary({ templates: [template('user-a')] })
    library.setPermissionRequired(true)
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([template('user-x')]),
    )
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates()).toEqual([])
    const update = vi.spyOn(library, 'updateLibrary')
    addSavedTemplate('A', SLOTS)
    await flushSavedTemplatesForTests()
    expect(update).not.toHaveBeenCalled()
    // The legacy list waits for a readable library.
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })
})

describe('one-time import of the localStorage list', () => {
  const legacy = [
    { id: 'user-a', name: 'A', slots: SLOTS },
    { id: 'full-bleed', name: 'x', slots: SLOTS },
    { id: 'user-b', name: 'B', slots: SLOTS },
  ]

  it('imports valid entries as two-page layouts, writes library.json, then removes the key', async () => {
    const library = createMemoryLibraryStorage()
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    await bindSavedTemplatesLibrary(library)
    const want = [template('user-a'), template('user-b')].map((t) => ({
      ...t,
      name: t.id === 'user-a' ? 'A' : 'B',
    }))
    expect(getSavedTemplates()).toEqual(want)
    expect(await storedTemplates(library)).toEqual(want)
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
    // Once: the next empty library gets nothing.
    const next = createMemoryLibraryStorage()
    await bindSavedTemplatesLibrary(next)
    expect(getSavedTemplates()).toEqual([])
  })

  it('a library that already has templates keeps them and the key stays', async () => {
    const library = createMemoryLibraryStorage()
    await library.updateLibrary({ templates: [template('user-own')] })
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates().map((t) => t.id)).toEqual(['user-own'])
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('keeps the key when library.json cannot be read back for the write', async () => {
    const library = createMemoryLibraryStorage()
    const read = library.getLibrary.bind(library)
    vi.spyOn(library, 'getLibrary')
      .mockImplementationOnce(read)
      .mockResolvedValue({ ok: false, code: 'permission-required' })
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates().map((t) => t.id)).toEqual(['user-a', 'user-b'])
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('keeps the key when library.json cannot be written', async () => {
    const library = createMemoryLibraryStorage()
    library.setLockedElsewhere(true)
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates().map((t) => t.id)).toEqual(['user-a', 'user-b'])
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it.each([
    ['not JSON', '{not json'],
    ['not a list', '{"id":"user-a"}'],
    [
      'only foreign ids',
      JSON.stringify([{ id: 'x', name: 'x', slots: SLOTS }]),
    ],
    [
      'blank names',
      JSON.stringify([{ id: 'user-a', name: ' ', slots: SLOTS }]),
    ],
    ['no slots', JSON.stringify([{ id: 'user-a', name: 'A', slots: [] }])],
    [
      'a zero-width slot',
      JSON.stringify([
        { id: 'user-a', name: 'A', slots: [{ x: 0, y: 0, w: 0, h: 5 }] },
      ]),
    ],
    ['non-object entries', JSON.stringify([null, 3, 'user-a'])],
  ])('ignores a corrupt or foreign list (%s)', async (_label, raw) => {
    const library = createMemoryLibraryStorage()
    window.localStorage.setItem(LEGACY_KEY, raw)
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates()).toEqual([])
    expect(await storedTemplates(library)).toEqual([])
  })

  it('keeps working when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const library = createMemoryLibraryStorage()
    await bindSavedTemplatesLibrary(library)
    expect(getSavedTemplates()).toEqual([])
    addSavedTemplate('A', SLOTS)
    expect(getSavedTemplates().map((t) => t.name)).toEqual(['A'])
  })

  it('keeps the list when the key cannot be removed', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const library = createMemoryLibraryStorage()
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    await bindSavedTemplatesLibrary(library)
    expect(await storedTemplates(library)).toHaveLength(2)
  })
})

describe('?templates=kit seed (dev / test builds only)', () => {
  it('adds the kit #/demo templates once, as two-page layouts', () => {
    const listener = vi.fn()
    const off = subscribeSavedTemplates(listener)
    seedSavedTemplatesFromQuery('?templates=kit')
    seedSavedTemplatesFromQuery('?templates=kit')
    off()
    // The second seed finds all three and neither writes nor notifies.
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'Travel opener',
      'Polaroid pair',
      'Quote + photo',
    ])
    expect(getSavedTemplates().map((t) => t.slots)).toEqual(
      KIT_TEMPLATES.map((t) => t.slots),
    )
    expect(getSavedTemplates().every((t) => t.pages === 2)).toBe(true)
  })

  it('the first read and every library load seed from the page URL', async () => {
    window.history.replaceState(null, '', '/?templates=kit')
    try {
      expect(getSavedTemplates().map((t) => t.id)).toEqual(
        KIT_TEMPLATES.map((t) => t.id),
      )
      const library = createMemoryLibraryStorage()
      await library.updateLibrary({ templates: [template('user-own')] })
      await bindSavedTemplatesLibrary(library)
      const ids = ['user-own', ...KIT_TEMPLATES.map((t) => t.id)]
      expect(getSavedTemplates().map((t) => t.id)).toEqual(ids)
      expect((await storedTemplates(library))?.map((t) => t.id)).toEqual(ids)
      await bindSavedTemplatesLibrary(null)
      expect(getSavedTemplates().map((t) => t.id)).toEqual(
        KIT_TEMPLATES.map((t) => t.id),
      )
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('a production build ignores the query; a VITE_TEST_FIXTURES build honours it', () => {
    vi.stubEnv('DEV', false)
    try {
      vi.stubEnv('VITE_TEST_FIXTURES', '')
      seedSavedTemplatesFromQuery('?templates=kit')
      expect(getSavedTemplates()).toEqual([])
      vi.stubEnv('VITE_TEST_FIXTURES', '1')
      seedSavedTemplatesFromQuery('?templates=kit')
      expect(getSavedTemplates().map((t) => t.id)).toEqual(
        KIT_TEMPLATES.map((t) => t.id),
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does nothing without the query', () => {
    seedSavedTemplatesFromQuery('')
    seedSavedTemplatesFromQuery('?templates=other')
    expect(getSavedTemplates()).toEqual([])
  })
})

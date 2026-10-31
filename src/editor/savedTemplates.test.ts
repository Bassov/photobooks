import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KIT_TEMPLATES,
  addSavedTemplate,
  deleteSavedTemplate,
  duplicateSavedTemplate,
  findSavedTemplate,
  getSavedTemplates,
  nextTemplateName,
  renameSavedTemplate,
  resetSavedTemplatesForTests,
  seedSavedTemplatesFromQuery,
  subscribeSavedTemplates,
} from './savedTemplates'

const KEY = 'photobooks.templates.v1'
const SLOTS = [{ x: 0, y: 0, w: 50, h: 100 }]

afterEach(() => {
  window.localStorage.clear()
  resetSavedTemplatesForTests()
  vi.restoreAllMocks()
})

/** Simulates a reload: the next read comes from storage. */
function reload() {
  resetSavedTemplatesForTests()
  return getSavedTemplates()
}

describe('saved templates store (kit My templates)', () => {
  it('a new user has none', () => {
    expect(getSavedTemplates()).toEqual([])
    expect(nextTemplateName()).toBe('My layout 1')
  })

  it('saves under the next free name and persists across a reload', () => {
    const listener = vi.fn()
    const off = subscribeSavedTemplates(listener)
    const first = addSavedTemplate(nextTemplateName(), SLOTS)
    expect(first.id).toMatch(/^user-/)
    expect(first.name).toBe('My layout 1')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    addSavedTemplate(nextTemplateName(), SLOTS)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(reload().map((t) => t.name)).toEqual(['My layout 1', 'My layout 2'])
    expect(findSavedTemplate(first.id)?.slots).toEqual(SLOTS)
    expect(findSavedTemplate('user-nope')).toBeUndefined()
  })

  it('fills the first gap in "My layout N"', () => {
    addSavedTemplate('My layout 1', SLOTS)
    addSavedTemplate('My layout 3', SLOTS)
    expect(nextTemplateName()).toBe('My layout 2')
  })

  it('renames (trimmed) and ignores a blank name', () => {
    const t = addSavedTemplate('My layout 1', SLOTS)
    renameSavedTemplate(t.id, '  Trip opener ')
    expect(findSavedTemplate(t.id)?.name).toBe('Trip opener')
    renameSavedTemplate(t.id, '   ')
    expect(reload()[0]?.name).toBe('Trip opener')
  })

  it('duplicates right after the source as "<name> copy", then "copy 2"', () => {
    const a = addSavedTemplate('A', SLOTS)
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
    expect(duplicateSavedTemplate('user-gone')).toBeUndefined()
    deleteSavedTemplate(b.id)
    expect(reload().map((t) => t.name)).toEqual(['A', 'A copy 2', 'A copy'])
  })

  it('ignores corrupt or foreign storage', () => {
    window.localStorage.setItem(KEY, '{not json')
    expect(reload()).toEqual([])
    window.localStorage.setItem(
      KEY,
      JSON.stringify([{ id: 'full-bleed', name: 'x', slots: SLOTS }]),
    )
    expect(reload()).toEqual([])
    window.localStorage.setItem(
      KEY,
      JSON.stringify([{ id: 'user-a', name: ' ', slots: SLOTS }]),
    )
    expect(reload()).toEqual([])
    window.localStorage.setItem(
      KEY,
      JSON.stringify([{ id: 'user-a', name: 'A', slots: [] }]),
    )
    expect(reload()).toEqual([])
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'user-a', name: 'A', slots: [{ x: 0, y: 0, w: 0, h: 5 }] },
      ]),
    )
    expect(reload()).toEqual([])
  })

  it('keeps working for the session when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(reload()).toEqual([])
    addSavedTemplate('A', SLOTS)
    expect(getSavedTemplates().map((t) => t.name)).toEqual(['A'])
  })
})

describe('?templates=kit seed (dev / test builds only)', () => {
  it('adds the kit #/demo templates once', () => {
    const listener = vi.fn()
    const off = subscribeSavedTemplates(listener)
    seedSavedTemplatesFromQuery('?templates=kit')
    seedSavedTemplatesFromQuery('?templates=kit')
    off()
    // The second seed finds all three and neither writes nor notifies.
    expect(listener).toHaveBeenCalledTimes(1)
    expect(reload().map((t) => t.name)).toEqual([
      'Travel opener',
      'Polaroid pair',
      'Quote + photo',
    ])
    expect(getSavedTemplates().map((t) => t.slots)).toEqual(
      KIT_TEMPLATES.map((t) => t.slots),
    )
  })

  it('the first read of the page seeds from its own URL', () => {
    window.history.replaceState(null, '', '/?templates=kit')
    try {
      expect(reload().map((t) => t.id)).toEqual(KIT_TEMPLATES.map((t) => t.id))
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('a production build ignores the query; a VITE_TEST_FIXTURES build honours it', () => {
    vi.stubEnv('DEV', false)
    try {
      vi.stubEnv('VITE_TEST_FIXTURES', '')
      seedSavedTemplatesFromQuery('?templates=kit')
      expect(reload()).toEqual([])
      vi.stubEnv('VITE_TEST_FIXTURES', '1')
      seedSavedTemplatesFromQuery('?templates=kit')
      expect(reload().map((t) => t.id)).toEqual(KIT_TEMPLATES.map((t) => t.id))
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

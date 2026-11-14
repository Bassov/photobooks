import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryLibraryStorage } from '../project/memory'
import {
  bindSiteSettingsLibrary,
  getSiteSettings,
  resetSiteSettingsForTests,
  setSiteSettings,
  siteSettingsSettled,
} from './siteSettingsStore'
import { SiteSettingsSection } from './SiteSettingsSection'

const ROW = 'flex min-h-13 items-center gap-4 px-4 py-2'

function show() {
  render(<SiteSettingsSection row={ROW} rule={() => <hr />} />)
}

const field = (id: string) =>
  screen.getByTestId<HTMLInputElement | HTMLTextAreaElement>(id)

function type(id: string, value: string) {
  fireEvent.change(field(id), { target: { value } })
}

afterEach(() => {
  cleanup()
  resetSiteSettingsForTests()
  vi.restoreAllMocks()
})

describe('SiteSettingsSection', () => {
  it('shows the site fallbacks as placeholders and an empty counter (S3)', () => {
    show()
    expect(field('site-title').placeholder).toBe('Photobooks')
    expect(field('site-author').placeholder).toBe('Your name')
    expect(field('site-intro').placeholder).toBe(
      'A line or two about your books',
    )
    expect(screen.getByTestId('site-intro-count').textContent).toBe('0 / 160')
    expect(field('site-title').maxLength).toBe(80)
    expect(field('site-author').maxLength).toBe(80)
    expect(field('site-intro').maxLength).toBe(160)
    expect(field('site-title').getAttribute('autocomplete')).toBe('off')
    expect(field('site-title').getAttribute('spellcheck')).toBe('false')
    expect(field('site-intro').getAttribute('spellcheck')).toBe('true')
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })

  it('commits on Enter and on blur, trimmed and collapsed (S2)', () => {
    show()
    type('site-author', '  Ann   Lee ')
    expect(getSiteSettings()).toEqual({})
    fireEvent.keyDown(field('site-author'), { key: 'Enter' })
    expect(getSiteSettings()).toEqual({ author: 'Ann Lee' })
    expect(field('site-author').value).toBe('Ann Lee')
    expect(field('site-intro').placeholder).toBe('Photobooks by Ann Lee.')

    type('site-title', 'Alps')
    fireEvent.blur(field('site-title'))
    expect(getSiteSettings()).toEqual({ author: 'Ann Lee', title: 'Alps' })

    type('site-title', '   ')
    fireEvent.blur(field('site-title'))
    expect(getSiteSettings()).toEqual({ author: 'Ann Lee' })
  })

  it('reverts on Esc to the stored value and keeps focus', () => {
    setSiteSettings({ author: 'Ann' })
    show()
    const author = field('site-author')
    author.focus()
    type('site-author', 'Bo')
    const esc = fireEvent.keyDown(author, { key: 'Escape' })
    expect(esc).toBe(false)
    expect(author.value).toBe('Ann')
    expect(document.activeElement).toBe(author)
    expect(getSiteSettings()).toEqual({ author: 'Ann' })
  })

  it('turns pasted newlines into spaces (S4)', () => {
    show()
    type('site-intro', 'Two lines\nof\r\nbooks\rhere')
    expect(field('site-intro').value).toBe('Two lines of books here')
    fireEvent.keyDown(field('site-intro'), { key: 'Enter' })
    expect(getSiteSettings()).toEqual({ intro: 'Two lines of books here' })
  })

  it('counts the intro and inks the counter from 150 characters', () => {
    show()
    const count = screen.getByTestId('site-intro-count')
    type('site-intro', 'a'.repeat(149))
    expect(count.textContent).toBe('149 / 160')
    expect(count.style.color).toBe('')
    type('site-intro', 'a'.repeat(150))
    expect(count.textContent).toBe('150 / 160')
    expect(count.style.color).toBe('#393738')
    expect(count.style.fontWeight).toBe('500')
  })

  it('writes library.json once per change and never when unchanged', async () => {
    const library = createMemoryLibraryStorage()
    await bindSiteSettingsLibrary(library)
    const write = vi.spyOn(library, 'updateLibrary')
    show()
    type('site-title', 'Alps')
    fireEvent.blur(field('site-title'))
    await act(siteSettingsSettled)
    expect(write).toHaveBeenCalledTimes(1)

    type('site-title', ' Alps ')
    fireEvent.blur(field('site-title'))
    fireEvent.keyDown(field('site-title'), { key: 'Enter' })
    await act(siteSettingsSettled)
    expect(write).toHaveBeenCalledTimes(1)
    const meta = await library.getLibrary()
    expect(meta.ok && meta.value.site).toEqual({ title: 'Alps' })
  })

  it('follows the store when the settings change elsewhere', () => {
    show()
    act(() => {
      setSiteSettings({ title: 'Fjords', intro: 'Hi.' })
    })
    expect(field('site-title').value).toBe('Fjords')
    expect(field('site-intro').value).toBe('Hi.')
    expect(screen.getByTestId('site-intro-count').textContent).toBe('3 / 160')
  })
})

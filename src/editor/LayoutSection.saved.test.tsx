import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { LayoutSection } from './LayoutSection'
import {
  addSavedTemplate,
  getSavedTemplates,
  resetSavedTemplatesForTests,
} from './savedTemplates'
import { templatePreviewOn } from './templatePreview'

/** One 300 × 300 mm page with two photo frames and a caption. */
function seed(frames = TWO_FRAMES) {
  resetBookStore({
    book: makeBook({ spreads: [makeSpread({ id: 's1', frames })] }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const TWO_FRAMES = [
  makeFrame({ id: 'f1', rect: { x: 0, y: 0, width: 150, height: 300 } }),
  makeFrame({ id: 'f2', rect: { x: 180, y: 30, width: 90, height: 120 } }),
  makeFrame({
    id: 't1',
    kind: 'text',
    rect: { x: 10, y: 270, width: 100, height: 20 },
  }),
]

const names = () =>
  screen.queryAllByTestId('layout-tile').map((tile) => tile.textContent)

afterEach(() => {
  cleanup()
  resetBookStore()
  window.localStorage.clear()
  resetSavedTemplatesForTests()
})

describe('LayoutSection: save as template (kit context-inspector.tsx:145-150)', () => {
  it('the + saves the spread photo frames, opens My templates and names it inline', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    expect(screen.getByTestId('tab-all').textContent).toBe('All 10')
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 0')
    fireEvent.click(screen.getByTestId('tpl-save'))
    const saved = getSavedTemplates()
    expect(saved).toHaveLength(1)
    expect(saved[0]?.name).toBe('My layout 1')
    expect(saved[0]?.slots).toEqual([
      { x: 0, y: 0, w: 50, h: 100 },
      { x: 60, y: 10, w: 30, h: 40 },
    ])
    expect(screen.getByTestId('tab-mine').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByTestId('tab-all').textContent).toBe('All 11')
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 1')
    const input = screen.getByTestId<HTMLInputElement>('tpl-rename-input')
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('My layout 1')
    fireEvent.change(input, { target: { value: 'Trip opener' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByTestId('tpl-rename-input')).toBeNull()
    expect(names()).toEqual(['Trip opener'])
    expect(getSavedTemplates()[0]?.name).toBe('Trip opener')
  })

  it('the bottom "Save as template" button saves too; Escape keeps the name', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('tpl-save-button'))
    const input = screen.getByTestId<HTMLInputElement>('tpl-rename-input')
    fireEvent.change(input, { target: { value: 'My layout 1zzz' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('tpl-rename-input')).toBeNull()
    expect(names()).toEqual(['My layout 1'])
  })

  it('blur commits the typed name', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('tpl-save'))
    const input = screen.getByTestId<HTMLInputElement>('tpl-rename-input')
    fireEvent.change(input, { target: { value: 'Blurred' } })
    fireEvent.blur(input)
    expect(names()).toEqual(['Blurred'])
  })

  it('a spread with no photo frames cannot be saved', () => {
    seed([makeFrame({ id: 't', kind: 'text' })])
    render(<LayoutSection spreadId="s1" />)
    expect(
      screen
        .getByTestId<HTMLButtonElement>('tpl-save')
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByTestId<HTMLButtonElement>('tpl-save-button')
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})

describe('LayoutSection: saved templates in the lists', () => {
  it('All = kit builtins then saved; My templates = saved only', () => {
    addSavedTemplate('Travel opener', [{ x: 0, y: 0, w: 62, h: 100 }])
    addSavedTemplate('Polaroid pair', [
      { x: 10, y: 14, w: 30, h: 60 },
      { x: 60, y: 24, w: 30, h: 60 },
    ])
    seed()
    render(<LayoutSection spreadId="s1" />)
    expect(screen.getByTestId('tab-all').textContent).toBe('All 12')
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 2')
    expect(names().slice(-3)).toEqual([
      'Landscape + 2 portraits',
      'Travel opener',
      'Polaroid pair',
    ])
    // Suggestions come from the builtins only (kit ALL_TEMPLATES).
    const suggested = within(screen.getByTestId('tpl-suggested'))
      .getAllByTestId('layout-suggested-tile')
      .map((tile) => tile.textContent)
    expect(suggested).not.toContain('Polaroid pair')
    fireEvent.click(screen.getByTestId('tab-mine'))
    expect(names()).toEqual(['Travel opener', 'Polaroid pair'])
    fireEvent.click(
      screen
        .getByTestId('tpl-chips')
        .querySelector<HTMLElement>('[data-chip="2"]') ?? document.body,
    )
    expect(names()).toEqual(['Polaroid pair'])
    fireEvent.change(screen.getByTestId('layout-search'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No layouts match.',
    )
  })

  it('a saved tile applies its slots, shows as selected and names the summary', () => {
    const saved = addSavedTemplate('Travel opener', [
      { x: 0, y: 0, w: 62, h: 100 },
    ])
    seed()
    render(<LayoutSection spreadId="s1" />)
    const tile = screen.getByRole('button', {
      name: 'Apply layout Travel opener',
    })
    fireEvent.mouseEnter(tile)
    expect(templatePreviewOn('s1')).toBe(saved.id)
    fireEvent.click(tile)
    expect(templatePreviewOn('s1')).toBe('')
    const spread = getBookStoreSnapshot().book.spreads[0]
    expect(spread?.templateId).toBe(saved.id)
    expect(spread?.frames.map((f) => f.rect)).toEqual([
      { x: 0, y: 0, width: 186, height: 300 },
    ])
    expect(
      screen
        .getByRole('button', { name: 'Apply layout Travel opener' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    // Collapsed header summary = the saved layout's name.
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }))
    expect(screen.getByTestId('layout-summary').textContent).toBe(
      'Travel opener',
    )
  })

  it('the tile menu renames, duplicates and deletes a saved template', () => {
    addSavedTemplate('Travel opener', [{ x: 0, y: 0, w: 62, h: 100 }])
    seed()
    render(<LayoutSection spreadId="s1" />)
    // Builtins have no options menu.
    expect(screen.getAllByTestId('tpl-menu')).toHaveLength(1)
    const menu = () =>
      screen.getByRole('button', { name: 'Travel opener options' })
    fireEvent.click(menu())
    fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }))
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'Travel opener',
      'Travel opener copy',
    ])
    fireEvent.click(menu())
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))
    const input = screen.getByTestId<HTMLInputElement>('tpl-rename-input')
    fireEvent.change(input, { target: { value: 'Opener' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(getSavedTemplates()[0]?.name).toBe('Opener')
    fireEvent.click(screen.getByRole('button', { name: 'Opener options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }))
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'Travel opener copy',
    ])
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 1')
  })
})

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
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
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 11])
    // While renaming, the field replaces the caption and the tile menu.
    expect(screen.queryByTestId('tpl-name')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'My layout 1 options' }),
    ).toBeNull()
    fireEvent.keyDown(input, { key: 'a' })
    expect(screen.getByTestId('tpl-rename-input')).toBe(input)
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

  it('Escape in the name field stays there (the inspector does not see it)', () => {
    seed()
    const keys: string[] = []
    render(
      <div
        onKeyDown={(event) => {
          keys.push(event.key)
        }}
      >
        <LayoutSection spreadId="s1" />
      </div>,
    )
    fireEvent.click(screen.getByTestId('tpl-save'))
    const input = screen.getByTestId('tpl-rename-input')
    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(keys).toEqual(['a'])
  })

  it('saving clears the photo chip so the new template shows', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    const chips = screen.getByTestId('tpl-chips')
    fireEvent.click(within(chips).getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByTestId('tpl-save'))
    expect(
      chips.querySelector('[aria-pressed="true"]')?.getAttribute('data-chip'),
    ).toBe('all')
    expect(screen.getAllByTestId('tpl-rename-input')).toHaveLength(1)
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
  it('All = builtins and saved by photo count; My templates = saved only', () => {
    // s1 is a single page: it lists the layouts saved on a single page.
    const travel = addSavedTemplate(
      'Travel opener',
      [{ x: 0, y: 0, w: 62, h: 100 }],
      1,
    )
    const polaroid = addSavedTemplate(
      'Polaroid pair',
      [
        { x: 10, y: 14, w: 30, h: 60 },
        { x: 60, y: 24, w: 30, h: 60 },
      ],
      1,
    )
    seed()
    render(<LayoutSection spreadId="s1" />)
    expect(screen.getByTestId('tab-all').textContent).toBe('All 12')
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 2')
    // Saved layouts follow the builtins of their photo count.
    expect(
      screen
        .getAllByTestId('layout-tile')
        .map((tile) => tile.getAttribute('data-template')),
    ).toEqual([
      'full-bleed',
      'one-per-page',
      'panorama',
      'framed-single',
      travel.id,
      'offset-pair',
      'two-portraits',
      polaroid.id,
      'hero-two',
      'three-across',
      'landscape-two-portraits',
      'hero-grid',
    ])
    // Only the user's templates carry a visible caption.
    expect(names().filter((name) => name !== '')).toEqual([
      'Travel opener',
      'Polaroid pair',
    ])
    fireEvent.click(screen.getByTestId('tab-mine'))
    expect(names()).toEqual(['Travel opener', 'Polaroid pair'])
    fireEvent.click(
      screen
        .getByTestId('tpl-chips')
        .querySelector<HTMLElement>('[data-chip="2"]') ?? document.body,
    )
    expect(names()).toEqual(['Polaroid pair'])
    fireEvent.click(
      screen
        .getByTestId('tpl-chips')
        .querySelector<HTMLElement>('[data-chip="3"]') ?? document.body,
    )
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No layouts match.',
    )
  })

  it('a saved tile applies its slots, shows as selected and names the header', () => {
    // Saved on a single page: it applies to the single-page spread s1.
    const saved = addSavedTemplate(
      'Travel opener',
      [{ x: 0, y: 0, w: 62, h: 100 }],
      1,
    )
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
    // Image frames take the slots; the text frame keeps its box (text-frames).
    expect(spread?.frames.map((f) => f.rect)).toEqual([
      { x: 0, y: 0, width: 186, height: 300 },
      { x: 10, y: 270, width: 100, height: 20 },
    ])
    expect(spread?.frames[1]?.kind).toBe('text')
    expect(
      screen
        .getByRole('button', { name: 'Apply layout Travel opener' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    // Header note = the saved layout's name.
    expect(screen.getByTestId('layout-note').textContent).toBe(
      '· Travel opener',
    )
  })

  it('the tile menu renames, duplicates and deletes a saved template, announcing each', () => {
    addSavedTemplate('Travel opener', [{ x: 0, y: 0, w: 62, h: 100 }], 1)
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
    expect(getEditorStatus()).toBe('Duplicated as “Travel opener copy”')
    fireEvent.click(menu())
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))
    const input = screen.getByTestId<HTMLInputElement>('tpl-rename-input')
    expect(input.maxLength).toBe(60)
    fireEvent.change(input, { target: { value: '  Opener ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(getSavedTemplates()[0]?.name).toBe('Opener')
    expect(getEditorStatus()).toBe('Renamed to “Opener”')
    fireEvent.click(screen.getByRole('button', { name: 'Opener options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }))
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'Travel opener copy',
    ])
    expect(getEditorStatus()).toBe('Deleted “Opener”')
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 1')
  })

  it('an unchanged or blank name keeps the template and announces nothing', () => {
    addSavedTemplate('Travel opener', [{ x: 0, y: 0, w: 62, h: 100 }], 1)
    seed()
    render(<LayoutSection spreadId="s1" />)
    setEditorStatus('')
    for (const value of [' Travel opener ', '   ']) {
      fireEvent.click(
        screen.getByRole('button', { name: 'Travel opener options' }),
      )
      fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))
      const input = screen.getByTestId('tpl-rename-input')
      fireEvent.change(input, { target: { value } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(screen.queryByTestId('tpl-rename-input')).toBeNull()
    }
    expect(getSavedTemplates()[0]?.name).toBe('Travel opener')
    expect(getEditorStatus()).toBe('')
  })
})

/** Spreads s1 (page 1), s2 (pages 2–3) and s3 (the last page), each with TWO_FRAMES. */
function seedThree() {
  resetBookStore({
    book: makeBook({
      spreads: ['s1', 's2', 's3'].map((id) =>
        makeSpread({ id, frames: TWO_FRAMES }),
      ),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('LayoutSection: a template belongs to its page shape (Designer spec user-templates UT1)', () => {
  it('a single-page template shows on page 1 and the last page, not on spread 2–3', () => {
    seedThree()
    const { unmount } = render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('tpl-save'))
    expect(getSavedTemplates().map((t) => t.pages)).toEqual([1])
    unmount()
    for (const [spreadId, count] of [
      ['s1', 1],
      ['s3', 1],
      ['s2', 0],
    ] as const) {
      const view = render(<LayoutSection spreadId={spreadId} />)
      expect(screen.getByTestId('tab-mine').textContent).toBe(
        `My templates ${String(count)}`,
      )
      view.unmount()
    }
  })

  it('a two-page template applied to spread 2–3 names nothing on a single page', () => {
    seedThree()
    const spread = addSavedTemplate('Trip', [{ x: 0, y: 0, w: 50, h: 100 }], 2)
    const view = render(<LayoutSection spreadId="s2" />)
    expect(screen.getByTestId('tab-all').textContent).toBe('All 10')
    fireEvent.click(screen.getByRole('button', { name: 'Apply layout Trip' }))
    expect(screen.getByTestId('layout-note').textContent).toBe('· Trip')
    view.unmount()
    // A stale id on a single page: no note, no pressed tile.
    resetBookStore({
      book: makeBook({
        spreads: [makeSpread({ id: 's1', templateId: spread.id })],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<LayoutSection spreadId="s1" />)
    expect(screen.queryByTestId('layout-note')).toBeNull()
    expect(
      document.querySelectorAll(
        '[data-testid="layout-tile"][aria-pressed="true"]',
      ),
    ).toHaveLength(0)
    fireEvent.click(screen.getByTestId('tab-mine'))
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No templates yet. Save a page you like.',
    )
  })
})

it('an empty My templates on a two-page spread asks for a spread', () => {
  seedThree()
  render(<LayoutSection spreadId="s2" />)
  fireEvent.click(screen.getByTestId('tab-mine'))
  expect(screen.getByTestId('tpl-empty').textContent).toBe(
    'No templates yet. Save a spread you like.',
  )
})

describe('LayoutSection: Save never duplicates (Designer spec user-templates UT2)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('a second Save adds nothing, opens My templates / Any and flashes the tile for 1200 ms', () => {
    vi.useFakeTimers()
    const scrolled: Element[] = []
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(function (this: Element) {
        scrolled.push(this)
      })
    seed()
    // Three photos: listed after the two-photo template that flashes.
    const other = addSavedTemplate(
      'Other',
      [
        { x: 0, y: 0, w: 30, h: 30 },
        { x: 40, y: 0, w: 30, h: 30 },
        { x: 0, y: 40, w: 30, h: 30 },
      ],
      1,
    )
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('tpl-save'))
    expect(getEditorStatus()).toBe('Saved “My layout 1” to My templates')
    // The name field is still open when Save is pressed again.
    fireEvent.click(screen.getByTestId('tab-all'))
    fireEvent.click(
      within(screen.getByTestId('tpl-chips')).getByRole('button', {
        name: '1',
      }),
    )
    fireEvent.click(screen.getByTestId('tpl-save-button'))
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'Other',
      'My layout 1',
    ])
    expect(getEditorStatus()).toBe('Already in My templates as “My layout 1”')
    expect(screen.getByTestId('tab-mine').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(
      screen
        .getByTestId('tpl-chips')
        .querySelector('[aria-pressed="true"]')
        ?.getAttribute('data-chip'),
    ).toBe('all')
    expect(screen.queryByTestId('tpl-rename-input')).toBeNull()
    const tile = screen.getByRole('button', {
      name: 'Apply layout My layout 1',
    })
    expect(tile.hasAttribute('data-flash')).toBe(true)
    expect(
      screen
        .getByRole('button', { name: `Apply layout ${other.name}` })
        .hasAttribute('data-flash'),
    ).toBe(false)
    expect(scrolled).toEqual([tile.parentElement])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    // A Save during the flash restarts its 1200 ms and scrolls again.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.click(screen.getByTestId('tpl-save'))
    expect(scrolled).toEqual([tile.parentElement, tile.parentElement])
    act(() => {
      vi.advanceTimersByTime(1199)
    })
    expect(tile.hasAttribute('data-flash')).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(tile.hasAttribute('data-flash')).toBe(false)
  })

  it('slots within 0.5 points are the same; further apart, or on the other page shape, a new template', () => {
    seed()
    addSavedTemplate(
      'Near',
      [
        { x: 0.5, y: 0, w: 50, h: 100 },
        { x: 60, y: 10, w: 30, h: 40.5 },
      ],
      1,
    )
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('tpl-save'))
    expect(getSavedTemplates()).toHaveLength(1)
    resetSavedTemplatesForTests()
    addSavedTemplate(
      'Far',
      [
        { x: 0, y: 0, w: 50, h: 100 },
        { x: 60, y: 10.6, w: 30, h: 40 },
      ],
      1,
    )
    addSavedTemplate(
      'Spread',
      [
        { x: 0, y: 0, w: 50, h: 100 },
        { x: 60, y: 10, w: 30, h: 40 },
      ],
      2,
    )
    fireEvent.click(screen.getByTestId('tpl-save'))
    expect(getSavedTemplates().map((t) => t.name)).toEqual([
      'Far',
      'Spread',
      'My layout 1',
    ])
  })
})

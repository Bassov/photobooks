import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeCustomPrintProfile } from '../core/testing/fixtures'
import { PrintPresetsSection } from './PrintPresetsSection'
import {
  getPrintProfiles,
  getPrintProfilesState,
  resetPrintProfilesForTests,
  savePrintProfile,
  setDefaultPrintProfileId,
} from './printProfilesStore'

const CUSTOM = makeCustomPrintProfile()

function renderSection() {
  render(<PrintPresetsSection row="row" rule={() => <hr />} />)
}

const dialog = () => screen.getByTestId('print-profile-dialog')
const input = (label: string) =>
  within(dialog()).getByLabelText<HTMLInputElement>(label)
const type = (label: string, value: string) => {
  fireEvent.change(input(label), { target: { value } })
}
const save = () => screen.getByTestId('pp-save')
const errors = () =>
  screen.queryAllByTestId('pp-error').map((node) => node.textContent)

afterEach(() => {
  cleanup()
  resetPrintProfilesForTests()
})

// Kit uikit/src/demo-parts/settings.tsx PrintPresets.
describe('Settings → Print presets', () => {
  it('lists Generic as the default print shop and an empty Custom list', () => {
    renderSection()
    const shop = screen.getByTestId('print-shop-generic')
    expect(within(shop).getByText('Generic')).toBeTruthy()
    expect(within(shop).getByText('Default')).toBeTruthy()
    expect(within(shop).getByTestId('print-summary-line').textContent).toBe(
      '5–50 cm · bleed 0–10 mm · safe 5 mm · 20–120 pages · photos ≥ 200 ppi',
    )
    expect(screen.getByTestId('print-custom-empty').textContent).toBe(
      'No custom profiles yet. Duplicate a print shop’s profile, or start a new one.',
    )
    const select = screen.getByTestId<HTMLSelectElement>('print-default')
    expect(select.value).toBe('generic')
    expect(select.querySelectorAll('optgroup')).toHaveLength(1)
  })

  it('changes the default for new books from the grouped select', () => {
    savePrintProfile(CUSTOM)
    renderSection()
    const select = screen.getByTestId<HTMLSelectElement>('print-default')
    expect(
      [...select.querySelectorAll('optgroup')].map((group) => group.label),
    ).toEqual(['Print shops', 'Custom'])
    fireEvent.change(select, { target: { value: CUSTOM.id } })
    expect(getPrintProfilesState().defaultId).toBe(CUSTOM.id)
    const row = screen.getByTestId(`print-custom-${CUSTOM.id}`)
    expect(within(row).getByText('Default')).toBeTruthy()
  })

  it('Duplicate adds the copy and opens the editor on it', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('print-duplicate-generic'))
    const [copy] = getPrintProfiles()
    expect(copy?.name).toBe('Generic (copy)')
    expect(screen.getByText('Edit print profile')).toBeTruthy()
    expect(screen.getByTestId('pp-sub').textContent).toBe(
      'Based on Generic. Books that use this profile follow your changes.',
    )
    expect(input('Name').value).toBe('Generic (copy)')
    expect(screen.getByTestId('pp-spine-hint').textContent).toBe(
      '20 pages = 12 mm · 120 pages = 32 mm',
    )
  })

  it('New profile is listed only after Save', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('print-new'))
    expect(screen.getByText('New print profile')).toBeTruthy()
    expect(screen.getByTestId('pp-sub').textContent).toBe('Based on Generic.')
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByTestId('print-profile-dialog')).toBeNull()
    expect(getPrintProfiles()).toEqual([])
    fireEvent.click(screen.getByTestId('print-new'))
    type('Name', 'My lab')
    fireEvent.click(save())
    expect(getPrintProfiles().map((p) => p.name)).toEqual(['My lab'])
    expect(screen.queryByTestId('print-profile-dialog')).toBeNull()
  })

  it('shows live errors, disables Save and saves with Enter once valid', () => {
    savePrintProfile(CUSTOM)
    renderSection()
    fireEvent.click(screen.getByTestId(`print-edit-${CUSTOM.id}`))
    type('Fewest pages', '')
    type('Minimum', '400')
    expect(errors()).toEqual([
      'Enter a number above 0.',
      'Minimum can’t be above Warn under.',
    ])
    expect(
      screen.getAllByTestId('pp-error')[0]?.getAttribute('style'),
    ).toContain('color: #a8403a')
    expect(input('Fewest pages').getAttribute('aria-invalid')).toBe('true')
    expect(save().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByTestId('pp-spine-hint')).toBeNull()
    fireEvent.keyDown(input('Minimum'), { key: 'Enter' })
    expect(screen.getByTestId('print-profile-dialog')).toBeTruthy()
    type('Fewest pages', '24')
    type('Minimum', '100')
    expect(errors()).toEqual([])
    expect(save().hasAttribute('disabled')).toBe(false)
    fireEvent.keyDown(input('Minimum'), { key: 'Enter' })
    expect(screen.queryByTestId('print-profile-dialog')).toBeNull()
    expect(getPrintProfiles()[0]?.dpi.min).toBe(100)
  })

  it('draws kit field boxes: width, unit, ring on error, aria-invalid', () => {
    savePrintProfile(CUSTOM)
    renderSection()
    fireEvent.click(screen.getByTestId(`print-edit-${CUSTOM.id}`))
    const box = (key: string) => screen.getByTestId(`pp-${key}`)
    expect(box('bleed').style.width).toBe('96px')
    expect(box('pStep').style.width).toBe('64px')
    expect(box('bleed').textContent).toBe('mm')
    expect(box('pMin').querySelector('span')).toBeNull()
    expect(box('dpiMin').textContent).toBe('ppi')
    expect(box('bleed').className).toContain('shadow-xs')
    expect(box('bleed').className).not.toContain('ring-[#a8403a]')
    expect(input('Bleed').getAttribute('aria-invalid')).toBeNull()
    expect(input('Name').getAttribute('aria-invalid')).toBeNull()
    expect(box('name').className).not.toContain('ring-[#a8403a]')
    type('Bleed', 'x')
    type('Name', '')
    expect(box('bleed').className).toContain('ring-[#a8403a]')
    expect(box('bleed').className).not.toContain('shadow-xs')
    expect(box('name').className).toContain('ring-[#a8403a]')
    expect(input('Name').getAttribute('aria-invalid')).toBe('true')
  })

  it('saves on Enter in a field only; Escape cancels', () => {
    savePrintProfile(CUSTOM)
    renderSection()
    fireEvent.click(screen.getByTestId(`print-edit-${CUSTOM.id}`))
    type('Name', 'Renamed')
    fireEvent.keyDown(input('Name'), { key: 'a' })
    fireEvent.keyDown(screen.getByText('Cancel'), { key: 'Enter' })
    expect(getPrintProfiles()[0]?.name).toBe(CUSTOM.name)
    expect(fireEvent.keyDown(input('Name'), { key: 'Enter' })).toBe(false)
    expect(getPrintProfiles()[0]?.name).toBe('Renamed')
    fireEvent.click(screen.getByTestId(`print-edit-${CUSTOM.id}`))
    type('Name', 'Dropped')
    fireEvent.keyDown(input('Name'), { key: 'Escape' })
    expect(screen.queryByTestId('print-profile-dialog')).toBeNull()
    expect(getPrintProfiles()[0]?.name).toBe('Renamed')
  })

  it('shows a table spine as a read-only range', () => {
    savePrintProfile({
      ...CUSTOM,
      basedOn: 'Shop',
      spine: {
        ...CUSTOM.spine,
        width: {
          kind: 'table',
          rows: [
            { maxPages: 40, widthMm: 10 },
            { maxPages: 80, widthMm: 14 },
          ],
        },
      },
    })
    renderSection()
    fireEvent.click(screen.getByTestId(`print-edit-${CUSTOM.id}`))
    expect(screen.getByTestId('pp-spine-table').textContent).toBe(
      'From the Shop table · 10–14 mm',
    )
    expect(screen.queryByLabelText('Spine base')).toBeNull()
    type('Most pages', '81')
    expect(screen.getByTestId('pp-spine-table').textContent).toBe(
      'From the Shop table · – mm',
    )
  })

  it('deletes from the More menu after the confirm, naming the default fallback', () => {
    savePrintProfile(CUSTOM)
    setDefaultPrintProfileId(CUSTOM.id)
    renderSection()
    fireEvent.click(screen.getByTestId(`print-more-${CUSTOM.id}`))
    const remove = screen.getByText('Delete…')
    expect(remove.closest('[style]')?.getAttribute('style')).toContain(
      'color: #a8403a',
    )
    fireEvent.click(remove)
    expect(screen.getByText(`Delete “${CUSTOM.name}”?`)).toBeTruthy()
    expect(
      screen.getByText(
        'Books that use it keep its values. New books will start with Generic.',
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(getPrintProfilesState()).toEqual({
      customs: [],
      defaultId: 'generic',
    })
    expect(screen.getByTestId('print-custom-empty')).toBeTruthy()
  })

  it('rules between customs only, one Default badge, copy names skip taken ones', () => {
    savePrintProfile({ ...CUSTOM, name: 'Generic (copy)' })
    savePrintProfile({ ...CUSTOM, id: 'custom-b', name: 'B' })
    renderSection()
    expect(document.querySelectorAll('hr')).toHaveLength(1)
    expect(screen.getAllByText('Default')).toHaveLength(1)
    expect(screen.getByTestId('print-default').style.width).toBe('240px')
    fireEvent.click(screen.getByTestId('print-duplicate-generic'))
    expect(getPrintProfiles().map((p) => p.name)).toEqual([
      'Generic (copy)',
      'B',
      'Generic (copy 2)',
    ])
  })

  it('deleting a non-default says nothing of Generic; Cancel keeps it', () => {
    savePrintProfile(CUSTOM)
    renderSection()
    fireEvent.click(screen.getByTestId(`print-more-${CUSTOM.id}`))
    fireEvent.click(screen.getByText('Delete…'))
    expect(screen.getByText('Books that use it keep its values.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(`Delete “${CUSTOM.name}”?`)).toBeNull()
    expect(getPrintProfiles()).toEqual([CUSTOM])
  })

  it('More → Duplicate copies a custom profile', () => {
    savePrintProfile(CUSTOM)
    renderSection()
    fireEvent.click(screen.getByTestId(`print-more-${CUSTOM.id}`))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(getPrintProfiles().map((p) => [p.name, p.basedOn])).toEqual([
      [CUSTOM.name, undefined],
      [`${CUSTOM.name} (copy)`, CUSTOM.name],
    ])
    expect(screen.getByTestId('pp-sub').textContent).toContain(
      `Based on ${CUSTOM.name}.`,
    )
  })
})

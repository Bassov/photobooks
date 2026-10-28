import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ICON_GLYPHS } from './icons/glyphs'
import { Icon, ICON_NAMES, ICON_SIZES } from './Icon'

describe('Icon', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders decorative icons with aria-hidden by default', () => {
    const { container } = render(<Icon name="undo" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('data-icon')).toBe('undo')
    expect(svg?.getAttribute('data-size')).toBe('16')
    expect(svg?.getAttribute('class')).toBe('pb-icon')
  })

  it('merges className onto the svg', () => {
    const { container } = render(<Icon name="undo" className="extra" />)
    expect(container.querySelector('svg')?.getAttribute('class')).toBe(
      'pb-icon extra',
    )
  })

  it('renders glyph child nodes from the named path set', () => {
    const { container } = render(<Icon name="check" />)
    const svg = container.querySelector('svg')
    const paths = svg?.querySelectorAll('path')
    expect(paths?.length).toBe(ICON_GLYPHS.check.length)
    expect(paths?.[0]?.getAttribute('d')).toBe('M20 6 9 17l-5-5')
  })

  it('exposes an accessible name when label is set', () => {
    render(<Icon name="settings" label="Settings" />)
    expect(screen.getByRole('img', { name: 'Settings' })).toBeTruthy()
  })

  it.each(ICON_SIZES)('applies size token %s', (size) => {
    const { container } = render(<Icon name="check" size={size} />)
    expect(container.querySelector('svg')?.getAttribute('data-size')).toBe(
      String(size),
    )
  })

  it('ships the named glyphs from the roadmap set', () => {
    expect(ICON_NAMES.length).toBe(49)
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining([
        'undo',
        'redo',
        'zoomIn',
        'zoomOut',
        'fit',
        'addSpread',
        'duplicate',
        'delete',
        'grid',
        'guides',
        'rulers',
        'text',
        'image',
        'lock',
        'eye',
        'warning',
        'info',
        'check',
        'present',
        'export',
        'settings',
        'chevronLeft',
        'chevronRight',
        'folder',
        'bookOpen',
        'moon',
        'sun',
        'appWindow',
        'shieldOff',
        'monitorSmartphone',
        'externalLink',
        'copy',
        'search',
        'moreHorizontal',
        'pencil',
        'chevronDown',
        'folderOpen',
        'folderSync',
        'hardDrive',
        'keyRound',
        'globe',
        'printer',
        'slidersHorizontal',
        'panelLeft',
        'panelRight',
        'panelBottom',
      ]),
    )
  })
})

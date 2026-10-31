import { describe, expect, it } from 'vitest'
import { TEMPLATE_IDS } from '../core'
import { LAYOUT_PICKER, TEMPLATE_NAMES, templateName } from './layoutCatalog'

describe('layoutCatalog', () => {
  it('offers the kit layouts in kit order, all valid template ids', () => {
    expect(LAYOUT_PICKER.map((id) => TEMPLATE_NAMES[id])).toEqual([
      'Full bleed',
      'One per page',
      'Hero + two',
      'Hero + grid',
      'Panorama',
      'Three across',
      'Framed single',
      'Offset pair',
      'Two portraits',
      'Landscape + 2 portraits',
    ])
    for (const id of LAYOUT_PICKER) {
      expect(TEMPLATE_IDS).toContain(id)
    }
    expect(LAYOUT_PICKER).not.toContain('2-up')
    expect(LAYOUT_PICKER).not.toContain('4-grid')
  })

  it('names every fixed template, including the stored-only ones', () => {
    expect(Object.keys(TEMPLATE_NAMES).sort()).toEqual([...TEMPLATE_IDS].sort())
    expect(templateName('2-up')).toBe('2-up')
    expect(templateName('4-grid')).toBe('4-grid')
  })

  it('names fixed ids, contact sheets, and nothing else', () => {
    expect(templateName('panorama')).toBe('Panorama')
    expect(templateName('contact-5x3')).toBe('Contact sheet 5×3')
    expect(templateName(undefined)).toBeNull()
    expect(templateName('custom-x')).toBeNull()
  })
})

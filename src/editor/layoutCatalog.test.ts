import { afterEach, describe, expect, it } from 'vitest'
import { TEMPLATE_IDS } from '../core'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  LAYOUT_PICKER,
  TEMPLATE_NAMES,
  layoutRects,
  templateName,
} from './layoutCatalog'
import { addSavedTemplate, resetSavedTemplatesForTests } from './savedTemplates'

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

describe('layoutRects', () => {
  afterEach(() => {
    window.localStorage.clear()
    resetSavedTemplatesForTests()
  })

  it('lays out a catalog id, a saved layout and nothing for an unknown id', () => {
    const spread = makeSpread({ id: 's1' })
    const book = makeBook({ spreads: [spread] })
    expect(layoutRects('full-bleed', book, 0, spread)?.length).toBe(1)
    const saved = addSavedTemplate('Mine', [{ x: 0, y: 0, w: 62, h: 100 }])
    expect(layoutRects(saved.id, book, 0, spread)).toEqual([
      { x: 0, y: 0, width: 186, height: 300 },
    ])
    expect(layoutRects('user-missing', book, 0, spread)).toBeNull()
  })
})

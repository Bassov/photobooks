import { describe, expect, it } from 'vitest'
import {
  filmstripEmptyStyle,
  filmstripEmptyTitleStyle,
  filmstripImportProgressStyle,
} from './filmstripChromeStyles'

describe('filmstripChromeStyles', () => {
  it('keeps empty filmstrip EmptyState full-width and borderless', () => {
    expect(filmstripEmptyStyle.width).toBe('100%')
    expect(filmstripEmptyStyle.maxWidth).toBe('100%')
    expect(filmstripEmptyStyle.border).toBe(0)
    expect(filmstripEmptyStyle.background).toBe('transparent')
    expect(filmstripEmptyTitleStyle.color).toBe('var(--muted-foreground)')
  })

  it('sizes the import progress bar for the status strip', () => {
    expect(filmstripImportProgressStyle.width).toBe('min(12rem, 40vw)')
    expect(filmstripImportProgressStyle.flex).toBe('0 1 auto')
  })
})

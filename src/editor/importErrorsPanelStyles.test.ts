import { describe, expect, it } from 'vitest'
import {
  importErrorsPanelDismissStyle,
  importErrorsPanelEmptyStyle,
  importErrorsPanelEntriesStyle,
  importErrorsPanelEntryStyle,
  importErrorsPanelGroupStyle,
  importErrorsPanelHeadStyle,
  importErrorsPanelListStyle,
  importErrorsPanelNameStyle,
  importErrorsPanelNotImportedStyle,
  importErrorsPanelSummaryStyle,
} from './importErrorsPanelStyles'
import {
  filmstripImportErrorsActionStyle,
  filmstripImportJumpHighlightStyle,
} from './filmstripChromeStyles'

describe('import-errors panel chrome styles', () => {
  it('exposes token-backed layout styles for panel and filmstrip triggers', () => {
    expect(importErrorsPanelHeadStyle.display).toBe('flex')
    expect(importErrorsPanelEmptyStyle.color).toBe('var(--muted-foreground)')
    expect(importErrorsPanelListStyle.listStyle).toBe('none')
    expect(importErrorsPanelGroupStyle.borderTop).toContain('--border')
    expect(importErrorsPanelSummaryStyle.fontWeight).toBe(600)
    expect(importErrorsPanelEntriesStyle.display).toBe('flex')
    expect(importErrorsPanelEntryStyle.minWidth).toBe(0)
    expect(importErrorsPanelNameStyle.textOverflow).toBe('ellipsis')
    expect(importErrorsPanelNotImportedStyle.color).toBe(
      'var(--muted-foreground)',
    )
    expect(importErrorsPanelDismissStyle.color).toBe('var(--destructive)')
    expect(filmstripImportErrorsActionStyle.color).toBe('var(--destructive)')
    expect(filmstripImportJumpHighlightStyle.outline).toContain('--ring')
  })
})

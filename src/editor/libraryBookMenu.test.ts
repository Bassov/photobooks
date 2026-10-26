import { describe, expect, it } from 'vitest'

import { libraryBookMenuEffect } from './libraryBookMenu'

describe('libraryBookMenuEffect', () => {
  it('maps open rename and duplicate keys', () => {
    expect(libraryBookMenuEffect('open', 'A')).toEqual({ type: 'open' })
    expect(libraryBookMenuEffect('rename', 'A')).toEqual({ type: 'rename' })
    expect(libraryBookMenuEffect('dup', 'A')).toEqual({ type: 'duplicate' })
  })

  it('maps remove only when a summary title is present', () => {
    expect(libraryBookMenuEffect('rm', 'Fog')).toEqual({
      type: 'remove',
      title: 'Fog',
    })
    expect(libraryBookMenuEffect('rm', undefined)).toEqual({ type: 'none' })
    expect(libraryBookMenuEffect('rm', '')).toEqual({
      type: 'remove',
      title: 'Untitled book',
    })
  })

  it('ignores unknown keys', () => {
    expect(libraryBookMenuEffect('nope', 'A')).toEqual({ type: 'none' })
  })
})

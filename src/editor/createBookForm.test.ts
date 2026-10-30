import { describe, expect, it } from 'vitest'
import { createBookFormDefaults } from './createBookForm'

describe('createBookForm', () => {
  it('defaults match kit A5 create form', () => {
    expect(createBookFormDefaults()).toEqual({
      title: '',
      presetId: 'A5',
      orientation: 'portrait',
      customWCm: 18,
      customHCm: 24,
    })
  })
})

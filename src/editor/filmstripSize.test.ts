import { describe, expect, it } from 'vitest'
import { FILMSTRIP_THUMB_HEIGHT } from './filmstripSize'

describe('FILMSTRIP_THUMB_HEIGHT', () => {
  it('is the kit sandbox thumb, below the 90 px name-strip threshold', () => {
    expect(FILMSTRIP_THUMB_HEIGHT).toBe(76)
  })
})

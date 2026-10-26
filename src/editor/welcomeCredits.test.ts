import { describe, expect, it } from 'vitest'

import {
  LIBRARY_EXAMPLE_SRC,
  LICENSE_URL,
  WELCOME_CREDITS,
  WELCOME_HERO_SRC,
} from './welcomeCredits'

describe('welcomeCredits', () => {
  it('exposes c18 hero, c18b example, and CC BY-SA deed', () => {
    expect(WELCOME_HERO_SRC).toBe('/photos/hi/c18.jpg')
    expect(LIBRARY_EXAMPLE_SRC).toBe('/photos/hi/c18b.jpg')
    expect(WELCOME_CREDITS.c18?.author).toBe('Dietmar Rabich')
    expect(WELCOME_CREDITS.c18b?.author).toBe('Dietmar Rabich')
    expect(WELCOME_CREDITS.c18?.license).toBe('CC BY-SA 4.0')
    expect(LICENSE_URL['CC BY-SA 4.0']).toMatch(/creativecommons\.org/)
  })
})

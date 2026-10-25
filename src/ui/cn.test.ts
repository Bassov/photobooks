import { describe, expect, it } from 'vitest'
import { cn, cva } from './cn'

describe('cn', () => {
  it('merges class tokens and resolves Tailwind conflicts', () => {
    expect(cn('px-2', false, undefined, 'py-1')).toBe('px-2 py-1')
    expect(cn('bg-chrome', 'bg-sel')).toBe('bg-sel')
    expect(cn('text-muted-foreground', 'font-medium')).toBe(
      'text-muted-foreground font-medium',
    )
  })
})

describe('cva', () => {
  it('builds kit-style variants for ports', () => {
    const chip = cva('rounded-md', {
      variants: {
        tone: {
          chrome: 'bg-chrome text-muted-foreground',
          sel: 'bg-sel text-foreground',
        },
      },
      defaultVariants: { tone: 'chrome' },
    })
    expect(chip()).toContain('bg-chrome')
    expect(chip({ tone: 'sel' })).toContain('bg-sel')
  })
})

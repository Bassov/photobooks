import { describe, expect, it } from 'vitest'
import { bookTitleFromUnknown } from './bookTitle'

describe('bookTitleFromUnknown', () => {
  it.each([
    ['null', null, ''],
    ['array', [], ''],
    ['string', 'x', ''],
    ['number', 1, ''],
    ['empty object', {}, ''],
    ['non-string title', { title: 1 }, ''],
    ['null title', { title: null }, ''],
    ['string title', { title: 'Summer' }, 'Summer'],
    ['empty string title', { title: '' }, ''],
  ] as const)('maps %s to %j', (_label, raw, expected) => {
    expect(bookTitleFromUnknown(raw)).toBe(expected)
  })
})

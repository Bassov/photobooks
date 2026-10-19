import { describe, expect, it } from 'vitest'
import {
  bookTitleFromUnknown,
  displayBookTitle,
  normalizeBookTitleInput,
} from './bookTitle'

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

describe('displayBookTitle', () => {
  it.each([
    ['undefined', undefined, 'Untitled book'],
    ['empty', '', 'Untitled book'],
    ['whitespace', '   ', 'Untitled book'],
    ['title', 'Summer', 'Summer'],
    ['padded title', '  Trip  ', 'Trip'],
  ] as const)('maps %s to %j', (_label, title, expected) => {
    expect(displayBookTitle(title)).toBe(expected)
  })
})

describe('normalizeBookTitleInput', () => {
  it.each([
    ['empty', '', ''],
    ['whitespace', '  \t ', ''],
    ['title', 'Summer', 'Summer'],
    ['padded', '  Trip  ', 'Trip'],
  ] as const)('maps %s to %j', (_label, raw, expected) => {
    expect(normalizeBookTitleInput(raw)).toBe(expected)
  })
})

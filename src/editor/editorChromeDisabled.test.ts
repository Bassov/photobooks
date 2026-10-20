import { describe, expect, it } from 'vitest'
import {
  isChromeBusy,
  isImportDisabled,
  isNewBookDisabled,
  isRenameDisabled,
  isSaveDisabled,
} from './editorChromeDisabled'

describe('editorChromeDisabled', () => {
  it('isChromeBusy is true when any busy flag is set', () => {
    expect(isChromeBusy(false, false, false)).toBe(false)
    expect(isChromeBusy(true, false, false)).toBe(true)
    expect(isChromeBusy(false, true, false)).toBe(true)
    expect(isChromeBusy(false, false, true)).toBe(true)
  })

  it('isRenameDisabled covers library, lock, and missing book', () => {
    expect(isRenameDisabled(false, true, false, 'b1')).toBe(false)
    expect(isRenameDisabled(true, true, false, 'b1')).toBe(true)
    expect(isRenameDisabled(false, false, false, 'b1')).toBe(true)
    expect(isRenameDisabled(false, true, true, 'b1')).toBe(true)
    expect(isRenameDisabled(false, true, false, null)).toBe(true)
  })

  it('isNewBookDisabled / isSaveDisabled / isImportDisabled', () => {
    expect(isNewBookDisabled(false, true)).toBe(false)
    expect(isNewBookDisabled(true, true)).toBe(true)
    expect(isNewBookDisabled(false, false)).toBe(true)

    expect(isSaveDisabled(false, true, false, false)).toBe(false)
    expect(isSaveDisabled(true, true, false, false)).toBe(true)
    expect(isSaveDisabled(false, false, false, false)).toBe(true)
    expect(isSaveDisabled(false, true, true, false)).toBe(true)
    expect(isSaveDisabled(false, true, false, true)).toBe(true)

    expect(isImportDisabled(false, false)).toBe(false)
    expect(isImportDisabled(true, false)).toBe(true)
    expect(isImportDisabled(false, true)).toBe(true)
  })
})

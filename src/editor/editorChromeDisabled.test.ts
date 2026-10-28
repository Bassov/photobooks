import { describe, expect, it } from 'vitest'
import { isChromeBusy, isImportDisabled } from './editorChromeDisabled'

describe('editorChromeDisabled', () => {
  it('isChromeBusy is true when any busy flag is set', () => {
    expect(isChromeBusy(false, false, false)).toBe(false)
    expect(isChromeBusy(true, false, false)).toBe(true)
    expect(isChromeBusy(false, true, false)).toBe(true)
    expect(isChromeBusy(false, false, true)).toBe(true)
  })

  it('isImportDisabled', () => {
    expect(isImportDisabled(false, false)).toBe(false)
    expect(isImportDisabled(true, false)).toBe(true)
    expect(isImportDisabled(false, true)).toBe(true)
  })
})

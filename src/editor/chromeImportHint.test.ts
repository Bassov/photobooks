import { afterEach, describe, expect, it } from 'vitest'
import { applyChromeImportHint } from './chromeImportHint'
import {
  getNoPhotosFoundHint,
  resetNoPhotosFoundHint,
  setNoPhotosFoundHint,
} from './emptyGalleryHint'

describe('applyChromeImportHint', () => {
  afterEach(() => {
    resetNoPhotosFoundHint()
  })

  it('sets the no-photos line only for a folder import with zero photos', () => {
    applyChromeImportHint('folder', 0, 2)
    expect(getNoPhotosFoundHint()).toBe(true)

    resetNoPhotosFoundHint()
    applyChromeImportHint('photos', 0, 2)
    expect(getNoPhotosFoundHint()).toBe(false)

    applyChromeImportHint('folder', 0, 0)
    expect(getNoPhotosFoundHint()).toBe(false)
  })

  it('clears the no-photos line when any photo is imported', () => {
    setNoPhotosFoundHint(true)
    applyChromeImportHint('folder', 1, 1)
    expect(getNoPhotosFoundHint()).toBe(false)

    setNoPhotosFoundHint(true)
    applyChromeImportHint('photos', 3, 3)
    expect(getNoPhotosFoundHint()).toBe(false)
  })

  it('leaves the hint unchanged for a cancelled empty picker list', () => {
    setNoPhotosFoundHint(true)
    applyChromeImportHint('folder', 0, 0)
    expect(getNoPhotosFoundHint()).toBe(true)
  })
})

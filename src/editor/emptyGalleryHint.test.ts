import { afterEach, describe, expect, it } from 'vitest'
import {
  getNoPhotosFoundHint,
  resetNoPhotosFoundHint,
  setNoPhotosFoundHint,
  subscribeNoPhotosFoundHint,
} from './emptyGalleryHint'

describe('emptyGalleryHint', () => {
  afterEach(() => {
    resetNoPhotosFoundHint()
  })

  it('notifies subscribers when the zero-photo folder hint flips', () => {
    const seen: boolean[] = []
    const unsubscribe = subscribeNoPhotosFoundHint(() => {
      seen.push(getNoPhotosFoundHint())
    })
    setNoPhotosFoundHint(true)
    setNoPhotosFoundHint(true)
    setNoPhotosFoundHint(false)
    unsubscribe()
    expect(seen).toEqual([true, false])
  })

  it('reset clears the hint to false', () => {
    setNoPhotosFoundHint(true)
    resetNoPhotosFoundHint()
    expect(getNoPhotosFoundHint()).toBe(false)
  })

  it('unsubscribe stops further notifications', () => {
    let count = 0
    const unsubscribe = subscribeNoPhotosFoundHint(() => {
      count += 1
    })
    setNoPhotosFoundHint(true)
    unsubscribe()
    setNoPhotosFoundHint(false)
    expect(count).toBe(1)
    expect(getNoPhotosFoundHint()).toBe(false)
  })
})

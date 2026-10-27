import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { dispatchBookOp, resetBookStore } from './bookStore'
import {
  enterCropMode,
  exitCropMode,
  getCropTarget,
  getCropTargetKey,
  subscribeCropMode,
} from './cropMode'

function load(place = true): void {
  resetBookStore({
    book: makeBookWithAsset('a', { place }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('cropMode', () => {
  afterEach(() => {
    exitCropMode()
    resetBookStore()
  })

  it('enters on a filled frame and reports a key', () => {
    load()
    enterCropMode('spread-1', 'frame-1')
    expect(getCropTarget()).toMatchObject({
      spreadId: 'spread-1',
      frameId: 'frame-1',
    })
    expect(getCropTargetKey()).toBe('spread-1/frame-1')
  })

  it('ignores empty and unknown frames', () => {
    load(false)
    enterCropMode('spread-1', 'frame-1')
    enterCropMode('nope', 'nope')
    expect(getCropTarget()).toBeNull()
    expect(getCropTargetKey()).toBe('')
  })

  it('notifies once per change and exits on demand', () => {
    load()
    const listener = vi.fn()
    const stop = subscribeCropMode(listener)
    enterCropMode('spread-1', 'frame-1')
    enterCropMode('spread-1', 'frame-1')
    exitCropMode()
    exitCropMode()
    stop()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('leaves when the frame is emptied', () => {
    load()
    enterCropMode('spread-1', 'frame-1')
    dispatchBookOp({
      type: 'unplace',
      spreadId: 'spread-1',
      frameId: 'frame-1',
    })
    expect(getCropTarget()).toBeNull()
  })

  it('stays while crop edits land', () => {
    load()
    enterCropMode('spread-1', 'frame-1')
    dispatchBookOp({
      type: 'setCrop',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      crop: { zoom: 2, center: { x: 0.5, y: 0.5 } },
    })
    expect(getCropTarget()).not.toBeNull()
  })
})

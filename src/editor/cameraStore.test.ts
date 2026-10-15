import { describe, expect, it } from 'vitest'
import {
  commitZoom,
  getCommittedCamera,
  getCommittedZoom,
  getLiveZoom,
  resetCameraStore,
  setLiveZoom,
  subscribeCommitted,
  subscribeLive,
} from './cameraStore'

describe('cameraStore', () => {
  it('updates live zoom without notifying committed subscribers', () => {
    resetCameraStore()
    let committed = 0
    let live = 0
    const stopCommitted = subscribeCommitted(() => {
      committed += 1
    })
    const stopLive = subscribeLive(() => {
      live += 1
    })

    setLiveZoom(2)

    expect(getLiveZoom()).toBe(2)
    expect(getCommittedZoom()).toBe(1)
    expect(live).toBe(1)
    expect(committed).toBe(0)
    stopCommitted()
    stopLive()
    resetCameraStore()
  })

  it('notifies live and committed subscribers when a key zoom commits', () => {
    resetCameraStore()
    let committed = 0
    let live = 0
    const stopCommitted = subscribeCommitted(() => {
      committed += 1
    })
    const stopLive = subscribeLive(() => {
      live += 1
    })

    commitZoom(1.5, 4, 9)

    expect(getLiveZoom()).toBe(1.5)
    expect(getCommittedZoom()).toBe(1.5)
    expect(getCommittedCamera()).toEqual({
      zoom: 1.5,
      scrollLeft: 4,
      scrollTop: 9,
      epoch: 1,
    })
    expect(live).toBe(1)
    expect(committed).toBe(1)
    stopCommitted()
    stopLive()
    resetCameraStore()
  })

  it('ignores a non-finite zoom', () => {
    resetCameraStore()
    setLiveZoom(Number.NaN)
    commitZoom(Number.NaN, 4, 9)
    expect(getLiveZoom()).toBe(1)
    expect(getCommittedZoom()).toBe(1)
    expect(getCommittedCamera().scrollTop).toBe(0)
  })

  it('keeps a non-finite scroll at zero and ignores an unchanged commit', () => {
    resetCameraStore()
    let committed = 0
    const stop = subscribeCommitted(() => {
      committed += 1
    })

    commitZoom(2, Number.NaN, Number.POSITIVE_INFINITY)
    expect(getCommittedCamera()).toMatchObject({
      zoom: 2,
      scrollLeft: 0,
      scrollTop: 0,
      epoch: 1,
    })

    commitZoom(2, 0, 0)
    expect(committed).toBe(1)
    expect(getCommittedCamera().epoch).toBe(1)

    resetCameraStore()
    expect(getCommittedCamera()).toEqual({
      zoom: 1,
      scrollLeft: 0,
      scrollTop: 0,
      epoch: 0,
    })
    stop()
  })
})

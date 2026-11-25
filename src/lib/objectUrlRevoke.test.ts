import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFERRED_REVOKE_RECHECK_MS,
  getDeferredRevokeCountForTests,
  holdObjectUrl,
  revokeObjectUrlWhenUnused,
} from './objectUrlRevoke'

function mount(attr: 'src' | 'srcset' | 'style', value: string): HTMLElement {
  const element = document.createElement(attr === 'style' ? 'div' : 'img')
  element.setAttribute(attr, value)
  document.body.append(element)
  return element
}

function spyRevoke() {
  return vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
}

describe('revokeObjectUrlWhenUnused', () => {
  let revoke: ReturnType<typeof spyRevoke>

  beforeEach(() => {
    vi.useFakeTimers()
    revoke = spyRevoke()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
    // Drain held URLs so the next test starts with none pending.
    await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('revokes at once when nothing references the URL', () => {
    mount('src', 'blob:other')
    revokeObjectUrlWhenUnused('blob:free')
    expect(revoke.mock.calls).toEqual([['blob:free']])
    expect(getDeferredRevokeCountForTests()).toBe(0)
  })

  it.each([
    ['src', 'blob:held'],
    ['srcset', 'blob:x 320w, blob:held 640w'],
    ['style', 'background-image: url("blob:held")'],
  ] as const)(
    'holds a URL an element %s references until it is dropped',
    async (attr, value) => {
      const element = mount(attr, value)
      revokeObjectUrlWhenUnused('blob:held')
      expect(revoke).not.toHaveBeenCalled()
      expect(getDeferredRevokeCountForTests()).toBe(1)

      await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS * 3)
      expect(revoke).not.toHaveBeenCalled()

      element.remove()
      await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS - 1)
      expect(revoke).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(revoke.mock.calls).toEqual([['blob:held']])
      expect(getDeferredRevokeCountForTests()).toBe(0)
    },
  )

  it('re-reads the DOM in a later task', async () => {
    const element = mount('src', 'blob:a')
    revokeObjectUrlWhenUnused('blob:a')
    element.remove()
    await Promise.resolve()
    revokeObjectUrlWhenUnused('blob:b')
    mount('src', 'blob:c')
    await Promise.resolve()
    revokeObjectUrlWhenUnused('blob:c')
    expect(revoke.mock.calls).toEqual([['blob:b']])
    expect(getDeferredRevokeCountForTests()).toBe(2)
  })

  it('holds a URL a detached loader reads until every hold is released', async () => {
    const first = holdObjectUrl('blob:decode')
    const second = holdObjectUrl('blob:decode')
    const other = holdObjectUrl('blob:other')
    revokeObjectUrlWhenUnused('blob:decode')
    expect(revoke).not.toHaveBeenCalled()
    revokeObjectUrlWhenUnused('blob:free')
    expect(revoke.mock.calls).toEqual([['blob:free']])
    revoke.mockClear()

    first()
    first()
    await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS)
    expect(revoke).not.toHaveBeenCalled()

    second()
    await vi.advanceTimersByTimeAsync(DEFERRED_REVOKE_RECHECK_MS)
    expect(revoke.mock.calls).toEqual([['blob:decode']])
    other()
    revokeObjectUrlWhenUnused('blob:other')
    expect(revoke.mock.calls).toEqual([['blob:decode'], ['blob:other']])
  })

  it('revokes at once without a document (workers)', () => {
    mount('src', 'blob:held')
    vi.stubGlobal('document', undefined)
    revokeObjectUrlWhenUnused('blob:held')
    expect(revoke.mock.calls).toEqual([['blob:held']])
  })
})

import { describe, expect, it } from 'vitest'

import {
  createFakeBrowserDirectory,
  createFakeDirectoryPicker,
} from './browserDirectory.test-helpers'

describe('createFakeBrowserDirectory permissions', () => {
  it('defaults to granted for query and request', async () => {
    const root = createFakeBrowserDirectory()

    await expect(root.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
    await expect(root.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
  })

  it('uses sticky setPermission when queues are empty', async () => {
    const root = createFakeBrowserDirectory()
    root.setPermission('denied')

    await expect(root.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'denied',
    )
    await expect(root.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'denied',
    )
  })

  it('consumes queued query and request results per call', async () => {
    const root = createFakeBrowserDirectory()
    root.enqueueQueryResults('prompt', 'denied')
    root.enqueueRequestResults('denied', 'granted')

    await expect(root.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'prompt',
    )
    await expect(root.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'denied',
    )
    await expect(root.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'denied',
    )
    await expect(root.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
  })

  it('updates sticky permission when requestPermission returns granted', async () => {
    const root = createFakeBrowserDirectory({ initialPermission: 'denied' })
    root.enqueueRequestResults('granted')

    await expect(root.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
    await expect(root.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
  })

  it('honours read and readwrite mode descriptors the same way', async () => {
    const root = createFakeBrowserDirectory({ initialPermission: 'granted' })

    await expect(root.queryPermission({ mode: 'read' })).resolves.toBe(
      'granted',
    )
    await expect(root.requestPermission({ mode: 'read' })).resolves.toBe(
      'granted',
    )
    await expect(root.queryPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
    await expect(root.requestPermission({ mode: 'readwrite' })).resolves.toBe(
      'granted',
    )
  })
})

describe('createFakeDirectoryPicker', () => {
  it('returns scripted handles in order', async () => {
    const first = createFakeBrowserDirectory({ name: 'a' })
    const second = createFakeBrowserDirectory({ name: 'b' })
    const pick = createFakeDirectoryPicker({ outcomes: [first, second] })

    await expect(pick()).resolves.toBe(first)
    await expect(pick()).resolves.toBe(second)
  })

  it('rejects AbortError for abort outcomes', async () => {
    const pick = createFakeDirectoryPicker({ outcomes: ['abort'] })

    await expect(pick()).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

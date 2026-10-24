import { describe, expect, it } from 'vitest'

import type { SessionDirectoryHandle, SessionState } from './types'
import { DEFAULT_LIBRARY_ID } from './types'

export interface SessionStateContractHarness {
  session: SessionState
  setPermissionRequired: (required: boolean) => void
  createHandle: () => SessionDirectoryHandle
}

export function runSessionStateContract(
  createHarness: () => SessionStateContractHarness,
): void {
  describe('SessionState contract', () => {
    it('recalls not-found when no handle was remembered', async () => {
      const { session } = createHarness()

      const recalled = await session.recallLibraryHandle(DEFAULT_LIBRARY_ID)

      expect(recalled).toEqual({ ok: false, code: 'not-found' })
    })

    it('round-trips remember then recall for the same handle', async () => {
      const { session, createHandle } = createHarness()
      const handle = createHandle()

      const remembered = await session.rememberLibraryHandle(
        DEFAULT_LIBRARY_ID,
        handle,
      )
      const recalled = await session.recallLibraryHandle(DEFAULT_LIBRARY_ID)

      expect(remembered).toEqual({ ok: true, value: undefined })
      expect(recalled).toEqual({ ok: true, value: handle })
    })

    it('clears a remembered handle so recall is not-found', async () => {
      const { session, createHandle } = createHarness()
      await session.rememberLibraryHandle(DEFAULT_LIBRARY_ID, createHandle())

      const cleared = await session.clearLibraryHandle(DEFAULT_LIBRARY_ID)
      const recalled = await session.recallLibraryHandle(DEFAULT_LIBRARY_ID)

      expect(cleared).toEqual({ ok: true, value: undefined })
      expect(recalled).toEqual({ ok: false, code: 'not-found' })
    })

    it('returns not-found when clearing a missing library id', async () => {
      const { session } = createHarness()

      const cleared = await session.clearLibraryHandle('missing')

      expect(cleared).toEqual({ ok: false, code: 'not-found' })
    })

    it('replaces the single library handle on change', async () => {
      const { session, createHandle } = createHarness()
      const first = createHandle()
      const second = createHandle()
      await session.rememberLibraryHandle(DEFAULT_LIBRARY_ID, first, 'One')
      await session.rememberLibraryHandle(DEFAULT_LIBRARY_ID, second, 'Two')

      await expect(
        session.recallLibraryHandle(DEFAULT_LIBRARY_ID),
      ).resolves.toEqual({ ok: true, value: second })
      await expect(session.getLibraryLabel(DEFAULT_LIBRARY_ID)).resolves.toBe(
        'Two',
      )
    })

    it('allows a second acquire after release', async () => {
      const { session } = createHarness()

      const first = await session.acquireBookLock('book-1')
      expect(first.ok).toBe(true)
      if (!first.ok) {
        return
      }
      await first.value.release()

      const second = await session.acquireBookLock('book-1')
      expect(second.ok).toBe(true)
      if (second.ok) {
        await second.value.release()
      }
    })

    it('returns locked-elsewhere while another holder keeps the lock', async () => {
      const { session } = createHarness()

      const first = await session.acquireBookLock('book-1')
      expect(first.ok).toBe(true)
      if (!first.ok) {
        return
      }

      const second = await session.acquireBookLock('book-1')
      expect(second).toEqual({ ok: false, code: 'locked-elsewhere' })

      await first.value.release()
    })

    it('returns permission-required on recall when permission is denied', async () => {
      const { session, setPermissionRequired, createHandle } = createHarness()
      await session.rememberLibraryHandle(DEFAULT_LIBRARY_ID, createHandle())
      setPermissionRequired(true)

      const recalled = await session.recallLibraryHandle(DEFAULT_LIBRARY_ID)

      expect(recalled).toEqual({ ok: false, code: 'permission-required' })
    })

    it('rejects reserved keys on remember and clear', async () => {
      const { session, createHandle } = createHarness()
      const handle = createHandle()

      await expect(
        session.rememberLibraryHandle('__recents', handle),
      ).resolves.toEqual({ ok: false, code: 'not-found' })
      await expect(session.clearLibraryHandle('__active')).resolves.toEqual({
        ok: false,
        code: 'not-found',
      })
    })

    it('peeks a handle without requiring permission', async () => {
      const { session, setPermissionRequired, createHandle } = createHarness()
      const handle = createHandle()
      await session.rememberLibraryHandle(DEFAULT_LIBRARY_ID, handle)
      setPermissionRequired(true)

      await expect(
        session.peekLibraryHandle(DEFAULT_LIBRARY_ID),
      ).resolves.toEqual({
        ok: true,
        value: handle,
      })
      await expect(
        session.recallLibraryHandle(DEFAULT_LIBRARY_ID),
      ).resolves.toEqual({
        ok: false,
        code: 'permission-required',
      })
    })

    it('peek is not-found when missing', async () => {
      const { session } = createHarness()

      await expect(session.peekLibraryHandle('missing')).resolves.toEqual({
        ok: false,
        code: 'not-found',
      })
    })

    it('exposes a library folder label', async () => {
      const { session, createHandle } = createHarness()
      await session.rememberLibraryHandle(
        DEFAULT_LIBRARY_ID,
        createHandle(),
        'Trip',
      )

      await expect(session.getLibraryLabel(DEFAULT_LIBRARY_ID)).resolves.toBe(
        'Trip',
      )
    })

    it('persists and recalls active library and book ids', async () => {
      const { session } = createHarness()

      await expect(
        session.setActiveIds({
          libraryId: DEFAULT_LIBRARY_ID,
          bookId: 'book-1',
        }),
      ).resolves.toEqual({ ok: true, value: undefined })
      await expect(session.getActiveIds()).resolves.toEqual({
        libraryId: DEFAULT_LIBRARY_ID,
        bookId: 'book-1',
      })

      await expect(
        session.setActiveIds({
          libraryId: DEFAULT_LIBRARY_ID,
          bookId: null,
        }),
      ).resolves.toEqual({ ok: true, value: undefined })
      await expect(session.getActiveIds()).resolves.toEqual({
        libraryId: DEFAULT_LIBRARY_ID,
        bookId: null,
      })
    })
  })
}

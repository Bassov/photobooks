import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAutosaveController,
  type AutosaveController,
} from './autosaveController'
import type { ProjectSessionTimers } from './browserProjectSessionPlatform'

function createCaptureTimers(): {
  timers: ProjectSessionTimers
  armed: { id: number; callback: () => void; ms: number }[]
  cleared: number[]
  flush: (id?: number) => void
} {
  const armed: { id: number; callback: () => void; ms: number }[] = []
  const cleared: number[] = []
  let nextId = 1
  const timers: ProjectSessionTimers = {
    setTimeout: ((callback: () => void, ms?: number) => {
      const id = nextId
      nextId += 1
      armed.push({ id, callback, ms: ms ?? 0 })
      return id as unknown as ReturnType<typeof globalThis.setTimeout>
    }) as typeof globalThis.setTimeout,
    clearTimeout: ((id: ReturnType<typeof globalThis.setTimeout>) => {
      cleared.push(id as unknown as number)
    }) as typeof globalThis.clearTimeout,
  }
  return {
    timers,
    armed,
    cleared,
    flush(id?: number): void {
      const target =
        id === undefined ? armed.at(-1) : armed.find((entry) => entry.id === id)
      target?.callback()
    },
  }
}

describe('createAutosaveController', () => {
  let gestureActive = false
  let dirty = true
  let hashPromise: Promise<void> = Promise.resolve()
  let awaitPendingHashes: () => Promise<void>
  let controller: AutosaveController
  let capture: ReturnType<typeof createCaptureTimers>

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(
    options: {
      debounceMs?: number
      awaitHashes?: () => Promise<void>
    } = {},
  ): void {
    gestureActive = false
    dirty = true
    capture = createCaptureTimers()
    hashPromise = Promise.resolve()
    awaitPendingHashes =
      options.awaitHashes ??
      (() => {
        return hashPromise
      })
    controller = createAutosaveController({
      timers: capture.timers,
      debounceMs: options.debounceMs ?? 1000,
      isGestureActive: () => gestureActive,
      awaitPendingHashes: () => awaitPendingHashes(),
    })
  }

  beforeEach(() => {
    setup()
  })

  it('arms pending and fires onFire after debounce when idle and dirty', () => {
    const onFire = vi.fn()

    controller.arm(true, () => dirty, onFire)

    expect(controller.getSavePhase()).toBe('pending')
    expect(capture.armed).toHaveLength(1)
    expect(capture.armed[0]?.ms).toBe(1000)

    capture.flush()
    expect(onFire).toHaveBeenCalledOnce()
  })

  it('does not arm when canArm is false or phase is saving/error', () => {
    const onFire = vi.fn()

    expect(controller.arm(false, () => dirty, onFire)).toBe(false)
    expect(controller.getSavePhase()).toBe('idle')
    expect(capture.armed).toHaveLength(0)

    expect(controller.beginSaving()).toBe(true)
    expect(controller.arm(true, () => dirty, onFire)).toBe(false)
    expect(capture.armed).toHaveLength(0)

    controller.failSaving()
    expect(controller.arm(true, () => dirty, onFire)).toBe(false)
    expect(controller.getSavePhase()).toBe('error')
    expect(capture.armed).toHaveLength(0)
  })

  it('cancel clears the timer without leaving pending', () => {
    controller.arm(true, () => dirty, vi.fn())
    expect(capture.armed).toHaveLength(1)
    const id = capture.armed[0]?.id
    expect(id).toBeTypeOf('number')

    controller.cancel()
    expect(capture.cleared).toContain(id)
    expect(controller.getSavePhase()).toBe('pending')
  })

  it('reset clears an armed timer and returns to idle', () => {
    controller.arm(true, () => dirty, vi.fn())
    const id = capture.armed[0]?.id
    expect(id).toBeTypeOf('number')

    controller.reset()
    expect(capture.cleared).toContain(id)
    expect(controller.getSavePhase()).toBe('idle')
  })

  it('does not fire while a gesture is active, then re-arms on gesture idle', () => {
    const onFire = vi.fn()
    controller.arm(true, () => dirty, onFire)

    gestureActive = true
    capture.flush()
    expect(onFire).not.toHaveBeenCalled()
    expect(controller.getSavePhase()).toBe('pending')

    gestureActive = false
    controller.onGestureIdle(() => dirty, onFire)
    expect(capture.armed.length).toBeGreaterThanOrEqual(2)

    capture.flush()
    expect(onFire).toHaveBeenCalledOnce()
  })

  it('does not fire when dirty clears before debounce elapses', () => {
    const onFire = vi.fn()
    controller.arm(true, () => dirty, onFire)
    dirty = false
    capture.flush()
    expect(onFire).not.toHaveBeenCalled()
  })

  it('does not fire when phase leaves pending before debounce elapses', () => {
    const onFire = vi.fn()
    controller.arm(true, () => dirty, onFire)
    const id = capture.armed[0]?.id
    controller.settleAfterPersist(false)
    expect(controller.getSavePhase()).toBe('idle')
    capture.flush(id)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('onGestureIdle is a no-op unless pending and dirty', () => {
    const onFire = vi.fn()
    dirty = true
    expect(controller.onGestureIdle(() => dirty, onFire)).toBe(false)
    expect(controller.getSavePhase()).toBe('idle')
    expect(capture.armed).toHaveLength(0)

    dirty = false
    controller.arm(true, () => true, onFire)
    expect(controller.onGestureIdle(() => dirty, onFire)).toBe(false)
    expect(capture.armed).toHaveLength(1)
  })

  it('beginSaving is idempotent, cancels timers, and completeSavingIfSaving only while saving', () => {
    controller.arm(true, () => dirty, vi.fn())
    const id = capture.armed[0]?.id
    expect(controller.beginSaving()).toBe(true)
    expect(controller.getSavePhase()).toBe('saving')
    expect(capture.cleared).toContain(id)
    expect(controller.beginSaving()).toBe(false)

    controller.completeSavingIfSaving(true)
    expect(controller.getSavePhase()).toBe('pending')
    controller.completeSavingIfSaving(false)
    expect(controller.getSavePhase()).toBe('pending')

    expect(controller.beginSaving()).toBe(true)
    controller.completeSavingIfSaving(false)
    expect(controller.getSavePhase()).toBe('idle')
  })

  it('ensureSaving forces saving and cancels an armed timer', () => {
    controller.ensureSaving()
    expect(controller.getSavePhase()).toBe('saving')

    controller.settleAfterPersist(true)
    expect(controller.arm(true, () => dirty, vi.fn())).toBe(true)
    const id = capture.armed[0]?.id
    controller.ensureSaving()
    expect(controller.getSavePhase()).toBe('saving')
    expect(capture.cleared).toContain(id)
    expect(controller.beginSaving()).toBe(false)
  })

  it('markPendingFromError only transitions from error', () => {
    controller.markPendingFromError()
    expect(controller.getSavePhase()).toBe('idle')

    expect(controller.beginSaving()).toBe(true)
    controller.failSaving()
    expect(controller.getSavePhase()).toBe('error')
    controller.markPendingFromError()
    expect(controller.getSavePhase()).toBe('pending')
  })

  it('waitForPendingHashes resolves the injected waiter before callers continue', async () => {
    let hashesDone = false
    let resolveHash!: () => void
    hashPromise = new Promise<void>((resolve) => {
      resolveHash = resolve
    })
    setup({
      awaitHashes: async () => {
        await hashPromise
        hashesDone = true
      },
    })

    let continued = false
    const running = controller.waitForPendingHashes().then(() => {
      expect(hashesDone).toBe(true)
      continued = true
    })
    expect(continued).toBe(false)
    expect(hashesDone).toBe(false)

    resolveHash()
    await running
    expect(continued).toBe(true)
  })

  it('settleAfterPersist sets phase unconditionally', () => {
    controller.failSaving()
    expect(controller.getSavePhase()).toBe('error')
    controller.settleAfterPersist(false)
    expect(controller.getSavePhase()).toBe('idle')
    controller.settleAfterPersist(true)
    expect(controller.getSavePhase()).toBe('pending')
  })

  it('setDebounceMs and setTimers apply to the next arm', () => {
    setup({ debounceMs: 500 })
    const next = createCaptureTimers()
    controller.setTimers(next.timers)
    controller.setDebounceMs(250)
    controller.arm(true, () => dirty, vi.fn())
    expect(next.armed[0]?.ms).toBe(250)
    expect(capture.armed).toHaveLength(0)
  })
})

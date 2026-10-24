import { noteDecodePressure } from './assetPool'

let longTaskObserver: PerformanceObserver | null = null
let clearLongTaskTimer: ReturnType<typeof setTimeout> | undefined
let memoryTimer: ReturnType<typeof setInterval> | undefined
let started = false

const LONG_TASK_CLEAR_MS = 250
const MEMORY_POLL_MS = 2000
const MEMORY_PRESSURE_RATIO = 0.9

function clearLongTaskPressureSoon(): void {
  clearTimeout(clearLongTaskTimer)
  clearLongTaskTimer = setTimeout(() => {
    clearLongTaskTimer = undefined
    noteDecodePressure({ longTaskPressure: false })
  }, LONG_TASK_CLEAR_MS)
}

function sampleMemoryPressure(): void {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number }
  }
  const memory = perf.memory
  if (memory === undefined || !(memory.jsHeapSizeLimit > 0)) {
    noteDecodePressure({ memoryPressure: false })
    return
  }
  const ratio = memory.usedJSHeapSize / memory.jsHeapSizeLimit
  noteDecodePressure({ memoryPressure: ratio >= MEMORY_PRESSURE_RATIO })
}

/** Start longtask + optional heap observers that drive adaptive decode backoff. */
export function startDecodePressureObserver(): void {
  if (started) {
    return
  }
  started = true

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      longTaskObserver = new PerformanceObserver(() => {
        noteDecodePressure({ longTaskPressure: true })
        clearLongTaskPressureSoon()
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch {
      try {
        longTaskObserver = new PerformanceObserver(() => {
          noteDecodePressure({ longTaskPressure: true })
          clearLongTaskPressureSoon()
        })
        longTaskObserver.observe({
          type: 'long-animation-frame',
          buffered: true,
        })
      } catch {
        longTaskObserver = null
      }
    }
  }

  sampleMemoryPressure()
  memoryTimer = setInterval(sampleMemoryPressure, MEMORY_POLL_MS)
}

/** Test / teardown. */
export function stopDecodePressureObserver(): void {
  longTaskObserver?.disconnect()
  longTaskObserver = null
  clearTimeout(clearLongTaskTimer)
  clearLongTaskTimer = undefined
  if (memoryTimer !== undefined) {
    clearInterval(memoryTimer)
    memoryTimer = undefined
  }
  started = false
  noteDecodePressure({ longTaskPressure: false, memoryPressure: false })
}

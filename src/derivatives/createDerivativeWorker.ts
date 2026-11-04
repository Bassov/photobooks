/** Isolated Worker factory so Stryker can instrument the pool without breaking Vite's static Worker analysis. */
export function createDerivativeWorker(): Worker {
  // @vite-ignore must sit in the options arg so Stryker's ternary/cover wrappers stay parseable.
  return new Worker(
    new URL('./derivative.worker.ts', import.meta.url),
    /* @vite-ignore */ {
      type: 'module',
    },
  )
}

/** Isolated Worker factory so Stryker can instrument callers without breaking Vite's static Worker analysis. */
export function createPdfWorker(): Worker {
  // @vite-ignore must sit in the options arg so Stryker's ternary/cover wrappers stay parseable.
  return new Worker(
    new URL('./pdf.worker.ts', import.meta.url),
    /* @vite-ignore */ {
      type: 'module',
    },
  )
}

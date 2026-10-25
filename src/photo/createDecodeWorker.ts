/** Isolated Worker factory so Stryker can instrument assetPool without breaking Vite's static Worker analysis. */
export function createDecodeWorker(): Worker {
  return new Worker(new URL('./photo.worker.ts', import.meta.url), {
    type: 'module',
  })
}

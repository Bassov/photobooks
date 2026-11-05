import { startLab } from './labPage'

const root = document.getElementById('lab')
if (root) {
  // @vite-ignore keeps Stryker's wrappers around the options parseable (see createDerivativeWorker).
  const worker = new Worker(
    new URL('./lab.worker.ts', import.meta.url),
    /* @vite-ignore */ {
      type: 'module',
    },
  )
  void startLab(root, worker, (blob) => URL.createObjectURL(blob))
}

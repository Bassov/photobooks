import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { enablePerfHooks, shouldEnablePerfHooks } from '../perf/exposePerf'
import { warmPhotoWorker } from '../photo/loadPhoto'
import { createRootTree } from './rootTree'

interface MountPhotobooksOptions {
  getRootElement?: () => HTMLElement | null
  createRoot?: typeof createRoot
  /** Injected from `src/main` so `src/ui` stays free of editor/project imports. */
  configureSession: (deps: object) => void
  createSessionDeps: () => object
  shouldEnablePerf?: typeof shouldEnablePerfHooks
  enablePerf?: typeof enablePerfHooks
  warmWorker?: typeof warmPhotoWorker
  createTree?: (search: string) => ReactNode
  getSearch?: () => string
}

/** Product bootstrap used by the Vite entry (session, optional specimen). */
export function mountPhotobooks(deps: MountPhotobooksOptions): void {
  const getRootElement =
    deps.getRootElement ?? (() => document.getElementById('root'))
  const rootFactory = deps.createRoot ?? createRoot
  const configureSession = deps.configureSession
  const createSessionDeps = deps.createSessionDeps
  const shouldEnablePerf = deps.shouldEnablePerf ?? shouldEnablePerfHooks
  const enablePerf = deps.enablePerf ?? enablePerfHooks
  const warmWorker = deps.warmWorker ?? warmPhotoWorker
  const createTree = deps.createTree ?? createRootTree
  const getSearch = deps.getSearch ?? (() => window.location.search)

  configureSession(createSessionDeps())
  if (shouldEnablePerf()) {
    enablePerf()
    warmWorker()
  }
  const rootElement = getRootElement()
  if (!rootElement) {
    throw new Error('Root element #root not found')
  }
  const tree: ReactNode = <StrictMode>{createTree(getSearch())}</StrictMode>
  rootFactory(rootElement).render(tree)
}

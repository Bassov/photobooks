import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureProjectSession } from '../editor/projectSession'
import { createBrowserProjectSessionDeps } from '../editor/session/browserProjectSessionPlatform'
import { enablePerfHooks, shouldEnablePerfHooks } from '../perf/exposePerf'
import { warmPhotoWorker } from '../photo/loadPhoto'
import { applyPreferredTheme, readPrefersDark } from './preferredTheme'
import { createRootTree } from './rootTree'

export interface MountPhotobooksDeps {
  getRootElement: () => HTMLElement | null
  createRoot: typeof createRoot
  configureSession: typeof configureProjectSession
  createSessionDeps: typeof createBrowserProjectSessionDeps
  shouldEnablePerf: typeof shouldEnablePerfHooks
  enablePerf: typeof enablePerfHooks
  warmWorker: typeof warmPhotoWorker
  applyTheme: () => void
  createTree: (search: string) => ReactNode
  getSearch: () => string
}

function defaultApplyTheme(): void {
  applyPreferredTheme(document.documentElement, readPrefersDark())
}

const defaultDeps: MountPhotobooksDeps = {
  getRootElement: () => document.getElementById('root'),
  createRoot,
  configureSession: configureProjectSession,
  createSessionDeps: createBrowserProjectSessionDeps,
  shouldEnablePerf: shouldEnablePerfHooks,
  enablePerf: enablePerfHooks,
  warmWorker: warmPhotoWorker,
  applyTheme: defaultApplyTheme,
  createTree: createRootTree,
  getSearch: () => window.location.search,
}

/** Product bootstrap used by the Vite entry (theme, session, optional specimen). */
export function mountPhotobooks(deps: Partial<MountPhotobooksDeps> = {}): void {
  const d: MountPhotobooksDeps = { ...defaultDeps, ...deps }
  d.applyTheme()
  d.configureSession(d.createSessionDeps())
  if (d.shouldEnablePerf()) {
    d.enablePerf()
    d.warmWorker()
  }
  const rootElement = d.getRootElement()
  if (!rootElement) {
    throw new Error('Root element #root not found')
  }
  const tree: ReactNode = <StrictMode>{d.createTree(d.getSearch())}</StrictMode>
  d.createRoot(rootElement).render(tree)
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { configureProjectSession } from './editor/projectSession'
import { createBrowserProjectSessionDeps } from './editor/session/browserProjectSessionPlatform'
import './index.css'
import { enablePerfHooks, shouldEnablePerfHooks } from './perf/exposePerf'
import { warmPhotoWorker } from './photo/loadPhoto'

configureProjectSession(createBrowserProjectSessionDeps())

// Scratch Done-when probe: only e2e preview sets VITE_E2E (unit never loads this module).
if (import.meta.env.VITE_E2E === '1' || import.meta.env.VITE_E2E === 'true') {
  void import('./lib/e2eCoverageProbe').then(({ markE2eCoverageProbe }) => {
    ;(
      window as Window & { __photobooksE2eCoverageProbe?: string }
    ).__photobooksE2eCoverageProbe = markE2eCoverageProbe()
  })
}

if (shouldEnablePerfHooks()) {
  enablePerfHooks()
  warmPhotoWorker()
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

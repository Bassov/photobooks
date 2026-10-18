import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { configureProjectSession } from './editor/projectSession'
import { createBrowserProjectSessionDeps } from './editor/session/browserProjectSessionPlatform'
import './index.css'
import { enablePerfHooks, shouldEnablePerfHooks } from './perf/exposePerf'
import { warmPhotoWorker } from './photo/loadPhoto'

configureProjectSession(createBrowserProjectSessionDeps())

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

import { useEffect, useSyncExternalStore } from 'react'
import { EditorShell } from './editor/EditorShell'
import { LibraryScreen } from './editor/LibraryScreen'
import { UnsupportedBrowserScreen } from './editor/UnsupportedBrowserScreen'
import { WelcomeScreen } from './editor/WelcomeScreen'
import { getBrowserSupport } from './editor/browserSupport'
import { loadPainterFixture } from './editor/bookStore'
import { isPainterFixtureQuery } from './editor/painterFixtureQuery'
import {
  attachOpfsTestLibrary,
  exposeProjectSessionTestApi,
  getProjectSessionSnapshot,
  setSurfaceForTests,
  startSessionEditor,
  subscribeProjectSession,
  tryRestore,
} from './editor/projectSession'

function isTestLibraryQuery(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return new URLSearchParams(window.location.search).has('testLibrary')
}

async function ensureTestLibrary(): Promise<void> {
  const restored = await tryRestore()
  if (restored.ok && restored.value !== null) {
    return
  }
  await attachOpfsTestLibrary()
}

function App() {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )

  useEffect(() => {
    exposeProjectSessionTestApi()
    if (isPainterFixtureQuery()) {
      startSessionEditor()
      loadPainterFixture()
      return
    }
    if (isTestLibraryQuery()) {
      void ensureTestLibrary()
      return
    }
    if (!getBrowserSupport().supported) {
      setSurfaceForTests('unsupported')
      return
    }
    void tryRestore()
  }, [])

  if (project.surface === 'unsupported') {
    return <UnsupportedBrowserScreen />
  }
  if (project.surface === 'welcome') {
    return <WelcomeScreen />
  }
  if (project.surface === 'library') {
    return <LibraryScreen />
  }
  return <EditorShell />
}

export default App

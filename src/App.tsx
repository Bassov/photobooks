import { useEffect, useSyncExternalStore } from 'react'
import { EditorShell } from './editor/EditorShell'
import { HomeScreen } from './editor/HomeScreen'
import { loadPainterFixture } from './editor/bookStore'
import { isPainterFixtureQuery } from './editor/painterFixtureQuery'
import {
  attachOpfsTestLibrary,
  exposeProjectSessionTestApi,
  getProjectSessionSnapshot,
  startSessionEditor,
  subscribeProjectSession,
  tryRestore,
} from './editor/projectSession'
import { clearThumbsAndDerivedCacheForTests } from './editor/clearThumbsForTests'

declare global {
  interface Window {
    __photobooksThumbs?: {
      clearThumbsAndDerivedCacheForTests: () => Promise<void>
    }
  }
}

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
    if (typeof window !== 'undefined') {
      window.__photobooksThumbs = { clearThumbsAndDerivedCacheForTests }
    }
    if (isPainterFixtureQuery()) {
      startSessionEditor()
      loadPainterFixture()
      return
    }
    if (isTestLibraryQuery()) {
      void ensureTestLibrary()
      return
    }
    void tryRestore()
  }, [])

  if (project.surface === 'home') {
    return <HomeScreen />
  }
  return <EditorShell />
}

export default App

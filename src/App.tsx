import { useEffect, useSyncExternalStore } from 'react'
import { EditorShell } from './editor/EditorShell'
import { LibraryScreen } from './editor/LibraryScreen'
import { UnsupportedBrowserScreen } from './editor/UnsupportedBrowserScreen'
import { WelcomeScreen } from './editor/WelcomeScreen'
import { getBrowserSupport } from './editor/browserSupport'
import {
  exposeProjectSessionTestApi,
  getProjectSessionSnapshot,
  setSurfaceForTests,
  subscribeProjectSession,
  tryRestore,
} from './editor/projectSession'

/** Fixture entries are reached only through `import()` in test-fixture builds. */
function startTestFixtureEntry(): boolean {
  // Literal `import.meta.env` check so Rollup folds it before chunking.
  if (import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fixture') === 'painter') {
      void import('./testFixtures/entries').then((entries) => {
        entries.enterPainterFixture()
      })
      return true
    }
    if (params.has('testLibrary')) {
      void import('./testFixtures/entries').then((entries) =>
        entries.enterTestLibrary(),
      )
      return true
    }
  }
  return false
}

function App() {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )

  useEffect(() => {
    exposeProjectSessionTestApi()
    if (startTestFixtureEntry()) {
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

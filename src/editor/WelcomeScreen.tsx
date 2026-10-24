import { useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Status } from '../ui/Status'
import {
  chooseLibraryFolder,
  getProjectSessionSnapshot,
  regrantLibrary,
  subscribeProjectSession,
} from './projectSession'
import { ensureScreenPlaceholderStyles } from './screenPlaceholdersStyles'

ensureScreenPlaceholderStyles()

export function WelcomeScreen() {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )
  const busy = project.actionBusy || project.restorePending
  const needsRegrant = project.accessPhase === 'permission-required'
  const folderName = project.libraryLabel ?? 'library folder'

  return (
    <main className="pb-screen pb-screen--welcome" data-testid="welcome-screen">
      <h1 className="heading">Photobooks</h1>
      {project.restorePending ? (
        <p data-testid="welcome-loading">Loading…</p>
      ) : needsRegrant ? (
        <EmptyState
          icon={<Icon name="folder" size={20} />}
          title="Allow library access"
          description={`Chrome needs permission again for “${folderName}”.`}
          actions={
            <Button
              data-testid="allow-library-access"
              isDisabled={busy}
              onPress={() => {
                void regrantLibrary()
              }}
            >
              {`Allow access to ${folderName}`}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Icon name="folder" size={20} />}
          title="Choose a library folder"
          description="Pick one folder on this computer to store your photobooks. Photobooks keeps working offline with File System Access."
          actions={
            <Button
              data-testid="choose-library"
              isDisabled={busy}
              onPress={() => {
                void chooseLibraryFolder()
              }}
            >
              Choose library folder
            </Button>
          }
        />
      )}
      {project.homeError ? (
        <Status data-testid="welcome-error">{project.homeError}</Status>
      ) : null}
    </main>
  )
}

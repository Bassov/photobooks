import { useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Status } from '../ui/Status'
import {
  chooseLibraryFolder,
  getProjectSessionSnapshot,
  regrantLibrary,
  startSessionEditor,
  subscribeProjectSession,
} from './projectSession'
import { WELCOME_HERO_SRC } from './welcomeCredits'
import { WelcomePhotoCaption } from './WelcomePhotoCaption'
import { ensureWelcomeScreenStyles } from './welcomeScreenStyles'

ensureWelcomeScreenStyles()

function Mark() {
  return (
    <div
      className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground"
      data-testid="welcome-mark"
    >
      <div className="grid size-6 place-items-center rounded-md bg-field text-foreground">
        <Icon name="bookOpen" size={14} className="size-3.5" />
      </div>
      Photobooks
    </div>
  )
}

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
    <div
      data-testid="home-screen"
      className="relative h-dvh min-h-dvh w-full overflow-hidden"
    >
      <button
        type="button"
        data-testid="start-session"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-auto absolute left-0 top-0 z-0 size-px opacity-[0.01]"
        onClick={() => {
          startSessionEditor()
        }}
      >
        Start session
      </button>
      <main
        className="pb-welcome relative h-full w-full overflow-hidden text-foreground"
        data-testid="welcome-screen"
      >
        <div className="pb-welcome-hero-mask absolute inset-y-0 left-[33%] right-0 overflow-hidden">
          <div
            className="pb-welcome-hero absolute inset-0"
            data-testid="welcome-hero"
            data-hero-src={WELCOME_HERO_SRC}
          />
        </div>
        <header className="absolute inset-x-0 top-0 flex items-center px-14 py-9">
          <Mark />
        </header>
        <div className="absolute left-14 top-1/2 w-[min(780px,46%)] -translate-y-1/2">
          {project.restorePending ? (
            <p
              className="pb-welcome-rise text-sm text-muted-foreground"
              data-testid="welcome-loading"
            >
              Loading…
            </p>
          ) : needsRegrant ? (
            <>
              <div className="pb-welcome-rise text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Allow library access
              </div>
              <h1 className="pb-welcome-rise pb-welcome-rise--d1 pb-welcome-headline pb-welcome-headline--regrant mt-5 leading-[0.94] tracking-[-0.04em]">
                Chrome needs permission again for “{folderName}”.
              </h1>
              <div className="pb-welcome-rise pb-welcome-rise--d4 mt-10">
                <Button
                  className="pb-welcome-create"
                  isDisabled={busy}
                  data-testid="allow-library-access"
                  onPress={() => {
                    void regrantLibrary()
                  }}
                >
                  {`Allow access to ${folderName}`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="pb-welcome-rise text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Welcome to Photobooks
              </div>
              <h1 className="pb-welcome-rise pb-welcome-rise--d1 pb-welcome-headline mt-5 leading-[0.94] tracking-[-0.04em]">
                A quiet place
                <br />
                <em>for your books.</em>
              </h1>
              <p className="pb-welcome-rise pb-welcome-rise--d25 mt-7 max-w-[440px] text-lead leading-7 text-muted-foreground">
                One folder on your disk where all your books are saved — your
                library. Choose where it lives.
              </p>
              <div className="pb-welcome-rise pb-welcome-rise--d4 mt-10">
                <Button
                  className="pb-welcome-create"
                  isDisabled={busy}
                  data-testid="create-library"
                  onPress={() => {
                    void chooseLibraryFolder()
                  }}
                >
                  Create Library
                </Button>
              </div>
              <p className="pb-welcome-rise pb-welcome-rise--d5 mt-4 pl-1 text-sm text-muted-foreground">
                You’ll choose a folder on your disk.
              </p>
            </>
          )}
          {project.homeError ? (
            <Status className="mt-6" data-testid="welcome-error">
              {project.homeError}
            </Status>
          ) : null}
        </div>
        <WelcomePhotoCaption
          id="c18"
          testid="screen-credit"
          className="absolute top-6 right-6"
        />
      </main>
    </div>
  )
}

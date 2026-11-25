import { Component, type ReactNode } from 'react'
import { isChunkLoadError } from '../lib/staleChunkReload'
import { Button } from '../ui/Button'
import { SUB } from './editorChromeTokens'
import { SitePreviewFrame } from './SitePreviewBar'
import { staleChunkRecovery } from './staleChunkSession'

/** `reloading`: page is going away. `offer`: Reload. `unsaved`: save failed. */
type Phase = 'reloading' | 'offer' | 'unsaved'

interface State {
  readonly failed: boolean
  readonly phase: Phase
}

/**
 * Keeps the editor when the lazy Site preview cannot render (a stale chunk
 * after a redeploy, or any render error): the preview frame stays up with
 * Back (Esc) and a Reload. A chunk-load error starts the save-then-reload-once
 * recovery; when its guard declines, the Reload is offered instead.
 */
export class StaleChunkBoundary extends Component<
  { onExit: () => void; children: ReactNode },
  State
> {
  state: State = { failed: false, phase: 'offer' }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      failed: true,
      phase: isChunkLoadError(error) ? 'reloading' : 'offer',
    }
  }

  componentDidCatch(error: unknown): void {
    if (!isChunkLoadError(error)) return
    void staleChunkRecovery()
      .recover()
      .then((outcome) => {
        if (outcome === 'failed') this.setState({ phase: 'offer' })
      })
  }

  private readonly reload = (): void => {
    const discardUnsaved = this.state.phase === 'unsaved'
    void staleChunkRecovery()
      .reloadNow(discardUnsaved)
      .then((outcome) => {
        if (outcome === 'failed') this.setState({ phase: 'unsaved' })
      })
  }

  render(): ReactNode {
    const { failed, phase } = this.state
    if (!failed) return this.props.children
    return (
      <SitePreviewFrame onExit={this.props.onExit}>
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm"
          style={{ color: SUB }}
          role="alert"
          data-testid="site-preview-load-error"
        >
          {phase === 'reloading' ? (
            <p>Updating Photobooks…</p>
          ) : (
            <>
              <p>
                {phase === 'unsaved'
                  ? 'Your changes could not be saved. Reloading now loses them.'
                  : 'Site preview could not load. Photobooks may have been updated: reload to get the new version.'}
              </p>
              <Button
                size="sm"
                variant={phase === 'unsaved' ? 'destructive' : 'default'}
                onPress={this.reload}
                data-testid="site-preview-reload"
              >
                {phase === 'unsaved' ? 'Reload anyway' : 'Reload'}
              </Button>
            </>
          )}
        </div>
      </SitePreviewFrame>
    )
  }
}

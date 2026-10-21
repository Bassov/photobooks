import { useSyncExternalStore } from 'react'
import { getGalleryIdsSnapshot, subscribeGallery } from './bookStore'
import { requestFilmstripJump } from './filmstripJump'
import {
  clearImportErrors,
  closeImportErrorsPanel,
  dismissImportError,
  getImportErrorGroups,
  isImportErrorsPanelOpen,
  setImportErrorsPanelOpen,
  subscribeImportErrors,
} from './importErrorsStore'
import { Button } from '../ui/Button'
import { Dialog, DialogTitle } from '../ui/Dialog'
import './ImportErrorsPanel.css'

export function ImportErrorsPanel() {
  const open = useSyncExternalStore(
    subscribeImportErrors,
    isImportErrorsPanelOpen,
    isImportErrorsPanelOpen,
  )
  const groups = useSyncExternalStore(
    subscribeImportErrors,
    getImportErrorGroups,
    getImportErrorGroups,
  )
  const gallery = useSyncExternalStore(
    subscribeGallery,
    getGalleryIdsSnapshot,
    getGalleryIdsSnapshot,
  )

  if (!open) {
    return null
  }

  return (
    <Dialog
      isOpen
      onOpenChange={setImportErrorsPanelOpen}
      isDismissable
      className="import-errors-panel"
      data-testid="import-errors-panel"
      aria-label="Import errors"
    >
      <div className="import-errors-panel__head">
        <DialogTitle>Import errors</DialogTitle>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => {
            clearImportErrors()
            closeImportErrorsPanel()
          }}
          isDisabled={groups.length === 0}
        >
          Clear all
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="import-errors-panel__empty">No import errors.</p>
      ) : (
        <ul className="import-errors-panel__groups">
          {groups.map((group) => (
            <li key={group.reason} className="import-errors-panel__group">
              <details open>
                <summary className="import-errors-panel__summary">
                  {group.label}
                </summary>
                <ul className="import-errors-panel__entries">
                  {group.errors.map((error) => {
                    const assetId = error.assetId
                    const linked =
                      assetId !== undefined && gallery.includes(assetId)
                    return (
                      <li
                        key={error.id}
                        className="import-errors-panel__entry"
                        data-testid="import-error-entry"
                        data-error-id={error.id}
                        data-reason={error.reason}
                      >
                        {linked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="import-errors-panel__jump"
                            onPress={() => {
                              requestFilmstripJump(assetId)
                              closeImportErrorsPanel()
                            }}
                          >
                            {error.name}
                          </Button>
                        ) : (
                          <span className="import-errors-panel__name">
                            {error.name}
                            <span className="import-errors-panel__not-imported">
                              {' '}
                              — Not imported
                            </span>
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="import-errors-panel__dismiss"
                          aria-label={`Dismiss error for ${error.name}`}
                          onPress={() => {
                            dismissImportError(error.id)
                          }}
                        >
                          ×
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

import { useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { Dialog, DialogTitle } from '../ui/Dialog'
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
import {
  importErrorsPanelDismissStyle,
  importErrorsPanelEmptyStyle,
  importErrorsPanelEntriesStyle,
  importErrorsPanelEntryStyle,
  importErrorsPanelGroupStyle,
  importErrorsPanelHeadStyle,
  importErrorsPanelListStyle,
  importErrorsPanelNameStyle,
  importErrorsPanelNotImportedStyle,
  importErrorsPanelSummaryStyle,
} from './importErrorsPanelStyles'

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
      data-testid="import-errors-panel"
      aria-label="Import errors"
    >
      <div style={importErrorsPanelHeadStyle}>
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
        <p style={importErrorsPanelEmptyStyle}>No import errors.</p>
      ) : (
        <ul style={importErrorsPanelListStyle}>
          {groups.map((group, groupIndex) => (
            <li
              key={group.reason}
              style={groupIndex === 0 ? undefined : importErrorsPanelGroupStyle}
            >
              <details open>
                <summary style={importErrorsPanelSummaryStyle}>
                  {group.label}
                </summary>
                <ul style={importErrorsPanelEntriesStyle}>
                  {group.errors.map((error) => {
                    const assetId = error.assetId
                    const linked =
                      assetId !== undefined && gallery.includes(assetId)
                    return (
                      <li
                        key={error.id}
                        style={importErrorsPanelEntryStyle}
                        data-testid="import-error-entry"
                        data-error-id={error.id}
                        data-reason={error.reason}
                      >
                        {linked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="import-errors-panel__jump"
                            style={importErrorsPanelNameStyle}
                            onPress={() => {
                              requestFilmstripJump(assetId)
                              closeImportErrorsPanel()
                            }}
                          >
                            {error.name}
                          </Button>
                        ) : (
                          <span style={importErrorsPanelNameStyle}>
                            {error.name}
                            <span style={importErrorsPanelNotImportedStyle}>
                              {' '}
                              — Not imported
                            </span>
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          style={importErrorsPanelDismissStyle}
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

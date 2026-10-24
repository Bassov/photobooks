import { useEffect, useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Status } from '../ui/Status'
import {
  getGalleryIdsSnapshot,
  getHasAnyPlacementSnapshot,
  subscribeBookStore,
} from './bookStore'
import { STATUS_PLACEMENT_HINT } from './editorStatus'
import {
  getNoPhotosFoundHint,
  setNoPhotosFoundHint,
  subscribeNoPhotosFoundHint,
} from './emptyGalleryHint'
import {
  pasteboardEmptyActionsStyle,
  pasteboardEmptyCardStyle,
  pasteboardEmptyOverlayStyle,
  pasteboardPlacementHintStyle,
} from './pasteboardEmptyStyles'
import type { ChromeImportApi } from './useChromeImport'

const EMPTY_DESCRIPTION =
  'Choose a photo folder, then drag photos onto frames to build your book.'
const NO_PHOTOS_DESCRIPTION = 'No photos found in that folder'

function getGalleryEmpty(): boolean {
  return getGalleryIdsSnapshot().length === 0
}

export function PasteboardEmptyGuidance({
  onChoosePhotoFolder,
  photoFolderLabel,
  importDisabled,
}: Pick<
  ChromeImportApi,
  'onChoosePhotoFolder' | 'photoFolderLabel' | 'importDisabled'
>) {
  const galleryEmpty = useSyncExternalStore(
    subscribeBookStore,
    getGalleryEmpty,
    getGalleryEmpty,
  )
  const hasPlacement = useSyncExternalStore(
    subscribeBookStore,
    getHasAnyPlacementSnapshot,
    getHasAnyPlacementSnapshot,
  )
  const noPhotosFound = useSyncExternalStore(
    subscribeNoPhotosFoundHint,
    getNoPhotosFoundHint,
    getNoPhotosFoundHint,
  )
  const showHint = !galleryEmpty && !hasPlacement

  useEffect(() => {
    if (!galleryEmpty && noPhotosFound) {
      setNoPhotosFoundHint(false)
    }
  }, [galleryEmpty, noPhotosFound])

  if (galleryEmpty) {
    return (
      <div style={pasteboardEmptyOverlayStyle} data-testid="pasteboard-empty">
        <EmptyState
          style={pasteboardEmptyCardStyle}
          data-testid="pasteboard-empty-card"
          icon={<Icon name="image" size={20} />}
          title="Start with your photos"
          description={
            noPhotosFound ? NO_PHOTOS_DESCRIPTION : EMPTY_DESCRIPTION
          }
          actions={
            <div style={pasteboardEmptyActionsStyle}>
              <Button
                size="sm"
                isDisabled={importDisabled}
                onPress={() => {
                  void onChoosePhotoFolder()
                }}
              >
                {photoFolderLabel}
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  if (!showHint) {
    return null
  }

  // Visual-only guidance on the pasteboard: announce via this polite Status,
  // never write into the shared editor-status line (restore / unplace / save).
  return (
    <Status
      politeness="polite"
      style={pasteboardPlacementHintStyle}
      data-testid="pasteboard-placement-hint"
    >
      {STATUS_PLACEMENT_HINT}
    </Status>
  )
}

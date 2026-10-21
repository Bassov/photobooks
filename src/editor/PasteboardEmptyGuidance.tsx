import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import {
  getGalleryIdsSnapshot,
  getHasAnyPlacementSnapshot,
  subscribeBookStore,
} from './bookStore'
import { STATUS_PLACEMENT_HINT, setEditorStatus } from './editorStatus'
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
  'Add a folder or photos, then drag them onto frames to build your book.'
const NO_PHOTOS_DESCRIPTION = 'No photos found in that folder'

function getGalleryEmpty(): boolean {
  return getGalleryIdsSnapshot().length === 0
}

export function PasteboardEmptyGuidance({
  onAddPhotos,
  onAddFolder,
  importDisabled,
}: Pick<ChromeImportApi, 'onAddPhotos' | 'onAddFolder' | 'importDisabled'>) {
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
  const announcedRef = useRef(false)

  useEffect(() => {
    if (!galleryEmpty && noPhotosFound) {
      setNoPhotosFoundHint(false)
    }
  }, [galleryEmpty, noPhotosFound])

  useEffect(() => {
    if (showHint) {
      if (!announcedRef.current) {
        setEditorStatus(STATUS_PLACEMENT_HINT)
        announcedRef.current = true
      }
      return
    }
    announcedRef.current = false
  }, [showHint])

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
                  void onAddFolder()
                }}
              >
                Add folder…
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={importDisabled}
                onPress={() => {
                  void onAddPhotos()
                }}
              >
                Add photos…
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

  return (
    <div
      style={pasteboardPlacementHintStyle}
      data-testid="pasteboard-placement-hint"
      aria-hidden="true"
    >
      {STATUS_PLACEMENT_HINT}
    </div>
  )
}

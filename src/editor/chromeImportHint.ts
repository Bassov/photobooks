import { setNoPhotosFoundHint } from './emptyGalleryHint'

/** Update the empty-gallery secondary line after a chrome import finishes. */
export function applyChromeImportHint(
  source: 'photos' | 'folder',
  imported: number,
  fileCount: number,
): void {
  if (source === 'folder' && imported === 0 && fileCount > 0) {
    setNoPhotosFoundHint(true)
    return
  }
  if (imported > 0) {
    setNoPhotosFoundHint(false)
  }
}

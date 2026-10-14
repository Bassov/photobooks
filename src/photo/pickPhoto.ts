import {
  canUseOpenFilePicker,
  photoInputAccept,
  pickPhotosWithFilePicker,
} from './pickPhotos'

export { canUseOpenFilePicker, photoInputAccept }

/** Single-file FSA pick (legacy helper). Prefer `pickPhotosWithFilePicker`. */
export async function pickPhotoWithFilePicker(): Promise<File | null> {
  const files = await pickPhotosWithFilePicker()
  if (files === null) {
    return null
  }
  return files[0] ?? null
}

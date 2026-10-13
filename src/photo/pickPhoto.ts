import { acceptedPhotoAcceptAttr } from './mime'

const PICKER_TYPES = [
  {
    description: 'Images',
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  },
]

export function canUseOpenFilePicker(): boolean {
  return typeof window.showOpenFilePicker === 'function'
}

export async function pickPhotoWithFilePicker(): Promise<File | null> {
  const openFilePicker = window.showOpenFilePicker
  if (typeof openFilePicker !== 'function') {
    return null
  }

  try {
    const [handle] = await openFilePicker({
      multiple: false,
      types: PICKER_TYPES,
      excludeAcceptAllOption: true,
    })
    return await handle.getFile()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }
}

export function photoInputAccept(): string {
  return acceptedPhotoAcceptAttr()
}

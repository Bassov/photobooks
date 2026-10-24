import { installFilmstripUnplace } from './galleryDrop'

/** Install unplace handlers when the scroll node is mounted. */
export function installFilmstripUnplaceWhenMounted(
  node: HTMLElement | null,
): (() => void) | undefined {
  if (node === null) {
    return undefined
  }
  return installFilmstripUnplace(node)
}

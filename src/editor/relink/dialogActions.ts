import { filesFromFileList, shouldCloseAfterResolve } from './dialogView'
import { setRelinkDialogOpen } from './statusStore'

export function skipRelinkDialog(): void {
  setRelinkDialogOpen(false)
}

export function clickFolderInput(input: HTMLInputElement | null): void {
  input?.click()
}

export function bindFolderInput(
  el: HTMLInputElement | null,
  folderRef: { current: HTMLInputElement | null },
): void {
  folderRef.current = el
  el?.setAttribute('webkitdirectory', '')
}

export async function resolveAndMaybeClose(
  onResolve: () => Promise<number>,
): Promise<void> {
  const n = await onResolve()
  if (shouldCloseAfterResolve(n)) {
    setRelinkDialogOpen(false)
  }
}

export function folderInputChanged(
  files: FileList | null,
  onRescanFiles: (files: readonly File[]) => Promise<unknown>,
  clearValue: () => void,
): void {
  const list = filesFromFileList(files)
  clearValue()
  if (list === null) {
    return
  }
  void onRescanFiles(list)
}

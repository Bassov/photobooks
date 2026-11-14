import type { Page } from '@playwright/test'

/**
 * `readOpfsText` result while the app is rewriting the file: the `File`
 * snapshot went stale under a closing writable (`NotReadableError`). Polls
 * read it as "not ready yet" and try again.
 */
export const OPFS_MID_WRITE = 'opfs:mid-write'

/** Text of the OPFS file at `path` (directories…, file name). */
export async function readOpfsText(
  page: Page,
  path: readonly string[],
): Promise<string> {
  return page.evaluate(
    async ({ path, midWrite }) => {
      let dir = await navigator.storage.getDirectory()
      for (const name of path.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(name)
      }
      const handle = await dir.getFileHandle(path[path.length - 1] ?? '')
      try {
        return await (await handle.getFile()).text()
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotReadableError')
          return midWrite
        throw error
      }
    },
    { path, midWrite: OPFS_MID_WRITE },
  )
}

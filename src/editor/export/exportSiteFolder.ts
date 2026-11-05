import {
  createSiteExportFolderIdb,
  type SessionIdb,
} from '../../project/session/idb'

/** IDB key of the folder used while no library is open. */
export const SESSION_FOLDER_KEY = 'session'

/** Picker id so the browser reopens the last site folder. */
const PICKER_ID = 'photobooks-site'

type DirectoryPicker = (options: {
  id: string
  mode: 'readwrite'
}) => Promise<FileSystemDirectoryHandle>

function isDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'directory' &&
    typeof (value as { name?: unknown }).name === 'string'
  )
}

/** `showDirectoryPicker` (readwrite); a dismissed or missing picker → `null`. */
export async function pickExportFolder(
  scope: object = globalThis,
): Promise<FileSystemDirectoryHandle | null> {
  const picker = (scope as { showDirectoryPicker?: DirectoryPicker })
    .showDirectoryPicker
  if (typeof picker !== 'function') {
    return null
  }
  try {
    return await picker.call(scope, { id: PICKER_ID, mode: 'readwrite' })
  } catch {
    return null
  }
}

/** The folder remembered for `key`; storage errors read as none. */
export async function loadExportFolder(
  key: string,
  idb: SessionIdb = createSiteExportFolderIdb(),
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const stored = await idb.get(key)
    return stored.present && isDirectoryHandle(stored.value)
      ? stored.value
      : null
  } catch {
    return null
  }
}

/** Remember the folder for `key`; without IDB it lasts for the dialog only. */
export async function saveExportFolder(
  key: string,
  handle: FileSystemDirectoryHandle,
  idb: SessionIdb = createSiteExportFolderIdb(),
): Promise<void> {
  try {
    await idb.set(key, handle)
  } catch {
    // Blocked storage: the export still works with the picked handle.
  }
}

/**
 * Re-request readwrite access (call inside the Export click). Handles
 * without the permission API (OPFS in tests) count as granted.
 */
export async function requestFolderWrite(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const request = (
    handle as {
      requestPermission?: (options: {
        mode: 'readwrite'
      }) => Promise<PermissionState>
    }
  ).requestPermission
  if (typeof request !== 'function') {
    return true
  }
  try {
    return (await request.call(handle, { mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

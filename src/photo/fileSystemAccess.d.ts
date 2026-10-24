interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
}

type WellKnownDirectory =
  'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: WellKnownDirectory | FileSystemHandle
}

interface Window {
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>
  showDirectoryPicker?: (
    options?: DirectoryPickerOptions,
  ) => Promise<FileSystemDirectoryHandle>
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
  queryPermission?: (
    descriptor?: FileSystemHandlePermissionDescriptor,
  ) => Promise<PermissionState>
  requestPermission?: (
    descriptor?: FileSystemHandlePermissionDescriptor,
  ) => Promise<PermissionState>
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean
}

interface FileSystemGetFileOptions {
  create?: boolean
}

interface FileSystemGetDirectoryOptions {
  create?: boolean
}

interface FileSystemRemoveOptions {
  recursive?: boolean
}

interface FileSystemWritableFileStream {
  write(data: FileSystemWriteChunkType): Promise<undefined>
  close(): Promise<undefined>
}

type FileSystemWriteChunkType = BufferSource | Blob | string | WriteParams

interface WriteParams {
  type: 'write' | 'seek' | 'truncate'
  data?: BufferSource | Blob | string
  position?: number
  size?: number
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
  createWritable(
    options?: FileSystemCreateWritableOptions,
  ): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory'
  getDirectoryHandle(
    name: string,
    options?: FileSystemGetDirectoryOptions,
  ): Promise<FileSystemDirectoryHandle>
  getFileHandle(
    name: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle>
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
  values(): AsyncIterableIterator<FileSystemHandle>
  keys(): AsyncIterableIterator<string>
}

import { describe, expect, it } from 'vitest'
import { directoryHandleFromFiles } from './directoryHandleFromFiles'

describe('directoryHandleFromFiles', () => {
  it('exposes files by basename for getFileHandle and entries', async () => {
    const nested = new File([new Uint8Array([1])], 'shot.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(nested, 'webkitRelativePath', {
      value: 'album/shot.jpg',
    })
    const flat = new File([new Uint8Array([2])], 'cover.png', {
      type: 'image/png',
    })
    const directory = directoryHandleFromFiles([nested, flat], 'Trip')
    expect(directory.name).toBe('Trip')
    expect(directory.kind).toBe('directory')

    const shot = await directory.getFileHandle('shot.jpg')
    await expect(shot.getFile()).resolves.toBe(nested)

    const cover = await directory.getFileHandle('cover.png')
    await expect(cover.getFile()).resolves.toBe(flat)

    await expect(directory.getFileHandle('missing.jpg')).rejects.toMatchObject({
      name: 'NotFoundError',
    })

    const names: string[] = []
    for await (const [name, entry] of directory.entries()) {
      names.push(name)
      expect(entry.kind).toBe('file')
    }
    expect(names.sort()).toEqual(['cover.png', 'shot.jpg'])
  })

  it('reports granted read permission', async () => {
    const directory = directoryHandleFromFiles(
      [],
    ) as FileSystemDirectoryHandle & {
      queryPermission: (options?: {
        mode?: 'read' | 'readwrite'
      }) => Promise<PermissionState>
      requestPermission: (options?: {
        mode?: 'read' | 'readwrite'
      }) => Promise<PermissionState>
    }
    await expect(directory.queryPermission({ mode: 'read' })).resolves.toBe(
      'granted',
    )
    await expect(directory.requestPermission({ mode: 'read' })).resolves.toBe(
      'granted',
    )
  })
})

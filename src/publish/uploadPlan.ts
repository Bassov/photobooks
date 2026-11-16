import type { SiteFile } from '../site/export/types'
import { sha256Hex } from './r2Sign'

/** One local site file by object key and content hash (lowercase hex SHA-256). */
export interface PublishFile {
  key: string
  sha256: string
}

/** Remote manifest of the last publish: object key → SHA-256. */
export type RemoteManifest = Readonly<Record<string, string>>

export type UploadStep =
  { op: 'put'; key: string; sha256: string } | { op: 'delete'; key: string }

type FileKind = 'asset' | 'json' | 'html'

/** Upload order: pages go up only after everything they reference. */
export const KIND_ORDER: readonly FileKind[] = ['asset', 'json', 'html']

export function fileKind(key: string): FileKind {
  if (key.endsWith('.html')) return 'html'
  if (key.endsWith('.json')) return 'json'
  return 'asset'
}

/**
 * Ordered upload: new or changed keys — assets, then JSON, then HTML — then
 * deletes of keys only the remote has; code-unit key order within each group.
 * Unchanged keys are skipped.
 */
export function planUpload(
  local: readonly PublishFile[],
  remote: RemoteManifest,
): UploadStep[] {
  const changed = new Map(
    local
      // An inherited name (`toString`) reads a function, never a hash: it is put.
      .filter((file) => remote[file.key] !== file.sha256)
      .map((file) => [file.key, file.sha256]),
  )
  const keys = [...changed.keys()].sort()
  const puts = KIND_ORDER.flatMap((kind) =>
    keys
      .filter((key) => fileKind(key) === kind)
      .map((key): UploadStep => ({
        op: 'put',
        key,
        // Every key comes from `changed`, so the fallback never applies.
        sha256: changed.get(key) ?? '',
      })),
  )
  const localKeys = new Set(local.map((file) => file.key))
  const deletes = Object.keys(remote)
    .filter((key) => !localKeys.has(key))
    .sort()
    .map((key): UploadStep => ({ op: 'delete', key }))
  return [...puts, ...deletes]
}

/** Object keys and content hashes of an exported site tree's files. */
export async function hashSiteFiles(
  files: readonly SiteFile[],
): Promise<PublishFile[]> {
  return Promise.all(
    files.map(async (file) => ({
      key: file.path,
      sha256: await sha256Hex(file.bytes),
    })),
  )
}

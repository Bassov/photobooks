import type { ImportErrorReason, ImportFileError } from '../photo/assetPool'

const IMPORT_ERROR_REASON_ORDER = [
  'unsupported-type',
  'heic',
  'decode-failed',
] as const satisfies readonly ImportErrorReason[]

export interface ImportErrorGroup {
  reason: ImportErrorReason
  label: string
  errors: readonly ImportFileError[]
}

const REASON_TITLE: Record<ImportErrorReason, string> = {
  'unsupported-type': 'Unsupported format',
  heic: 'HEIC not supported',
  'decode-failed': "Couldn't decode",
}

function importErrorGroupHeading(
  reason: ImportErrorReason,
  count: number,
  names: readonly string[],
): string {
  return `${REASON_TITLE[reason]} (${String(count)}): ${names.join(', ')}`
}

/** Group once per store mutation — stable reason order, skip empty groups. */
export function groupImportErrorsByReason(
  errors: readonly ImportFileError[],
): readonly ImportErrorGroup[] {
  const buckets: Record<ImportErrorReason, ImportFileError[]> = {
    'unsupported-type': [],
    heic: [],
    'decode-failed': [],
  }
  for (const error of errors) {
    buckets[error.reason].push(error)
  }
  const groups: ImportErrorGroup[] = []
  for (const reason of IMPORT_ERROR_REASON_ORDER) {
    const list = buckets[reason]
    if (list.length === 0) {
      continue
    }
    groups.push({
      reason,
      label: importErrorGroupHeading(
        reason,
        list.length,
        list.map((entry) => entry.name),
      ),
      errors: list,
    })
  }
  return groups
}

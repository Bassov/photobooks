import {
  createImportFileError,
  type ImportErrorReason,
  type ImportFileError,
} from '../photo/assetPool'

let seq = 0

/** Deterministic ids for unit tests (avoids crypto.randomUUID flakiness). */
export function makeImportFileError(input: {
  name: string
  message: string
  reason: ImportErrorReason
  assetId?: string
  id?: string
}): ImportFileError {
  seq += 1
  const base = createImportFileError(input)
  return {
    ...base,
    id: input.id ?? `err-${String(seq)}`,
  }
}

export function resetImportFileErrorTestIds(): void {
  seq = 0
}

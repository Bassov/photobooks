import type { ImportFileError } from '../photo/assetPool'

export function importErrorsStatusText(
  errors: readonly ImportFileError[],
): string {
  return errors.map((error) => `${error.name}: ${error.message}`).join('; ')
}

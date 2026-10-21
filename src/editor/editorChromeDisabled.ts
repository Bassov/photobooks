export function isChromeBusy(
  pickerBusy: boolean,
  actionBusy: boolean,
  restorePending: boolean,
): boolean {
  return pickerBusy || actionBusy || restorePending
}

export function isRenameDisabled(
  chromeBusy: boolean,
  libraryReady: boolean,
  writeBlocked: boolean,
  activeBookId: string | null,
): boolean {
  return chromeBusy || !libraryReady || writeBlocked || activeBookId === null
}

export function isNewBookDisabled(
  chromeBusy: boolean,
  libraryReady: boolean,
): boolean {
  return chromeBusy || !libraryReady
}

export function isSaveDisabled(
  pickerBusy: boolean,
  libraryReady: boolean,
  saving: boolean,
  writeBlocked: boolean,
): boolean {
  return pickerBusy || !libraryReady || saving || writeBlocked
}

export function isImportDisabled(
  pickerBusy: boolean,
  writeBlocked: boolean,
): boolean {
  return pickerBusy || writeBlocked
}

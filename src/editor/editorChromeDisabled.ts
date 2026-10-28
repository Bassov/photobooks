export function isChromeBusy(
  pickerBusy: boolean,
  actionBusy: boolean,
  restorePending: boolean,
): boolean {
  return pickerBusy || actionBusy || restorePending
}

export function isImportDisabled(
  pickerBusy: boolean,
  writeBlocked: boolean,
): boolean {
  return pickerBusy || writeBlocked
}

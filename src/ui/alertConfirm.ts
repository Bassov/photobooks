/** Map AlertDialog tone to Button variant (destructive filled only for confirm). */
export function alertConfirmVariant(
  tone: 'destructive' | 'neutral',
): 'destructive' | 'default' {
  return tone === 'destructive' ? 'destructive' : 'default'
}

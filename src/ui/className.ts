/** Join BEM-ish class tokens; omit empty / undefined entries. */
export function cx(...parts: (string | undefined | false)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(' ')
}

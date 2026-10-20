/** Dev/test-only design-token specimen (`?specimen`), same pattern as `?fixture=painter`. */
export function isSpecimenQuery(search = window.location.search): boolean {
  return new URLSearchParams(search).has('specimen')
}

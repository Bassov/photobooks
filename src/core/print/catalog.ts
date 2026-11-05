// Zod-free like `genericProfile.ts`: `printProfile.ts` reaches the site bundle.
import { genericPrintProfile } from './genericProfile'
import type { PrintProfile } from './profileSchema'

/** A print shop's product, every number taken from the vendor's own page. */
export interface PrintShopProfile extends PrintProfile {
  /** The vendor spec page or template the numbers come from. */
  source: string
  /** ISO date (`YYYY-MM-DD`) the numbers were last checked against `source`. */
  checked: string
}

/**
 * Shop profiles, A→Z by name. Spec D8: a vendor whose trim range, bleed, safe
 * margin and page count cannot all be confirmed on its own pages is left out,
 * so none is listed until then (Lulu, Blurb, Saal Digital, CEWE pending).
 */
export function printShopProfiles(): readonly PrintShopProfile[] {
  return []
}

/** Built-in profiles in catalog order: Generic, then the shops A→Z. */
export function builtInPrintProfiles(): readonly PrintProfile[] {
  return [genericPrintProfile(), ...printShopProfiles()]
}

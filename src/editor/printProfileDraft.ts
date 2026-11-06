import {
  builtInPrintProfiles,
  editableProfileIssues,
  parsePrintProfile,
  type EditableProfileField,
  type PrintProfile,
} from '../core'

/**
 * Designer spec printer-presets §Profile editor: the fields the product uses
 * today (D2); the rest keep the values of the profile it was based on.
 */
export const DRAFT_NUMBERS = [
  'trimMin',
  'trimMax',
  'bleed',
  'safe',
  'pMin',
  'pMax',
  'pStep',
  'spineBase',
  'spinePer',
  'wrap',
  'hinge',
  'dpiWarn',
  'dpiMin',
] as const

export type DraftNumber = (typeof DRAFT_NUMBERS)[number]
export type DraftKey = 'name' | DraftNumber
export type ProfileDraft = { name: string } & Record<DraftNumber, string>
export type DraftIssues = Partial<Record<DraftKey, string>>

/** May be 0; every other number must be above 0. */
const ZERO_OK: ReadonlySet<DraftKey> = new Set([
  'bleed',
  'safe',
  'spineBase',
  'wrap',
  'hinge',
])
const WHOLE: ReadonlySet<DraftKey> = new Set(['pMin', 'pMax', 'pStep'])
const SPINE: ReadonlySet<DraftKey> = new Set(['spineBase', 'spinePer'])

const ABOVE_ZERO = 'Enter a number above 0.'

/** Core editor rule field → the draft field that shows its message. */
const FIELD_KEYS: Record<EditableProfileField, DraftKey> = {
  name: 'name',
  trimMinMm: 'trimMin',
  trimMaxMm: 'trimMax',
  'pageCount.min': 'pMin',
  'pageCount.max': 'pMax',
  'pageCount.step': 'pStep',
  'spine.perPageMm': 'spinePer',
  'dpi.warn': 'dpiWarn',
  'dpi.min': 'dpiMin',
}

/** Inputs a core rule reads: it speaks only when they are all numbers. */
const RULE_INPUTS: Partial<Record<DraftKey, readonly DraftKey[]>> = {
  trimMax: ['trimMin', 'trimMax'],
  pMax: ['pMin', 'pMax', 'pStep'],
  pStep: ['pStep'],
  dpiMin: ['dpiWarn', 'dpiMin'],
}

/** Fields show stored values as is (up to 3 decimals: 3.175, 12.7). */
function exact(n: number): string {
  return String(Number(n.toFixed(3)))
}

function num(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text)
}

export function isTableSpine(profile: PrintProfile): boolean {
  return profile.spine.width.kind === 'table'
}

/** Spec D3: one bleed; a built-in range shows the 3 mm default inside it. */
export function draftBleed(profile: PrintProfile): number {
  return Math.min(Math.max(3, profile.bleedMinMm), profile.bleedMaxMm)
}

export function toDraft(profile: PrintProfile): ProfileDraft {
  const width = profile.spine.width
  const spine = width.kind === 'formula' ? width : { baseMm: 0, perPageMm: 0 }
  const values: Record<DraftNumber, number> = {
    trimMin: profile.trimMinMm,
    trimMax: profile.trimMaxMm,
    bleed: draftBleed(profile),
    safe: profile.safeMarginMm,
    pMin: profile.pageCount.min,
    pMax: profile.pageCount.max,
    pStep: profile.pageCount.step,
    spineBase: spine.baseMm,
    spinePer: spine.perPageMm,
    wrap: profile.coverWrapMm,
    hinge: profile.coverHingeMm,
    dpiWarn: profile.dpi.warn,
    dpiMin: profile.dpi.min,
  }
  const draft = { name: profile.name } as ProfileDraft
  for (const key of DRAFT_NUMBERS) {
    draft[key] = exact(values[key])
  }
  return draft
}

/** `base` with the draft's values (a table spine stays the base's). */
export function fromDraft(
  base: PrintProfile,
  draft: ProfileDraft,
): PrintProfile {
  const v = (key: DraftNumber) => num(draft[key])
  return {
    ...base,
    name: draft.name.trim(),
    trimMinMm: v('trimMin'),
    trimMaxMm: v('trimMax'),
    bleedMinMm: v('bleed'),
    bleedMaxMm: v('bleed'),
    safeMarginMm: v('safe'),
    pageCount: { min: v('pMin'), step: v('pStep'), max: v('pMax') },
    spine: {
      ...base.spine,
      width: isTableSpine(base)
        ? base.spine.width
        : { kind: 'formula', baseMm: v('spineBase'), perPageMm: v('spinePer') },
    },
    coverWrapMm: v('wrap'),
    coverHingeMm: v('hinge'),
    dpi: { warn: v('dpiWarn'), min: v('dpiMin') },
  }
}

function numberIssue(key: DraftNumber, text: string): string | undefined {
  const value = num(text)
  const bad =
    !Number.isFinite(value) ||
    value < 0 ||
    (value === 0 && !ZERO_OK.has(key)) ||
    (WHOLE.has(key) && !Number.isInteger(value))
  return bad ? ABOVE_ZERO : undefined
}

/**
 * Editor messages by field (spec §Profile editor), one per field: the number
 * rules first, then core `editableProfileIssues` on the rest.
 */
export function draftIssues(
  base: PrintProfile,
  draft: ProfileDraft,
): DraftIssues {
  const table = isTableSpine(base)
  const issues: DraftIssues = {}
  for (const key of DRAFT_NUMBERS) {
    const message =
      table && SPINE.has(key) ? undefined : numberIssue(key, draft[key])
    if (message !== undefined) {
      issues[key] = message
    }
  }
  for (const issue of editableProfileIssues(fromDraft(base, draft))) {
    const key = FIELD_KEYS[issue.field]
    const inputs = RULE_INPUTS[key] ?? [key]
    if (issues[key] === undefined && inputs.every((k) => !issues[k])) {
      issues[key] = issue.message
    }
  }
  return issues
}

/** Save is on when no field has a message and the profile parses. */
export function savableProfile(
  base: PrintProfile,
  draft: ProfileDraft,
): PrintProfile | undefined {
  if (Object.keys(draftIssues(base, draft)).length > 0) {
    return undefined
  }
  const parsed = parsePrintProfile(fromDraft(base, draft))
  return parsed.ok ? parsed.profile : undefined
}

export interface ProfileOption {
  value: string
  label: string
  group: string
}

/**
 * Printer / default selects: "Print shops" (built-ins) then "Custom"; a
 * book's profile that is only a snapshot joins Custom so the select shows it.
 */
export function printProfileOptions(
  customs: readonly PrintProfile[],
  snapshot?: PrintProfile,
): ProfileOption[] {
  const listed = [...customs]
  if (
    snapshot !== undefined &&
    !builtInPrintProfiles().some((p) => p.id === snapshot.id) &&
    !listed.some((p) => p.id === snapshot.id)
  ) {
    listed.push(snapshot)
  }
  return [
    ...builtInPrintProfiles().map((p) => ({
      value: p.id,
      label: p.name,
      group: 'Print shops',
    })),
    ...listed.map((p) => ({ value: p.id, label: p.name, group: 'Custom' })),
  ]
}

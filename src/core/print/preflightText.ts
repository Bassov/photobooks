// Zod-free: the Print dialog's Check rows (Designer Spec pdf-export §2.1).
import type { ColorWarning } from '../pdf/colorPreflight'
import {
  PREFLIGHT_RULE_IDS,
  PREFLIGHT_SEVERITIES,
  preflightRules,
  type PreflightIssue,
  type PreflightRuleId,
  type PreflightSeverity,
} from './preflight'
import type { PrintProfile } from './profileSchema'
import { fmtN } from './profileText'

/** A preflight rule, or the photo colour space check (`colorWarnings`). */
export type PreflightRowId = PreflightRuleId | 'color-space'

/** One placed photo in another RGB space than the profile's. */
export interface PreflightColorIssue {
  family: ColorWarning['family']
  /** Pages the photo prints on (`photoPages`). */
  pages: readonly number[]
}

export interface PreflightRow {
  id: PreflightRowId
  severity: PreflightSeverity
  /** Input issues grouped in this row. */
  count: number
  text: string
  /** Ascending, unique. */
  pages: number[]
  /** Muted suffix after the text: ` · page 6`, ` · pages 1, 2, 3, 4, 5 +2` or empty. */
  pageList: string
}

export interface PreflightRowsInput {
  issues: readonly PreflightIssue[]
  colors: readonly PreflightColorIssue[]
  profile: Pick<PrintProfile, 'name' | 'safeMarginMm' | 'colorSpace'>
}

/** The colour row sits after `dpi-below-warn`. */
const ROW_ORDER: readonly PreflightRowId[] = PREFLIGHT_RULE_IDS.flatMap(
  (id): PreflightRowId[] =>
    id === 'dpi-below-warn' ? [id, 'color-space'] : [id],
)

/** Page numbers shown before ` +n`. */
const PAGE_LIST_MAX = 5

const FAMILY_LABEL: Readonly<Record<ColorWarning['family'], string>> = {
  srgb: 'sRGB',
  'adobe-rgb': 'Adobe RGB',
  'display-p3': 'Display P3',
  'other-rgb': 'other RGB',
}

const FAMILY_ORDER = Object.keys(FAMILY_LABEL)

const SPACE_LABEL: Readonly<Record<PrintProfile['colorSpace'], string>> = {
  srgb: 'sRGB',
}

/** ` · page 6` / ` · pages 2, 3, 6` / ` · pages 1, 2, 3, 4, 5 +3`; empty without pages. */
export function pageList(pages: readonly number[]): string {
  if (pages.length === 0) return ''
  const shown = pages.slice(0, PAGE_LIST_MAX).join(', ')
  const rest = pages.length - PAGE_LIST_MAX
  return ` · ${pages.length === 1 ? 'page' : 'pages'} ${shown}${rest > 0 ? ` +${String(rest)}` : ''}`
}

/**
 * Check rows: one per rule with issues (and one colour row), errors first,
 * then warnings and info, each in `PREFLIGHT_RULE_IDS` order.
 */
export function preflightRows(input: PreflightRowsInput): PreflightRow[] {
  const groups = new Map<PreflightRuleId, PreflightIssue[]>()
  for (const issue of input.issues) {
    groups.set(issue.rule, [...(groups.get(issue.rule) ?? []), issue])
  }
  const rows = [...groups].map(([rule, issues]) =>
    row(
      rule,
      preflightRules()[rule].severity,
      issues.length,
      ruleText(rule, issues, input.profile),
      issues.flatMap(({ location }) =>
        location.page === undefined ? [] : [location.page],
      ),
    ),
  )
  if (input.colors.length > 0) {
    rows.push(
      row(
        'color-space',
        'warning',
        input.colors.length,
        colorText(input.colors, input.profile),
        input.colors.flatMap(({ pages }) => pages),
      ),
    )
  }
  return rows.sort(
    (a, b) =>
      PREFLIGHT_SEVERITIES.indexOf(a.severity) -
        PREFLIGHT_SEVERITIES.indexOf(b.severity) ||
      ROW_ORDER.indexOf(a.id) - ROW_ORDER.indexOf(b.id),
  )
}

function row(
  id: PreflightRowId,
  severity: PreflightSeverity,
  count: number,
  text: string,
  pages: readonly number[],
): PreflightRow {
  const unique = [...new Set(pages)].sort((a, b) => a - b)
  return {
    id,
    severity,
    count,
    text,
    pages: unique,
    pageList: pageList(unique),
  }
}

/** `1 photo` / `2 photos`. */
function counted(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`
}

function ruleText(
  rule: PreflightRuleId,
  issues: readonly PreflightIssue[],
  profile: PreflightRowsInput['profile'],
): string {
  const n = issues.length
  const first = issues[0]
  const measured = String(first?.measured)
  const threshold = String(first?.threshold)
  switch (rule) {
    case 'page-count-below-min':
      return `${profile.name} prints at least ${threshold} pages. This book has ${measured}.`
    case 'page-count-above-max':
      return `${profile.name} prints up to ${threshold} pages. This book has ${measured}.`
    case 'page-count-step':
      return `${profile.name} prints pages in steps of ${threshold}. This book has ${measured}.`
    case 'asset-missing':
      return `${counted(n, 'photo')} can’t be found`
    case 'asset-modified':
      return `${counted(n, 'photo')} changed on disk since ${n === 1 ? 'it was' : 'they were'} added`
    case 'dpi-below-min':
    case 'dpi-below-warn':
      return `${counted(n, 'photo')} below ${threshold} ppi`
    case 'empty-image-frame':
      return `${String(n)} empty photo ${n === 1 ? 'frame' : 'frames'}`
    case 'empty-text-frame':
      return `${String(n)} empty text ${n === 1 ? 'frame' : 'frames'}`
    case 'safe-zone-intrusion':
      return `${counted(n, 'frame')} ${n === 1 ? 'crosses' : 'cross'} the ${fmtN(profile.safeMarginMm)} mm safe margin`
    case 'bleed-hazard':
      return `${counted(n, 'photo')} ${n === 1 ? 'stops' : 'stop'} short of the bleed`
  }
}

function colorText(
  colors: readonly PreflightColorIssue[],
  profile: PreflightRowsInput['profile'],
): string {
  const n = colors.length
  const families = [...new Set(colors.map(({ family }) => family))]
    .sort((a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b))
    .map((family) => FAMILY_LABEL[family])
    .join(', ')
  return `${counted(n, 'photo')} ${n === 1 ? 'isn’t' : 'aren’t'} ${SPACE_LABEL[profile.colorSpace]} (${families}), colours may shift`
}

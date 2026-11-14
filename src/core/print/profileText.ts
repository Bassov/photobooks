// Zod-free: Settings and Book settings texts of a print profile.
import type { PrintProfileIssue } from '../printProfile'
import type { PrintProfile } from './profileSchema'

/** Kit number format: at most one decimal, no trailing zero. */
export function fmtN(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

function cm(mm: number): string {
  return fmtN(mm / 10)
}

function trimRange(profile: PrintProfile): string {
  return `${cm(profile.trimMinMm)}–${cm(profile.trimMaxMm)} cm`
}

function pagesRange(profile: PrintProfile): string {
  const { min, max } = profile.pageCount
  return `${String(min)}–${String(max)} pages`
}

function photos(profile: PrintProfile): string {
  return `photos ≥ ${String(profile.dpi.warn)} ppi`
}

function mmRange(min: number, max: number): string {
  return min === max ? `${fmtN(min)} mm` : `${fmtN(min)}–${fmtN(max)} mm`
}

/** Settings → Print presets row summary. */
export function profileSummary(profile: PrintProfile): string {
  return [
    trimRange(profile),
    `bleed ${mmRange(profile.bleedMinMm, profile.bleedMaxMm)}`,
    `safe ${fmtN(profile.safeMarginMm)} mm`,
    pagesRange(profile),
    photos(profile),
  ].join(' · ')
}

/** Book settings → PRINT hint under the Printer select. */
export function profileHint(profile: PrintProfile): string {
  return [trimRange(profile), pagesRange(profile), photos(profile)].join(' · ')
}

/** Book settings → PRINT warning line of `issue` on the profile `name`. */
export function printIssueText(issue: PrintProfileIssue, name: string): string {
  switch (issue.code) {
    case 'unknown-profile':
      return 'This book’s printer isn’t in this library. Using Generic.'
    case 'pages-below-min':
      return `${name} prints at least ${String(issue.min)} pages; this book’s ${String(issue.pages)} print as ${String(issue.min)}.`
    case 'pages-above-max':
      return `${name} prints up to ${String(issue.max)} pages. This book has ${String(issue.pages)}.`
    case 'out-of-range': {
      if (issue.field === 'bleed') {
        return `${name} takes ${mmRange(issue.minMm, issue.maxMm)} bleed. This book has ${fmtN(issue.valueMm)} mm.`
      }
      const limit =
        issue.valueMm < issue.minMm
          ? `from ${cm(issue.minMm)} cm`
          : `up to ${cm(issue.maxMm)} cm`
      const side = issue.field === 'trim-width' ? 'wide' : 'high'
      return `${name} takes pages ${limit}. This page is ${cm(issue.valueMm)} cm ${side}.`
    }
  }
}

export type EditableProfileField =
  | 'name'
  | 'trimMinMm'
  | 'trimMaxMm'
  | 'pageCount.min'
  | 'pageCount.max'
  | 'pageCount.step'
  | 'spine.perPageMm'
  | 'dpi.warn'
  | 'dpi.min'

export interface EditableProfileIssue {
  field: EditableProfileField
  message: string
}

const ABOVE_ZERO = 'Enter a number above 0.'

function positiveIssues(profile: PrintProfile): EditableProfileIssue[] {
  const { width } = profile.spine
  const values: [EditableProfileField, number][] = [
    ['trimMinMm', profile.trimMinMm],
    ['trimMaxMm', profile.trimMaxMm],
    ['pageCount.min', profile.pageCount.min],
    ['pageCount.max', profile.pageCount.max],
    ['pageCount.step', profile.pageCount.step],
    ...(width.kind === 'formula'
      ? [['spine.perPageMm', width.perPageMm] as [EditableProfileField, number]]
      : []),
    ['dpi.warn', profile.dpi.warn],
    ['dpi.min', profile.dpi.min],
  ]
  return values
    .filter(([, value]) => !(value > 0))
    .map(([field]) => ({ field, message: ABOVE_ZERO }))
}

function pageCountIssues(profile: PrintProfile): EditableProfileIssue[] {
  const { min, max, step } = profile.pageCount
  if (!(step > 0)) {
    return []
  }
  const issues: EditableProfileIssue[] = []
  if (step % 2 !== 0) {
    issues.push({
      field: 'pageCount.step',
      message: 'Pages come in spreads: the step must be even.',
    })
  }
  if (max < min || (max - min) % step !== 0) {
    const below = min + Math.max(0, Math.floor((max - min) / step)) * step
    issues.push({
      field: 'pageCount.max',
      message: `${String(min)} to ${String(max)} isn’t whole steps of ${String(step)}. Try ${String(below)} or ${String(below + step)}.`,
    })
  }
  return issues
}

/**
 * Profile editor messages by field (Spec "Profile editor dialog"), at most one
 * per rule; the dialog also runs `parsePrintProfile`. Empty → Save is enabled.
 */
export function editableProfileIssues(
  profile: PrintProfile,
): EditableProfileIssue[] {
  const issues: EditableProfileIssue[] = []
  if (profile.name.trim() === '') {
    issues.push({ field: 'name', message: 'Give the profile a name.' })
  }
  issues.push(...positiveIssues(profile))
  if (profile.trimMaxMm > 0 && profile.trimMaxMm < profile.trimMinMm) {
    issues.push({
      field: 'trimMaxMm',
      message: 'The largest side can’t be smaller than the smallest.',
    })
  }
  issues.push(...pageCountIssues(profile))
  if (profile.dpi.min > 0 && profile.dpi.min > profile.dpi.warn) {
    issues.push({
      field: 'dpi.min',
      message: 'Minimum can’t be above Warn under.',
    })
  }
  return issues
}

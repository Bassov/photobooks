import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

/**
 * Allowlisted axe violation ids (ruleId + optional target CSS path).
 * May only shrink; each entry needs a reason. Empty = every violation fails.
 */
export const AXE_ALLOWLIST: readonly {
  id: string
  target?: string
  reason: string
}[] = []

interface AxeViolation {
  id: string
  impact: string | null
  description: string
  help: string
  helpUrl: string
  nodes: { target: string[]; failureSummary?: string }[]
}

interface AxeResults {
  violations: AxeViolation[]
}

interface AxeWindow extends Window {
  axe?: {
    run: (
      context?: unknown,
      options?: Record<string, unknown>,
    ) => Promise<AxeResults>
  }
}

let axeSource: string | undefined

/** Resolve axe-core shipped under @lhci/cli (no new package.json dependency). */
export function resolveAxeCorePath(): string {
  const require = createRequire(import.meta.url)
  const fromLhci = createRequire(require.resolve('@lhci/cli/package.json'))
  return fromLhci.resolve('axe-core')
}

function loadAxeSource(): string {
  axeSource ??= readFileSync(resolveAxeCorePath(), 'utf8')
  return axeSource
}

/** Format violations for assertion messages / CI logs. */
export function formatAxeViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return ''
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => {
          const target = n.target.join(' ')
          const summary = n.failureSummary?.replaceAll('\n', ' ') ?? ''
          return `  - ${target}${summary ? `: ${summary}` : ''}`
        })
        .join('\n')
      return `[${v.id}] ${v.help} (${v.impact ?? 'n/a'})\n${nodes}`
    })
    .join('\n')
}

function isAllowlisted(violation: AxeViolation): boolean {
  return AXE_ALLOWLIST.some((entry) => {
    if (entry.id !== violation.id) return false
    const target = entry.target
    if (target === undefined) return true
    return violation.nodes.some((n) => n.target.join(' ').includes(target))
  })
}

/**
 * Inject axe-core and assert color-contrast AA + name/role rules pass.
 * Any non-allowlisted violation fails the calling test.
 */
export async function expectNoAxeViolations(
  page: Page,
  label: string,
): Promise<void> {
  await page.addScriptTag({ content: loadAxeSource() })

  const results = await page.evaluate(async () => {
    const axe = (window as AxeWindow).axe
    if (!axe) throw new Error('axe-core failed to load')
    // WCAG 2 AA color-contrast (not AAA enhanced) + name/role category.
    return axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['cat.name-role-value', 'wcag2aa'],
      },
      rules: {
        'color-contrast-enhanced': { enabled: false },
      },
    })
  })

  const blocking = results.violations.filter((v) => !isAllowlisted(v))
  expect(
    blocking,
    `axe violations on ${label}:\n${formatAxeViolations(blocking)}`,
  ).toEqual([])
}

#!/usr/bin/env node
import { readFileSync, existsSync, appendFileSync } from 'node:fs'

const reportPath = process.argv[2] ?? 'reports/mutation/mutation.json'

if (!existsSync(reportPath)) {
  console.error(`No mutation report at ${reportPath}`)
  process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const files = report.files ?? {}
let killed = 0
let survived = 0
let timeout = 0
let noCoverage = 0
let ignored = 0
let other = 0
const survivedSamples = []

for (const [filePath, file] of Object.entries(files)) {
  for (const mutant of file.mutants ?? []) {
    switch (mutant.status) {
      case 'Killed':
        killed += 1
        break
      case 'Survived':
        survived += 1
        if (survivedSamples.length < 8) {
          survivedSamples.push(
            `- \`${filePath}:${mutant.location?.start?.line ?? '?'}\` ${mutant.mutatorName ?? mutant.id}`,
          )
        }
        break
      case 'Timeout':
      case 'TimedOut':
        timeout += 1
        break
      case 'NoCoverage':
        noCoverage += 1
        break
      case 'Ignored':
        ignored += 1
        break
      default:
        other += 1
    }
  }
}

const detected = killed + timeout
const scoreValid = detected + survived + noCoverage
const score =
  scoreValid === 0 ? 100 : Math.round((detected / scoreValid) * 1000) / 10

const lines = [
  '## Mutation testing',
  '',
  `| Metric | Value |`,
  `| --- | --- |`,
  `| Score | **${score}%** |`,
  `| Killed | ${killed} |`,
  `| Survived | ${survived} |`,
  `| Timed out | ${timeout} |`,
  `| No coverage | ${noCoverage} |`,
  `| Ignored | ${ignored} |`,
  '',
]

if (survivedSamples.length > 0) {
  lines.push('### Sample survived mutants', '', ...survivedSamples, '')
}

lines.push(
  '_Full HTML report is attached as the workflow artifact `stryker-report`._',
  '',
)

const markdown = lines.join('\n')
process.stdout.write(markdown)

const summaryPath = process.env.GITHUB_STEP_SUMMARY
if (summaryPath) {
  appendFileSync(summaryPath, markdown)
}

/** Dev-only derivative lab page: one lab worker, fixtures in order. */
import {
  labTable,
  passes,
  pickPresets,
  type LabPick,
  type LabResult,
} from './candidates'
import { LAB_FIXTURES, type LabFixture } from './fixtures'
import type { LabRequest, LabResponse, LabVariant } from './runLab'

/** The slice of `Worker` the page uses. */
export interface LabPort {
  onmessage: ((event: MessageEvent<LabResponse>) => void) | null
  postMessage(message: LabRequest): void
}

function ask(port: LabPort, fixture: LabFixture): Promise<LabResponse> {
  return new Promise((resolve) => {
    port.onmessage = (event) => {
      resolve(event.data)
    }
    port.postMessage({ fixture })
  })
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text = '',
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  node.textContent = text
  return node
}

function caption(variant: LabResult): string {
  const kb = (variant.byteLength / 1024).toFixed(1)
  const verdict = passes(variant) ? 'pass' : 'fail'
  return `${variant.preset.id} · ${kb} KB · SSIM ${variant.ssim.toFixed(4)} · step ${variant.bandStep.toFixed(2)} · ${verdict}`
}

function fixtureSection(
  doc: Document,
  fixture: LabFixture,
  variants: readonly LabVariant[],
  objectUrl: (blob: Blob) => string,
): HTMLElement {
  const section = element(doc, 'section')
  section.dataset.fixture = fixture
  section.append(element(doc, 'h2', fixture))
  const grid = element(doc, 'div')
  grid.className = 'lab-grid'
  for (const variant of variants) {
    const figure = element(doc, 'figure')
    figure.dataset.testid = 'lab-variant'
    figure.dataset.preset = variant.preset.id
    const img = element(doc, 'img')
    img.alt = `${fixture} ${variant.preset.id}`
    img.src = objectUrl(new Blob([variant.bytes], { type: variant.mimeType }))
    figure.append(img, element(doc, 'figcaption', caption(variant)))
    grid.append(figure)
  }
  section.append(grid)
  return section
}

function pickLine(pick: LabPick): string {
  const format = pick.mimeType === 'image/jpeg' ? 'jpeg' : 'webp'
  const head = `${String(pick.maxEdge)} ${format}`
  if (!pick.preset) {
    return `${head}: no candidate passes`
  }
  const kb = (pick.byteLength / 1024).toFixed(1)
  return `${head}: q${pick.preset.quality.toFixed(2)} (${kb} KB over all fixtures)`
}

/**
 * Runs every fixture through `port`, rendering each section as it lands,
 * then the picks and the markdown table; `root.dataset.labState` ends as
 * `done` or `error`.
 */
export async function startLab(
  root: HTMLElement,
  port: LabPort,
  objectUrl: (blob: Blob) => string,
): Promise<void> {
  const doc = root.ownerDocument
  const status = element(doc, 'p')
  status.dataset.testid = 'lab-status'
  root.append(status)
  root.dataset.labState = 'running'
  const results: LabResult[] = []
  for (const fixture of LAB_FIXTURES) {
    status.textContent = `Encoding ${fixture}…`
    const response = await ask(port, fixture)
    if (!response.ok) {
      status.textContent = `${fixture} failed: ${response.error}`
      root.dataset.labState = 'error'
      return
    }
    root.append(fixtureSection(doc, fixture, response.variants, objectUrl))
    results.push(...response.variants)
  }
  status.textContent = `${String(results.length)} variants`
  const picks = element(doc, 'ul')
  picks.dataset.testid = 'lab-picks'
  for (const pick of pickPresets(results)) {
    picks.append(element(doc, 'li', pickLine(pick)))
  }
  const table = element(doc, 'pre', labTable(results))
  table.dataset.testid = 'lab-table'
  root.append(picks, table)
  root.dataset.labState = 'done'
}

import { describe, expect, it } from 'vitest'
import { loadManualQa, resolveManualQaEntry } from './manual-qa.mjs'

describe('manual-qa wrapper', () => {
  it('resolves the ts-agent-rig manual-qa entry', () => {
    const entry = resolveManualQaEntry()
    expect(entry.replaceAll('\\', '/')).toMatch(
      /@albasov\/ts-agent-rig\/src\/manual-qa\.mjs$/,
    )
  })

  it('loads main from the rig package', async () => {
    const mod = await loadManualQa()
    expect(typeof mod.main).toBe('function')
    expect(typeof mod.runManualQa).toBe('function')
  })
})

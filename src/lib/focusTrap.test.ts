import { afterEach, describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { nextTrapIndex, tabbablesIn, takeFocus, trapTab } from './focusTrap'

function mount(html: string): HTMLElement {
  const root = document.createElement('div')
  root.tabIndex = -1
  root.innerHTML = html
  document.body.append(root)
  return root
}

const activeId = () => (document.activeElement as HTMLElement | null)?.id

describe('nextTrapIndex', () => {
  it('steps forward and back, wrapping at both ends', () => {
    expect(nextTrapIndex(0, 3, false)).toBe(1)
    expect(nextTrapIndex(2, 3, false)).toBe(0)
    expect(nextTrapIndex(0, 3, true)).toBe(2)
    expect(nextTrapIndex(2, 3, true)).toBe(1)
  })

  it('enters at the first (last) from outside and is -1 with nothing', () => {
    expect(nextTrapIndex(-1, 3, false)).toBe(0)
    expect(nextTrapIndex(-1, 3, true)).toBe(2)
    expect(nextTrapIndex(-1, 0, false)).toBe(-1)
    expect(nextTrapIndex(0, 0, true)).toBe(-1)
  })
})

test.prop(
  [
    fc.integer({ min: 1, max: 50 }),
    fc.integer({ min: -1, max: 49 }),
    fc.boolean(),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)(
  'the next index stays in [0, count) and Shift+Tab undoes Tab',
  (count, raw, back) => {
    const current = Math.min(raw, count - 1)
    const next = nextTrapIndex(current, count, back)
    expect(next).toBeGreaterThanOrEqual(0)
    expect(next).toBeLessThan(count)
    if (current >= 0) {
      expect(nextTrapIndex(next, count, !back)).toBe(current)
    }
  },
)

describe('tabbablesIn / trapTab', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lists enabled controls in DOM order and skips inert, disabled and -1 tabindex', () => {
    const root = mount(
      `<a id="a" href="#x"></a><a id="nohref"></a><button id="b"></button>` +
        `<button id="off" disabled></button><input id="i" />` +
        `<select id="s"></select><textarea id="t"></textarea>` +
        `<input id="ioff" disabled /><select id="soff" disabled></select>` +
        `<textarea id="toff" disabled></textarea>` +
        `<div id="d" tabindex="0"></div><div id="neg" tabindex="-1"></div>` +
        `<div inert><button id="hidden"></button></div>`,
    )
    expect(tabbablesIn(root).map((el) => el.id)).toEqual([
      'a',
      'b',
      'i',
      's',
      't',
      'd',
    ])
  })

  it('cycles Tab and Shift+Tab inside the root', () => {
    const root = mount(`<button id="x"></button><button id="y"></button>`)
    root.focus()
    trapTab(root, false)
    expect(activeId()).toBe('x')
    trapTab(root, false)
    expect(activeId()).toBe('y')
    trapTab(root, false)
    expect(activeId()).toBe('x')
    trapTab(root, true)
    expect(activeId()).toBe('y')
  })

  it('keeps focus on the root when it has no tabbables', () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    const root = mount('<span></span>')
    root.id = 'root'
    outside.focus()
    trapTab(root, true)
    expect(activeId()).toBe('root')
  })

  it('does nothing without a root', () => {
    const outside = document.createElement('button')
    outside.id = 'out'
    document.body.append(outside)
    outside.focus()
    trapTab(null, false)
    expect(activeId()).toBe('out')
  })
})

describe('takeFocus', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('focuses the root, then hands focus back to the opener', () => {
    const opener = document.createElement('button')
    opener.id = 'opener'
    document.body.append(opener)
    opener.focus()
    const root = mount('<button id="inside"></button>')
    root.id = 'root'
    const restore = takeFocus(root)
    expect(activeId()).toBe('root')
    trapTab(root, false)
    restore()
    expect(activeId()).toBe('opener')
  })

  it('skips the hand-back when the opener left the document or is not an element', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const root = mount('')
    root.id = 'root'
    const restore = takeFocus(root)
    opener.remove()
    restore()
    expect(activeId()).toBe('root')
  })

  it('leaves focus alone without a root and hands back only to HTML elements', () => {
    const svg = mount('<svg id="svg" tabindex="0"></svg>').querySelector('svg')
    svg?.focus()
    expect(activeId()).toBe('svg')
    const restore = takeFocus(null)
    expect(activeId()).toBe('svg')
    const root = mount('')
    root.id = 'root'
    root.focus()
    restore()
    expect(activeId()).toBe('root')
  })
})

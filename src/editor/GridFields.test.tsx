import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GridField, GridSource, GridValues } from '../core'
import { T } from './editorChromeTokens'
import { GridFields } from './GridFields'

const VALUES: GridValues = {
  columns: 2,
  rows: 2,
  columnGutterMm: 5,
  rowGutterMm: 5,
  top: 15,
  bottom: 15,
  inside: 15,
  outside: 15,
}

const TEST_IDS = { field: 'f', link: 'f-link', reset: 'f-reset' }

function sources(spread: GridField): Record<GridField, GridSource> {
  const all = Object.fromEntries(
    Object.keys(VALUES).map((field) => [field, 'master']),
  ) as Record<GridField, GridSource>
  return { ...all, [spread]: 'spread' }
}

function input(field: GridField) {
  return screen.getByTestId<HTMLInputElement>(`f-${field}`)
}

function box(field: GridField) {
  const parent = input(field).parentElement
  if (parent === null) {
    throw new Error(`no field box for ${field}`)
  }
  return parent
}

describe('GridFields', () => {
  afterEach(cleanup)

  it('without inheritance (master): dark value, no source, description or ↺', () => {
    const onCommit = vi.fn()
    render(
      <GridFields
        values={VALUES}
        linked
        onLinkedChange={vi.fn()}
        onCommit={onCommit}
        testIds={TEST_IDS}
      />,
    )
    expect(input('columns').style.color).toBe(T)
    expect(input('columns').title).toBe('Columns')
    expect(box('columns').querySelector('span')?.title).toBe('Columns')
    expect(input('columns').getAttribute('aria-describedby')).toBeNull()
    expect(box('columns').getAttribute('data-source')).toBeNull()
    // Counts: short label + input; millimetres add the unit. Nothing else.
    expect(box('columns').children).toHaveLength(2)
    expect(box('columnGutterMm').children).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /^Reset / })).toBeNull()
    fireEvent.change(input('rows'), { target: { value: '' } })
    fireEvent.blur(input('rows'))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('counts stop at 12 on ArrowUp; millimetres step by 0.5', () => {
    const onCommit = vi.fn()
    render(
      <GridFields
        values={{ ...VALUES, columns: 12 }}
        linked={false}
        onLinkedChange={vi.fn()}
        onCommit={onCommit}
        testIds={TEST_IDS}
      />,
    )
    fireEvent.keyDown(input('columns'), { key: 'ArrowUp' })
    fireEvent.keyDown(input('rowGutterMm'), { key: 'ArrowUp' })
    expect(onCommit.mock.calls).toEqual([['rowGutterMm', 5.5]])
  })

  it('with inheritance: the value colour comes from data-source; ↺ only on own fields', () => {
    const onReset = vi.fn()
    render(
      <GridFields
        values={VALUES}
        linked={false}
        onLinkedChange={vi.fn()}
        onCommit={vi.fn()}
        testIds={TEST_IDS}
        inheritance={{
          source: sources('top'),
          parentName: 'Master B',
          onReset,
        }}
      />,
    )
    expect(input('top').style.color).toBe('')
    expect(box('top').getAttribute('data-source')).toBe('spread')
    expect(box('rows').getAttribute('data-source')).toBe('master')
    expect(input('rows').title).toBe('Rows · from Master B')
    expect(box('rows').querySelector('span')?.title).toBe(
      'Rows · from Master B',
    )
    // Counts: label, input, description; the own margin adds unit and ↺.
    expect(box('rows').children).toHaveLength(3)
    expect(box('top').children).toHaveLength(5)
    const reset = screen.getByTestId('f-reset-top')
    expect(reset.getAttribute('aria-label')).toBe(
      'Reset Top margin to Master B',
    )
    expect(reset.title).toBe('Reset Top margin to Master B')
    fireEvent.click(reset)
    expect(onReset).toHaveBeenCalledWith('top')
  })
})

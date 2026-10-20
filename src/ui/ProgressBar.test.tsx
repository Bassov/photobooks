import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders determinate progress with a value and fill transform', () => {
    render(
      <ProgressBar label="Import" value={40} minValue={0} maxValue={100} />,
    )
    const bar = screen.getByRole('progressbar', { name: 'Import' })
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.getAttribute('data-indeterminate')).toBeNull()
    expect(bar.className).not.toContain('pb-progress--indeterminate')

    const fill = screen.getByTestId('progress-fill')
    expect(fill.style.transform).toBe('translateX(-60%)')
  })

  it('renders indeterminate progress when value is omitted', () => {
    render(<ProgressBar label="Working" />)
    const bar = screen.getByRole('progressbar', { name: 'Working' })
    expect(bar.getAttribute('data-indeterminate')).toBe('true')
    expect(bar.className).toContain('pb-progress--indeterminate')
    expect(screen.getByTestId('progress-fill').style.transform).toBe('')
  })

  it('honors explicit isIndeterminate even with a value', () => {
    render(<ProgressBar label="Busy" value={80} isIndeterminate />)
    const bar = screen.getByRole('progressbar', { name: 'Busy' })
    expect(bar.getAttribute('data-indeterminate')).toBe('true')
    expect(bar.className).toContain('pb-progress--indeterminate')
  })
})

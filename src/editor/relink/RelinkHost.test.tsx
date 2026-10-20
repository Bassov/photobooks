import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RelinkHost } from './RelinkHost'
import {
  replaceRelinkStatuses,
  resetRelinkStore,
  setRelinkDialogOpen,
} from './statusStore'

vi.mock('./autoDetect', () => ({
  installRelinkAutoDetect: () => () => undefined,
}))

describe('RelinkHost', () => {
  afterEach(() => {
    cleanup()
    resetRelinkStore()
  })

  it('shows the missing pill and opens the dialog from Review', () => {
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    setRelinkDialogOpen(false)
    render(<RelinkHost />)

    expect(screen.getByTestId('missing-assets-pill').textContent).toContain(
      'photos missing',
    )
    fireEvent.click(screen.getByTestId('missing-assets-review'))
    expect(screen.getByTestId('relink-dialog')).toBeTruthy()
  })

  it('hides the pill when there are no problems', () => {
    replaceRelinkStatuses(new Map())
    render(<RelinkHost />)
    expect(screen.queryByTestId('missing-assets-pill')).toBeNull()
  })
})

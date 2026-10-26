import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FeaturedIcon } from './FeaturedIcon'
import { Icon } from './Icon'

describe('FeaturedIcon', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders soft warning theme for status icons', () => {
    const { container } = render(
      <FeaturedIcon theme="soft" color="warning" size="xl">
        <Icon name="shieldOff" />
      </FeaturedIcon>,
    )
    const el = container.firstElementChild
    expect(el?.className).toMatch(/rounded-full/)
    expect(el?.className).toMatch(/bg-warning/)
    expect(container.querySelector('[data-icon="shieldOff"]')).toBeTruthy()
  })

  it('renders light theme with a background tile (not outline muted)', () => {
    const { container } = render(
      <FeaturedIcon theme="light" color="gray">
        <Icon name="folder" />
      </FeaturedIcon>,
    )
    const cls = container.firstElementChild?.className ?? ''
    expect(cls).toMatch(/border/)
    expect(cls).toMatch(/bg-background/)
    expect(cls).not.toMatch(/bg-muted/)
  })

  it('renders outline theme with muted background', () => {
    const { container } = render(
      <FeaturedIcon theme="outline" color="gray">
        <Icon name="folder" />
      </FeaturedIcon>,
    )
    const cls = container.firstElementChild?.className ?? ''
    expect(cls).toMatch(/bg-muted/)
    expect(cls).not.toMatch(/bg-background/)
  })
})

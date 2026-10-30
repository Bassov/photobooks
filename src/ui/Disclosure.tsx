import type { ReactNode } from 'react'
import {
  Button,
  Disclosure as AriaDisclosure,
  DisclosurePanel,
  Heading,
} from 'react-aria-components'
import { Icon } from './Icon'
import './Disclosure.css'

export interface DisclosureProps {
  title: string
  /** Collapsed by default, like the kit's secondary inspector sections. */
  defaultExpanded?: boolean
  'data-testid'?: string
  children: ReactNode
}

/** Kit `components/app/ui.tsx` Section: h-9 eyebrow trigger, leading chevron, panel. */
export function Disclosure({
  title,
  defaultExpanded = false,
  'data-testid': dataTestId,
  children,
}: DisclosureProps) {
  return (
    <AriaDisclosure
      className="pb-disclosure"
      defaultExpanded={defaultExpanded}
      data-testid={dataTestId}
    >
      <Heading className="pb-disclosure__heading">
        <Button slot="trigger" className="pb-disclosure__trigger">
          <Icon name="chevronRight" className="pb-disclosure__chevron" />
          <span className="inspector-eyebrow">{title}</span>
        </Button>
      </Heading>
      <DisclosurePanel>{children}</DisclosurePanel>
    </AriaDisclosure>
  )
}

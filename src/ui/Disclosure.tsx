import { useId, type ReactNode } from 'react'
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
  /** Muted value at the trigger's end, shown only while collapsed. */
  summary?: string | undefined
  /** Muted " · note" right after the title, shown expanded and collapsed. */
  note?: string | undefined
  /** Header action(s) right of the trigger, shown only while expanded. */
  right?: ReactNode
  'data-testid'?: string
  /** Presses inside (trigger included) keep crop mode alive. */
  'data-crop-keep'?: string
  children: ReactNode
}

/** Kit `components/app/ui.tsx` Section: h-9 eyebrow trigger, leading chevron, panel. */
export function Disclosure({
  title,
  defaultExpanded = false,
  summary,
  note,
  right,
  'data-testid': dataTestId,
  'data-crop-keep': cropKeep,
  children,
}: DisclosureProps) {
  const id = useId()
  return (
    <AriaDisclosure
      className="pb-disclosure"
      defaultExpanded={defaultExpanded}
      data-testid={dataTestId}
      data-crop-keep={cropKeep}
    >
      {({ isExpanded }) => {
        const summarized = !isExpanded && summary !== undefined
        const described = [
          ...(note === undefined ? [] : [`${id}-note`]),
          ...(summarized ? [`${id}-summary`] : []),
        ]
        return (
          <>
            <div className="pb-disclosure__header">
              <Heading className="pb-disclosure__heading">
                {/* Named by the title; the summary is its description. */}
                <Button
                  slot="trigger"
                  className="pb-disclosure__trigger"
                  aria-labelledby={`${id}-title`}
                  {...(described.length > 0
                    ? { 'aria-describedby': described.join(' ') }
                    : {})}
                >
                  <Icon
                    name="chevronRight"
                    size={14}
                    className="pb-disclosure__chevron"
                  />
                  <span id={`${id}-title`} className="inspector-eyebrow">
                    {title}
                  </span>
                  {note === undefined ? null : (
                    <span
                      id={`${id}-note`}
                      className="pb-disclosure__note"
                      data-testid={
                        dataTestId === undefined
                          ? undefined
                          : `${dataTestId}-note`
                      }
                    >
                      · {note}
                    </span>
                  )}
                  {summarized ? (
                    <span
                      id={`${id}-summary`}
                      className="pb-disclosure__summary"
                      data-testid={
                        dataTestId === undefined
                          ? undefined
                          : `${dataTestId}-summary`
                      }
                    >
                      {summary}
                    </span>
                  ) : null}
                </Button>
              </Heading>
              {isExpanded ? right : null}
            </div>
            <DisclosurePanel className="pb-disclosure__panel">
              {children}
            </DisclosurePanel>
          </>
        )
      }}
    </AriaDisclosure>
  )
}

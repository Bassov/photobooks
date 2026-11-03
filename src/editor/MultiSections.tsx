import { useSyncExternalStore } from 'react'
import { Toolbar } from 'react-aria-components'
import type { AlignEdge, BookOp, DistributeAxis } from '../core'
import { Disclosure } from '../ui/Disclosure'
import { Icon, type IconProps } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { findSetFrames, type FrameSetTarget } from './frameArrange'
import { DeleteFramesButton, SetArrangeSection } from './FrameSections'
import { alignState, selectionCaption } from './inspectorModel'
import './FrameSections.css'

function readBook() {
  return getBookStoreSnapshot().book
}

type AlignAction =
  | { kind: 'align'; edge: AlignEdge }
  | { kind: 'distribute'; axis: DistributeAxis }

interface AlignButton {
  action: AlignAction
  label: string
  testId: string
  icon: IconProps['name']
}

/** Designer Spec "Inspector, multi context": three groups, kit order. */
const ALIGN_GROUPS: readonly (readonly AlignButton[])[] = [
  [
    {
      action: { kind: 'align', edge: 'left' },
      label: 'Align left edges',
      testId: 'align-left',
      icon: 'alignStartVertical',
    },
    {
      action: { kind: 'align', edge: 'centerX' },
      label: 'Align horizontal centers',
      testId: 'align-center-x',
      icon: 'alignCenterVertical',
    },
    {
      action: { kind: 'align', edge: 'right' },
      label: 'Align right edges',
      testId: 'align-right',
      icon: 'alignEndVertical',
    },
  ],
  [
    {
      action: { kind: 'align', edge: 'top' },
      label: 'Align top edges',
      testId: 'align-top',
      icon: 'alignStartHorizontal',
    },
    {
      action: { kind: 'align', edge: 'centerY' },
      label: 'Align vertical centers',
      testId: 'align-center-y',
      icon: 'alignCenterHorizontal',
    },
    {
      action: { kind: 'align', edge: 'bottom' },
      label: 'Align bottom edges',
      testId: 'align-bottom',
      icon: 'alignEndHorizontal',
    },
  ],
  [
    {
      action: { kind: 'distribute', axis: 'horizontal' },
      label: 'Distribute horizontally',
      testId: 'distribute-h',
      icon: 'alignHorizontalDistributeCenter',
    },
    {
      action: { kind: 'distribute', axis: 'vertical' },
      label: 'Distribute vertically',
      testId: 'distribute-v',
      icon: 'alignVerticalDistributeCenter',
    },
  ],
]

function alignOp(set: FrameSetTarget, action: AlignAction): BookOp {
  return action.kind === 'align'
    ? {
        type: 'alignFrames',
        spreadId: set.spreadId,
        frameIds: set.frameIds,
        edge: action.edge,
      }
    : {
        type: 'distributeFrames',
        spreadId: set.spreadId,
        frameIds: set.frameIds,
        axis: action.axis,
      }
}

/**
 * Kit AlignSection: align / distribute the unlocked frames of the set (core
 * skips locked ones) in one undo step; a button that cannot act stays
 * focusable with its reason.
 */
function AlignSection({ set }: { set: FrameSetTarget }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const frames = findSetFrames(book, set)
  const state = alignState(frames)
  return (
    <section
      className="px-4 pt-0.5 pb-3"
      data-testid="inspector-align"
      aria-label="Align & distribute"
    >
      <Toolbar aria-label="Align" className="frame-align-row">
        {ALIGN_GROUPS.map((group, index) => (
          <div
            // A fixed list: the position is the group's identity.
            key={index}
            role="group"
            className="frame-align-group"
          >
            {group.map(({ action, label, testId, icon }) => {
              const reason =
                action.kind === 'align'
                  ? state.alignReason
                  : state.distributeReason
              return (
                <IconButton
                  key={testId}
                  label={label}
                  size="sm"
                  className="frame-align-button"
                  data-testid={testId}
                  isDisabled={reason !== undefined}
                  disabledReason={reason}
                  onPress={() => {
                    dispatchBookOp(alignOp(set, action))
                  }}
                >
                  <Icon name={icon} size={14} />
                </IconButton>
              )
            })}
          </div>
        ))}
      </Toolbar>
      <p className="frame-align-caption" data-testid="align-caption">
        {selectionCaption(frames)}
      </p>
    </section>
  )
}

/** Kit Multiple selection context body: Align & distribute, Arrange, Delete N frames. */
export function MultiSections({ set }: { set: FrameSetTarget }) {
  return (
    <>
      <Disclosure
        title="Align & distribute"
        defaultExpanded
        data-testid="inspector-align-disclosure"
      >
        <AlignSection set={set} />
      </Disclosure>
      <Disclosure
        title="Arrange"
        defaultExpanded
        data-testid="inspector-arrange-disclosure"
      >
        <SetArrangeSection set={set} />
      </Disclosure>
      <DeleteFramesButton set={set} />
    </>
  )
}

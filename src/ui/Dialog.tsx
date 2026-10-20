import type { ReactNode } from 'react'
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  type DialogProps as AriaDialogProps,
  type ModalOverlayProps,
} from 'react-aria-components'
import { cx } from './className'
import { dialogOverlayProps } from './dialogOverlay'
import './Dialog.css'

export const DialogTrigger = AriaDialogTrigger

export interface DialogProps extends Omit<AriaDialogProps, 'className'> {
  className?: string
  overlayClassName?: string
  isOpen?: boolean
  onOpenChange?: ModalOverlayProps['onOpenChange']
  isDismissable?: boolean
}

/** Modal dialog — overlay + centered panel. */
export function Dialog({
  className,
  overlayClassName,
  isOpen,
  onOpenChange,
  isDismissable = true,
  children,
  ...props
}: DialogProps) {
  return (
    <ModalOverlay
      {...dialogOverlayProps(
        isOpen,
        onOpenChange,
        isDismissable,
        overlayClassName,
      )}
    >
      <Modal className="pb-dialog-modal">
        <AriaDialog {...props} className={cx('pb-dialog', className)}>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <Heading slot="title" className={cx('pb-dialog-title', className)}>
      {children}
    </Heading>
  )
}

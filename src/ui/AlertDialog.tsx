import type { ReactNode } from 'react'
import { alertConfirmVariant } from './alertConfirm'
import { Button } from './Button'
import { Dialog, DialogTitle } from './Dialog'
import { FeaturedIcon } from './FeaturedIcon'
import { Icon } from './Icon'
import { cx } from './className'
import './AlertDialog.css'

export interface AlertDialogProps {
  isOpen?: boolean
  title: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'destructive' | 'neutral'
  /** Leading soft tile (kit AlertDialog `icon`); defaults to the trash. */
  icon?: ReactNode
  onConfirm?: () => void
  onCancel?: () => void
  className?: string
}

/**
 * Non-dismissable confirm dialog. Cancel is ghost + autofocus; confirm uses
 * filled `destructive` only when tone is destructive.
 */
export function AlertDialog({
  isOpen,
  title,
  children,
  confirmLabel = 'Remove',
  cancelLabel = 'Cancel',
  tone = 'destructive',
  icon = <Icon name="delete" size={16} />,
  onConfirm,
  onCancel,
  className,
}: AlertDialogProps) {
  const variant = alertConfirmVariant(tone)
  return (
    <Dialog
      role="alertdialog"
      {...(isOpen === undefined ? {} : { isOpen })}
      isDismissable={false}
      className={cx('pb-alert-dialog', className)}
      data-tone={tone}
    >
      <div className="pb-alert-dialog-head">
        <FeaturedIcon
          theme="soft"
          color={tone === 'destructive' ? 'error' : 'gray'}
          size="md"
        >
          {icon}
        </FeaturedIcon>
        <div className="pb-alert-dialog-text">
          <DialogTitle>{title}</DialogTitle>
          {children ? (
            <div className="pb-alert-dialog-body">{children}</div>
          ) : null}
        </div>
      </div>
      <div className="pb-alert-dialog-actions">
        <Button
          variant="ghost"
          size="md"
          autoFocus
          onPress={() => {
            if (onCancel !== undefined) onCancel()
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          size="md"
          onPress={() => {
            if (onConfirm !== undefined) onConfirm()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}

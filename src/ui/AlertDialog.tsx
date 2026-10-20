import type { ReactNode } from 'react'
import { alertConfirmVariant } from './alertConfirm'
import { Button } from './Button'
import { Dialog, DialogTitle } from './Dialog'
import { cx } from './className'
import './AlertDialog.css'

export interface AlertDialogProps {
  isOpen?: boolean
  title: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'destructive' | 'neutral'
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
      <DialogTitle>{title}</DialogTitle>
      {children ? <div className="pb-alert-dialog-body">{children}</div> : null}
      <div className="pb-alert-dialog-actions">
        <Button
          variant="ghost"
          size="sm"
          autoFocus
          onPress={() => {
            if (onCancel !== undefined) onCancel()
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          size="sm"
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

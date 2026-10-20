import type { ModalOverlayProps } from 'react-aria-components'
import { cx } from './className'

/** Build ModalOverlay props without passing explicit `undefined` optionals. */
export function dialogOverlayProps(
  isOpen: boolean | undefined,
  onOpenChange: ModalOverlayProps['onOpenChange'] | undefined,
  isDismissable: boolean,
  overlayClassName: string | undefined,
): ModalOverlayProps {
  const props: ModalOverlayProps = {
    isDismissable,
    className: cx('pb-dialog-overlay', overlayClassName),
  }
  if (isOpen !== undefined) props.isOpen = isOpen
  if (onOpenChange !== undefined) props.onOpenChange = onOpenChange
  return props
}

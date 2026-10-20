import {
  Button as AriaButton,
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastRegion as AriaToastRegion,
  type ToastRegionProps,
} from 'react-aria-components'
import { cx } from './className'
import { type ToastContent, type ToastTone } from './toastQueue'
import './Toast.css'

export interface ToastRegionPropsPublic extends Omit<
  ToastRegionProps<ToastContent>,
  'children' | 'className'
> {
  className?: string
}

/** Fixed toast stack — mount once near the app root when toasts are used. */
export function ToastRegion({ className, ...props }: ToastRegionPropsPublic) {
  return (
    <AriaToastRegion {...props} className={cx('pb-toast-region', className)}>
      {({ toast }) => {
        const c = toast.content
        const tone: ToastTone = c.tone ?? 'default'
        const action = c.action
        return (
          <AriaToast
            toast={toast}
            className={cx('pb-toast', `pb-toast--${tone}`)}
            data-tone={tone}
          >
            <AriaToastContent className="pb-toast-content">
              <Text slot="title" className="pb-toast-title">
                {c.title}
              </Text>
              {c.description ? (
                <Text slot="description" className="pb-toast-description">
                  {c.description}
                </Text>
              ) : null}
              {action ? (
                <div className="pb-toast-action">
                  <AriaButton
                    className="pb-toast-action-btn"
                    onPress={() => {
                      const run = action.onAction
                      if (run) run()
                    }}
                  >
                    {action.label}
                  </AriaButton>
                </div>
              ) : null}
            </AriaToastContent>
            <AriaButton
              slot="close"
              aria-label="Close"
              className="pb-toast-close"
            >
              ×
            </AriaButton>
          </AriaToast>
        )
      }}
    </AriaToastRegion>
  )
}

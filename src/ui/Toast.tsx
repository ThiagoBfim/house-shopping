import { useEffect } from 'preact/hooks'

export interface ToastMessage {
  message: string
  action?: { label: string; run: () => void }
}

interface Props {
  toast: ToastMessage
  onClose: () => void
}

const DURATION_MS = 6000

export function Toast({ toast, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div class="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          class="toast-action"
          onClick={() => {
            toast.action?.run()
            onClose()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

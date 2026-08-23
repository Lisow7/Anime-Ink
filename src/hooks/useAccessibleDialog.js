import { useEffect, useEffectEvent, useId, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useAccessibleDialog({ open = true, onClose, returnFocusRef }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const closeDialog = useEffectEvent(() => onClose?.())
  const restoreFocus = useEffectEvent((previousFocus) => {
    const focusTarget = returnFocusRef?.current ?? previousFocus
    if (focusTarget instanceof HTMLElement && focusTarget.isConnected) focusTarget.focus()
  })

  useEffect(() => {
    if (!open) return undefined

    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    const focusables = () => [...(dialog?.querySelectorAll(FOCUSABLE) ?? [])]
    const initialFocus = focusables()[0] ?? dialog
    initialFocus?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        dialog?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      setTimeout(() => restoreFocus(previousFocus), 0)
    }
  }, [open])

  return { dialogRef, titleId }
}

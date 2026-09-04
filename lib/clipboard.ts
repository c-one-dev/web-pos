/**
 * Copy text to the clipboard, including on plain HTTP.
 *
 * `navigator.clipboard` only exists in a secure context - HTTPS or localhost.
 * The POS is reached over http:// on the shop's LAN, so there it is undefined
 * and calling it throws. Every copy button in the app used it directly and
 * reported success regardless, which is why nothing was ever on the clipboard.
 *
 * Falls back to a hidden textarea and the old execCommand, which browsers
 * still honour inside a user gesture. Returns whether the copy actually
 * happened, so the caller can say so honestly.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied or the API is unavailable despite the check - fall
      // through to the textarea rather than giving up.
    }
  }

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    // Off-screen rather than hidden: a display:none element cannot be
    // selected, and iOS needs it to be non-readonly and visible-ish.
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.top = "-1000px"
    textarea.style.opacity = "0"

    // Mounted inside the open dialog when there is one. Radix traps focus
    // within the dialog, so a textarea parked on document.body can never be
    // focused - and execCommand copies from the focused selection, so the
    // copy silently did nothing.
    const active = document.activeElement as HTMLElement | null
    const host =
      active?.closest('[role="dialog"], [role="alertdialog"]') ?? document.body
    host.appendChild(textarea)

    textarea.focus({ preventScroll: true })
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const copied = document.execCommand("copy")
    host.removeChild(textarea)
    // Put focus back where the user left it, or the dialog loses its trap
    // anchor and closing behaves oddly.
    active?.focus?.()
    return copied
  } catch {
    return false
  }
}

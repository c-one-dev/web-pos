import { useEffect, useRef, useState } from "react"

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const

export function useIdleTimer(enabled: boolean) {
  const [idle, setIdle] = useState(false)
  const idleRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    idleRef.current = idle
  }, [idle])

  const scheduleIdle = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT_MS)
  }

  // Once locked, ambient mouse/keyboard activity (including clicks inside
  // the lock screen itself) must NOT dismiss it — only a successful PIN
  // entry (via `unlock`) should.
  const handleActivity = () => {
    if (idleRef.current) return
    scheduleIdle()
  }

  const unlock = () => {
    setIdle(false)
    scheduleIdle()
  }

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      return
    }
    scheduleIdle()
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity)
    )
    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      )
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { idle, reset: unlock }
}

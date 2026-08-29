import { useEffect, useRef, useState } from "react"

const IDLE_TIMEOUT_MS = 50 * 60 * 1000
const LOCK_STORAGE_KEY = "pos-idle-locked"
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const

export function useIdleTimer(enabled: boolean) {
  // Start unlocked on every render (server and client must match), then
  // immediately check for a persisted lock once mounted on the client. A
  // lock persisted in localStorage survives a page refresh (or the tab
  // being reopened) so a bare reload can never be used to bypass it.
  const [idle, setIdle] = useState(false)
  const idleRef = useRef(idle)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    idleRef.current = idle
  }, [idle])

  useEffect(() => {
    if (localStorage.getItem(LOCK_STORAGE_KEY) === "true") setIdle(true)
  }, [])

  const lock = () => {
    localStorage.setItem(LOCK_STORAGE_KEY, "true")
    setIdle(true)
  }

  const scheduleIdle = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(lock, IDLE_TIMEOUT_MS)
  }

  // Once locked, ambient mouse/keyboard activity (including clicks inside
  // the lock screen itself) must NOT dismiss it — only a successful PIN
  // entry (via `unlock`) should.
  const handleActivity = () => {
    if (idleRef.current) return
    scheduleIdle()
  }

  const unlock = () => {
    localStorage.removeItem(LOCK_STORAGE_KEY)
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

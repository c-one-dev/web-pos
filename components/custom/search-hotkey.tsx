"use client"
import { useEffect } from "react"

// F3 jumps to the page's search box, everywhere in the app.
//
// Mounted once in the (auth) layout rather than wired page by page: every list
// page tags its search input with `data-search-input`, and this finds the
// visible one. A page with no such input is left alone - Process Sale handles
// F3 itself, opening its product palette, and still works because nothing is
// found here to focus.
export default function SearchHotkey() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F3") return

      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("[data-search-input]")
      )
      // offsetParent is null for anything display:none - which is how the
      // report pages hide the tabs that aren't showing, so this picks the
      // search box the user can actually see.
      const target = inputs.find(
        (input) => input.offsetParent !== null && !input.disabled
      )
      if (!target) return

      // Only claim the key once there's somewhere to put the cursor,
      // otherwise the browser's own find bar stays available.
      event.preventDefault()
      target.focus()
      target.select()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return null
}

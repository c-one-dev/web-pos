"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A table that scrolls sideways with a scrollbar that stays on screen.
 *
 * Windows and macOS both fade an overlay scrollbar out when it is idle, and
 * no CSS overrides that - so on a narrow screen the only thing saying a table
 * continues past its right edge vanished a second after it appeared. The
 * native bar is hidden and a thumb is drawn beneath the table instead, sized
 * and positioned from the container's own scroll offsets, and draggable like
 * the bar it replaces.
 */
function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  // Thumb width and offset as fractions of the track. width: 1 means the
  // table fits, and the bar is not drawn at all.
  const [bar, setBar] = React.useState({ width: 1, left: 0 })

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const { scrollWidth, clientWidth, scrollLeft } = container
      if (scrollWidth <= clientWidth + 1) {
        setBar({ width: 1, left: 0 })
        return
      }
      setBar({
        width: clientWidth / scrollWidth,
        left: scrollLeft / scrollWidth,
      })
    }

    measure()
    container.addEventListener("scroll", measure, { passive: true })
    if (typeof ResizeObserver === "undefined")
      return () => container.removeEventListener("scroll", measure)

    // The table is observed as well as its container: rows arriving change
    // how wide the content is without the container resizing at all.
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    if (tableRef.current) observer.observe(tableRef.current)
    return () => {
      container.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [])

  const onThumbDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    const track = event.currentTarget.parentElement
    if (!container || !track) return
    event.preventDefault()
    const startX = event.clientX
    const startScroll = container.scrollLeft
    const ratio = container.scrollWidth / track.clientWidth

    const onMove = (move: PointerEvent) => {
      container.scrollLeft = startScroll + (move.clientX - startX) * ratio
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <div data-slot="table-wrapper" className="w-full">
      <div
        ref={containerRef}
        data-slot="table-container"
        className={cn(
          "relative w-full overflow-x-scroll",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          containerClassName
        )}
      >
        <table
          ref={tableRef}
          data-slot="table"
          className={cn(
            "w-full caption-bottom text-xs",
            // The shared --border is the palette's lightest grey, which on a
            // white card leaves a table looking like floating text. Tables
            // need their grid read as a grid, so they take a stronger line -
            // stated as an alpha of the foreground so it holds up in dark
            // mode too.
            "border-foreground/20 [&_tr]:border-foreground/15",
            className
          )}
          {...props}
        />
      </div>
      {bar.width < 1 && (
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
          <div
            role="presentation"
            onPointerDown={onThumbDrag}
            className="h-full cursor-grab rounded-full bg-primary/60 transition-colors hover:bg-primary active:cursor-grabbing"
            style={{
              width: `${bar.width * 100}%`,
              marginLeft: `${bar.left * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

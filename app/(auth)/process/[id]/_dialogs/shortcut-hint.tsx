"use client"
import React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import { InfoIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { SHORTCUTS } from "./shortcuts"

/**
 * A keycap with an info dot that explains the key on hover.
 *
 * Text comes from the same SHORTCUTS list the full guide renders, so the
 * tooltip and the guide can never disagree about what a key does.
 *
 * These sit inside buttons (the search field, Add Customer, Pay), so the
 * trigger is a <span> rather than the default <button> - a button inside a
 * button is invalid HTML and would swallow the parent's click.
 */
export default function ShortcutHint({
  keys,
  className,
  iconClassName,
}: {
  keys: string
  className?: string
  iconClassName?: string
}) {
  const shortcut = SHORTCUTS.find((item) => item.keys === keys)
  if (!shortcut) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/*
          Kbd carries pointer-events-none in its base styles, which would stop
          the tooltip ever opening - re-enabled here on the wrapper.
        */}
        <span className="pointer-events-auto inline-flex items-center gap-1">
          <Kbd className={cn("text-foreground", className)}>{keys}</Kbd>
          <InfoIcon
            className={cn("opacity-70", iconClassName)}
            size={16}
            aria-hidden
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-semibold">{shortcut.title}</p>
        <p>{shortcut.description}</p>
        <p className="mt-1 italic">{shortcut.bisaya}</p>
      </TooltipContent>
    </Tooltip>
  )
}

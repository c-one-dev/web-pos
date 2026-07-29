"use client"

import * as React from "react"
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

function PasswordInput({
  className,
  groupClassName,
  toggleLabel = "password",
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "type"> & {
  groupClassName?: string
  toggleLabel?: string
}) {
  const [visible, setVisible] = React.useState(false)

  return (
    <InputGroup className={groupClassName}>
      <InputGroupInput
        type={visible ? "text" : "password"}
        className={className}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-xs"
          aria-label={visible ? `Hide ${toggleLabel}` : `Show ${toggleLabel}`}
          onClick={() => setVisible((prev) => !prev)}
        >
          {visible ? <EyeSlashIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export { PasswordInput }

"use client"
import { ReactNode, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import ChangePasswordForm from "@/components/custom/change-password-form"

type Props = {
  children: ReactNode
}

export default function ChangePasswordDialog({ children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Update your account password.</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm
          heading="Change Password"
          description="Update your account password."
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

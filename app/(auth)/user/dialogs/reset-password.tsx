import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useState } from "react"
import { toast } from "sonner"
import { KeyIcon } from "@phosphor-icons/react"
import { copyToClipboard } from "@/lib/clipboard"

type Props = {
  _id: string
  onClose: () => void
}

const GET_USER = gql`
  query User($_id: ID!) {
    user(_id: $_id) {
      _id
      name
      username
    }
  }
`

const RESET_USER_PASSWORD = gql`
  mutation ResetUserPassword($_id: ID!) {
    resetUserPassword(_id: $_id) {
      ok
      message
      data
    }
  }
`

export default function ResetPasswordDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  // Held only until the admin closes the dialog - the server hashes it and
  // cannot show it again.
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const { data }: any = useQuery(GET_USER, {
    variables: { _id },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [resetPassword] = useMutation(RESET_USER_PASSWORD)

  const user = data?.user

  const handleReset = async () => {
    setIsPending(true)
    try {
      const result: any = await resetPassword({ variables: { _id } })
      if (result?.data?.resetUserPassword?.ok) {
        setTempPassword(result.data.resetUserPassword.data)
        toast.success(result.data.resetUserPassword.message)
      } else {
        toast.error(result?.data?.resetUserPassword?.message ?? "Failed")
      }
    } catch (error: any) {
      toast.error(error?.graphQLErrors?.[0]?.message ?? error.message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return
          setOpen(next)
          if (!next) {
            setTempPassword(null)
            onClose()
          }
        }}
      >
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            setOpen(true)
          }}
        >
          <KeyIcon /> Reset Password
        </DropdownMenuItem>
        <AlertDialogContent>
          {tempPassword ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Temporary Password</AlertDialogTitle>
                <AlertDialogDescription>
                  Share this password with {user?.name || "the user"}. It will
                  not be shown again, and they&apos;ll be required to set their
                  own on the next sign-in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center justify-between gap-2 border p-2 font-mono text-lg">
                <span>{tempPassword}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const copied = await copyToClipboard(tempPassword)
                    if (copied) toast.success("Copied to clipboard.")
                    else
                      toast.error(
                        "Could not copy - select the password and copy it by hand."
                      )
                  }}
                >
                  Copy
                </Button>
              </div>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setOpen(false)}>
                  Done
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset password?</AlertDialogTitle>
                <AlertDialogDescription>
                  This replaces {user?.name || "this user"}&apos;s password
                  {user?.username ? ` (${user.username})` : ""} with a new
                  temporary one. Their current password stops working
                  immediately, and any device they are signed in on keeps its
                  session until it expires.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  type="button"
                  loading={isPending}
                  disabled={isPending}
                  onClick={handleReset}
                >
                  Reset Password
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

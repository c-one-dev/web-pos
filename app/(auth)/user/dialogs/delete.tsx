import { Button } from "@/components/ui/button"
import {
  AlertDialog,
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
import { TrashIcon } from "@phosphor-icons/react"

type Props = {
  _id: string
  onClose: () => void
}

const GET_USER = gql`
  query User($_id: ID!) {
    user(_id: $_id) {
      _id
      name
      surname
      username
    }
  }
`

const DELETE_USER = gql`
  mutation DeleteUser($_id: ID!) {
    deleteUser(_id: $_id) {
      ok
      message
    }
  }
`

export default function DeleteDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const { data }: any = useQuery(GET_USER, {
    variables: { _id },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [deleteUser] = useMutation(DELETE_USER, {
    refetchQueries: ["UserTable"],
  })

  const user = data?.user

  const handleDelete = async () => {
    setIsPending(true)
    try {
      const result: any = await deleteUser({ variables: { _id } })
      if (result?.data?.deleteUser?.ok) {
        toast.success(result.data.deleteUser.message)
        setOpen(false)
        onClose()
      } else {
        toast.error(result?.data?.deleteUser?.message ?? "Failed")
      }
    } catch (error: any) {
      // The server refuses when the account has sales, payments, shifts or
      // targets behind it, and says which - worth showing in full rather than
      // as a generic failure.
      toast.error(error?.graphQLErrors?.[0]?.message ?? error.message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        setOpen(next)
        if (!next) onClose()
      }}
    >
      <DropdownMenuItem
        variant="destructive"
        onSelect={(event) => {
          event.preventDefault()
          setOpen(true)
        }}
      >
        <TrashIcon /> Delete
      </DropdownMenuItem>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this user permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            {user
              ? `${user.name} ${user.surname} (${user.username})`
              : "This account"}{" "}
            will be removed for good. This cannot be undone.
            <br />
            <br />
            An account with sales, payments, register sessions or sales targets
            on record cannot be deleted - those would lose the name attached to
            them. Deactivate it instead, which blocks the login and keeps the
            history intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            loading={isPending}
            disabled={isPending}
            onClick={handleDelete}
          >
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

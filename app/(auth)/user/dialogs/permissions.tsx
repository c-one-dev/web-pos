import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  CaretDownIcon,
  CaretRightIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  normalizePermissions,
  permissionTree,
  type PermissionNode,
} from "@/validators/permissionRegistry"
import { cn } from "@/lib/utils"

type Props = {
  _id: string
  onClose: () => void
}

const GET_USER_PERMISSIONS = gql`
  query UserPermissions($_id: ID!) {
    userPermissions(_id: $_id) {
      _id
      fullName
      role
      permissions
      defaultPermissions
    }
  }
`

const UPDATE_USER_PERMISSIONS = gql`
  mutation UpdateUserPermissions($_id: ID!, $permissions: [String!]!) {
    updateUserPermissions(_id: $_id, permissions: $permissions) {
      ok
      message
      data
    }
  }
`

const descendantKeys = (node: PermissionNode): string[] => [
  node.key,
  ...(node.children ?? []).flatMap(descendantKeys),
]

function PermissionRow({
  node,
  depth,
  granted,
  onToggle,
}: {
  node: PermissionNode
  depth: number
  granted: Set<string>
  onToggle: (node: PermissionNode, checked: boolean) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = !!node.children?.length
  const subtree = useMemo(() => descendantKeys(node), [node])
  const checkedCount = subtree.filter((key) => granted.has(key)).length
  const checked =
    checkedCount === 0
      ? false
      : checkedCount === subtree.length
        ? true
        : "indeterminate"

  return (
    <div className={cn(depth === 0 && "rounded-none border bg-muted/30 p-2")}>
      <div
        className="flex items-center gap-1.5"
        style={{ paddingLeft: depth === 0 ? 0 : (depth - 1) * 18 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <CaretDownIcon size={12} />
            ) : (
              <CaretRightIcon size={12} />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <Checkbox
          id={node.key}
          checked={checked}
          onCheckedChange={(value) => onToggle(node, value === true)}
          className="data-[state=indeterminate]:border-primary/50 data-[state=indeterminate]:bg-primary/40"
        />
        <label
          htmlFor={node.key}
          className={cn(
            "cursor-pointer text-sm select-none",
            depth === 0 && "font-semibold",
            depth === 1 && "font-medium"
          )}
        >
          {node.label}
        </label>
      </div>
      {hasChildren && expanded && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {node.children!.map((child) => (
            <PermissionRow
              key={child.key}
              node={child}
              depth={depth + 1}
              granted={granted}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PermissionsDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const { data, loading }: any = useQuery(GET_USER_PERMISSIONS, {
    variables: { _id },
    fetchPolicy: "network-only",
    skip: !_id || !open,
  })
  const [updatePermissions, { loading: saving }] = useMutation(
    UPDATE_USER_PERMISSIONS
  )

  const user = data?.userPermissions

  useEffect(() => {
    if (!user) return
    // `permissions: null` means nothing has ever been saved for this user, so
    // they're running on their role's default set - start from that, which is
    // exactly what they can do today. Saving from there only changes what the
    // admin actually ticks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGranted(
      new Set<string>(
        normalizePermissions(user.permissions ?? user.defaultPermissions ?? [])
      )
    )
  }, [user])

  const onToggle = (node: PermissionNode, checked: boolean) => {
    setGranted((prev) => {
      const next = new Set(prev)
      // Ticking a group ticks its whole subtree; unticking drops the subtree.
      for (const key of descendantKeys(node)) {
        if (checked) next.add(key)
        else next.delete(key)
      }
      // A granted leaf must never sit under an unticked group.
      return new Set(checked ? normalizePermissions([...next]) : next)
    })
  }

  const onSave = async () => {
    try {
      const result: any = await updatePermissions({
        variables: { _id, permissions: normalizePermissions([...granted]) },
      })
      if (result.data.updateUserPermissions.ok) {
        toast.success(result.data.updateUserPermissions.message)
        setOpen(false)
        onClose()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update permissions.")
    }
  }

  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          Permissions
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <ShieldCheckIcon size={18} />
            Permissions
            {user?.fullName && (
              <span className="underline">- {user.fullName}</span>
            )}
            {user?.role && <Badge variant="outline">{user.role}</Badge>}
          </DialogTitle>
          <DialogDescription>
            Tick what this user is allowed to see and do. This replaces their
            role&apos;s default access, so you can grant more than the default
            or take some of it away. Changing a user&apos;s role and managing
            permissions stay administrator-only regardless of what is ticked.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-3">
          <div className="flex flex-col gap-2">
            {loading && !user ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              permissionTree.map((node) => (
                <PermissionRow
                  key={node.key}
                  node={node}
                  depth={0}
                  granted={granted}
                  onToggle={onToggle}
                />
              ))
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() =>
              setGranted(
                new Set(normalizePermissions(user?.defaultPermissions ?? []))
              )
            }
            disabled={saving || !user}
          >
            Reset to Role Default
          </Button>
          <div className="flex gap-1.5">
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={onSave} disabled={saving || !user}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

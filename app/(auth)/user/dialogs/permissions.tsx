"use client"

import { Badge } from "@/components/ui/badge"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretRightIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SquaresFourIcon,
  StorefrontIcon,
  UserGearIcon,
  UsersThreeIcon,
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

type IconComponent = React.ComponentType<{ size?: number; className?: string }>

// Top-level group -> rail icon. Keyed by permission key so a relabelled group
// can't silently lose its icon.
const GROUP_ICONS: Record<string, IconComponent> = {
  dashboard: SquaresFourIcon,
  pos: ShoppingCartIcon,
  products: PackageIcon,
  customers: UsersThreeIcon,
  reports: ChartBarIcon,
  users: UserGearIcon,
  store: StorefrontIcon,
}

const descendantKeys = (node: PermissionNode): string[] => [
  node.key,
  ...(node.children ?? []).flatMap(descendantKeys),
]

// Search renders a pruned copy of the tree, so a row handed a filtered node
// would count and toggle only the branches that happened to match. Every row
// resolves back to the real node through this map first, which keeps "1/5"
// honest and stops an unticked group from orphaning the leaves search hid.
const nodeByKey: Record<string, PermissionNode> = (() => {
  const map: Record<string, PermissionNode> = {}
  const walk = (nodes: PermissionNode[]) => {
    for (const node of nodes) {
      map[node.key] = node
      if (node.children) walk(node.children)
    }
  }
  walk(permissionTree)
  return map
})()

// Only the tickable end-permissions. Counters read "3/8" off these so the
// group rows that merely hold them don't inflate the total.
const leafKeys = (node: PermissionNode): string[] =>
  node.children?.length ? node.children.flatMap(leafKeys) : [node.key]

const MINOR_WORDS = new Set(["of", "and", "the"])

// Registry labels shout ("POINT OF SALE") because they used to render as
// section headers. In the rail they read as navigation, so soften them.
const titleCase = (label: string) =>
  label
    .toLowerCase()
    .split(" ")
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")

const countGranted = (node: PermissionNode, granted: Set<string>) => {
  const leaves = leafKeys(node)
  return {
    granted: leaves.filter((key) => granted.has(key)).length,
    total: leaves.length,
  }
}

const checkedState = (node: PermissionNode, granted: Set<string>) => {
  const subtree = descendantKeys(node)
  const checked = subtree.filter((key) => granted.has(key)).length
  if (checked === 0) return false
  return checked === subtree.length ? true : "indeterminate"
}

// Keeps a matched group's whole subtree, plus any ancestor needed to reach a
// matched leaf, so results stay readable in their original hierarchy.
const filterTree = (
  nodes: PermissionNode[],
  query: string
): PermissionNode[] => {
  const needle = query.trim().toLowerCase()
  if (!needle) return nodes
  const visit = (node: PermissionNode): PermissionNode | null => {
    if (node.label.toLowerCase().includes(needle)) return node
    const children = (node.children ?? [])
      .map(visit)
      .filter((child): child is PermissionNode => child !== null)
    return children.length ? { ...node, children } : null
  }
  return nodes
    .map(visit)
    .filter((node): node is PermissionNode => node !== null)
}

// Radix reports the third state as data-state="indeterminate"; the shared
// Checkbox only ever draws a tick, so hide it and rule a dash instead.
const TRISTATE = cn(
  "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
  "data-[state=indeterminate]:before:h-0.5 data-[state=indeterminate]:before:w-2",
  "data-[state=indeterminate]:before:bg-primary-foreground",
  "[&[data-state=indeterminate]_svg]:hidden"
)

function PermissionRow({
  node,
  granted,
  defaults,
  onToggle,
}: {
  node: PermissionNode
  granted: Set<string>
  defaults: Set<string>
  onToggle: (node: PermissionNode, checked: boolean) => void
}) {
  const [expanded, setExpanded] = useState(true)
  // `node` may be a search-pruned copy; `source` is always the real one.
  const source = nodeByKey[node.key] ?? node
  const hasChildren = !!node.children?.length
  const checked = checkedState(source, granted)
  const stats = countGranted(source, granted)

  // Only leaves carry a drift marker - a group would light up whenever any
  // descendant differed, which is noise once the leaves already say so.
  const isGranted = granted.has(node.key)
  const drift =
    hasChildren || isGranted === defaults.has(node.key)
      ? null
      : isGranted
        ? "added"
        : "removed"

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1 pr-2 pl-1.5 transition-colors hover:bg-muted/60">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <CaretDownIcon size={10} weight="bold" />
            ) : (
              <CaretRightIcon size={10} weight="bold" />
            )}
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <Checkbox
          id={node.key}
          checked={checked}
          onCheckedChange={(value) => onToggle(source, value === true)}
          className={TRISTATE}
        />
        <label
          htmlFor={node.key}
          className={cn(
            "flex-1 cursor-pointer py-0.5 leading-snug select-none",
            hasChildren && "font-medium"
          )}
        >
          {node.label}
        </label>
        {drift && (
          <span
            title={
              drift === "added"
                ? "Granted on top of the role default"
                : "Taken away from the role default"
            }
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              drift === "added" ? "bg-primary" : "bg-destructive/70"
            )}
          />
        )}
        {hasChildren && (
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {stats.granted}/{stats.total}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="ml-[13px] border-l border-border pl-1">
          {node.children!.map((child) => (
            <PermissionRow
              key={child.key}
              node={child}
              granted={granted}
              defaults={defaults}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupHeading({
  group,
  granted,
  onToggle,
}: {
  group: PermissionNode
  granted: Set<string>
  onToggle: (node: PermissionNode, checked: boolean) => void
}) {
  const Icon = GROUP_ICONS[group.key]
  // Same reason as PermissionRow: under search this arrives pruned.
  const source = nodeByKey[group.key] ?? group
  const stats = countGranted(source, granted)

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-popover px-3 py-2">
      {Icon && <Icon size={14} className="shrink-0 text-muted-foreground" />}
      <span className="font-medium">{titleCase(group.label)}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {stats.granted}/{stats.total}
      </span>
      {/* Styled as an outline button rather than muted text: as a bare
          tickbox on the same white as the rows below, people missed it. */}
      <label className="ml-auto flex h-6 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-background px-2 font-medium transition-colors select-none hover:bg-muted hover:text-foreground">
        <Checkbox
          checked={checkedState(source, granted)}
          onCheckedChange={(value) => onToggle(source, value === true)}
          className={TRISTATE}
        />
        Select all
      </label>
    </div>
  )
}

export default function PermissionsDialog({ _id, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [baseline, setBaseline] = useState<Set<string>>(new Set())
  const [activeKey, setActiveKey] = useState(permissionTree[0].key)
  const [search, setSearch] = useState("")

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
    const initial = new Set<string>(
      normalizePermissions(user.permissions ?? user.defaultPermissions ?? [])
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGranted(initial)
    setBaseline(new Set(initial))
  }, [user])

  const defaults = useMemo(
    () => new Set(normalizePermissions(user?.defaultPermissions ?? [])),
    [user]
  )

  const allLeaves = useMemo(() => permissionTree.flatMap(leafKeys), [])

  const totals = useMemo(
    () => ({
      granted: allLeaves.filter((key) => granted.has(key)).length,
      total: allLeaves.length,
    }),
    [allLeaves, granted]
  )

  // How far this selection sits from the role default, which is the thing an
  // admin actually wants to know before saving.
  const driftCount = useMemo(
    () =>
      allLeaves.filter((key) => granted.has(key) !== defaults.has(key)).length,
    [allLeaves, granted, defaults]
  )

  const dirty = useMemo(() => {
    if (granted.size !== baseline.size) return true
    for (const key of granted) if (!baseline.has(key)) return true
    return false
  }, [granted, baseline])

  const searching = search.trim().length > 0
  const results = useMemo(
    () => (searching ? filterTree(permissionTree, search) : []),
    [searching, search]
  )
  const activeGroup =
    permissionTree.find((group) => group.key === activeKey) ?? permissionTree[0]

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
      // Ticks that exactly match the role default are saved as "no explicit
      // list" rather than as a copy of it. Saving the copy would pin the user
      // to today's default: change their role later and they would keep the
      // old set, which is how a NO_ROLE user kept a cashier's edit rights.
      const defaults = new Set(
        normalizePermissions(user?.defaultPermissions ?? [])
      )
      const current = normalizePermissions([...granted])
      const matchesDefault =
        current.length === defaults.size &&
        current.every((key) => defaults.has(key))

      const result: any = await updatePermissions({
        variables: { _id, permissions: matchesDefault ? null : current },
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

  const busy = loading && !user

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          Permissions
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="gap-0 border-b p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center border bg-muted/50 text-muted-foreground">
              <ShieldCheckIcon size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Permissions</span>
                {user?.fullName && (
                  <>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="truncate">{user.fullName}</span>
                  </>
                )}
                {user?.role && (
                  <Badge variant="outline" className="font-normal">
                    {user.role}
                  </Badge>
                )}
                {user && (
                  <Badge
                    variant={user.permissions ? "secondary" : "outline"}
                    className="font-normal text-muted-foreground"
                  >
                    {user.permissions ? "Custom access" : "Role default"}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Tick what this user is allowed to see and do. This list replaces
                their role&apos;s default access, so you can grant more than the
                default or take some of it away.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <InputGroup className="h-8 w-full max-w-[260px]">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={`Search ${totals.total} permissions...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <div className="ml-auto flex items-center gap-3 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {totals.granted}
              </span>{" "}
              of {totals.total} granted
            </span>
            {driftCount > 0 && (
              <>
                <Separator orientation="vertical" className="!h-4" />
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  {driftCount} off role default
                </span>
              </>
            )}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[184px_1fr] divide-x">
          <div className="flex flex-col bg-muted/25">
            <nav className="flex flex-1 flex-col gap-px p-1.5">
              {permissionTree.map((group) => {
                const Icon = GROUP_ICONS[group.key]
                const stats = countGranted(group, granted)
                const active = !searching && group.key === activeKey
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      setSearch("")
                      setActiveKey(group.key)
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      active
                        ? "bg-background font-medium text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    )}
                  >
                    {Icon && <Icon size={14} className="shrink-0" />}
                    <span className="flex-1 truncate">
                      {titleCase(group.label)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] tabular-nums",
                        stats.granted === 0
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                      )}
                    >
                      {stats.granted}/{stats.total}
                    </span>
                  </button>
                )
              })}
            </nav>
            <p className="border-t px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Changing a user&apos;s role and managing permissions stay
              administrator-only regardless of what is ticked.
            </p>
          </div>

          <ScrollArea className="h-[52vh] min-h-[340px]">
            {busy ? (
              <div className="flex flex-col gap-2.5 p-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Skeleton className="size-4 shrink-0" />
                    <Skeleton
                      className="h-3.5"
                      style={{ width: `${45 + ((index * 13) % 40)}%` }}
                    />
                  </div>
                ))}
              </div>
            ) : searching ? (
              results.length === 0 ? (
                <div className="flex h-[300px] flex-col items-center justify-center gap-1 text-center">
                  <MagnifyingGlassIcon
                    size={20}
                    className="text-muted-foreground/50"
                  />
                  <p className="font-medium">No permissions found</p>
                  <p className="text-muted-foreground">
                    Nothing matches &ldquo;{search.trim()}&rdquo;.
                  </p>
                </div>
              ) : (
                results.map((group) => (
                  <section key={group.key}>
                    <GroupHeading
                      group={group}
                      granted={granted}
                      onToggle={onToggle}
                    />
                    <div className="p-1.5">
                      {group.children?.map((child) => (
                        <PermissionRow
                          key={child.key}
                          node={child}
                          granted={granted}
                          defaults={defaults}
                          onToggle={onToggle}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )
            ) : (
              <>
                <GroupHeading
                  group={activeGroup}
                  granted={granted}
                  onToggle={onToggle}
                />
                <div className="p-1.5">
                  {activeGroup.children?.map((child) => (
                    <PermissionRow
                      key={child.key}
                      node={child}
                      granted={granted}
                      defaults={defaults}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="border-t p-3 sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={() =>
              setGranted(
                new Set(normalizePermissions(user?.defaultPermissions ?? []))
              )
            }
            disabled={saving || !user || driftCount === 0}
          >
            <ArrowCounterClockwiseIcon />
            Reset to role default
          </Button>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-[11px] text-muted-foreground">
                Unsaved changes
              </span>
            )}
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

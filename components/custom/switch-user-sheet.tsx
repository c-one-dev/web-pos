"use client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import PinPad from "./pin-pad"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useSession } from "next-auth/react"
import { ReactNode, useState } from "react"
import { toast } from "sonner"
import { useSwitchUser } from "@/hooks/use-switch-user"

const GET_CURRENT_USER = gql`
  query CurrentUserProfile($_id: ID!) {
    user(_id: $_id) {
      _id
      image
      name
      surname
      displayName
      email
      username
      role
    }
  }
`

const GET_ACTIVE_USERS = gql`
  query ActiveUsersForSwitch {
    activeUsers {
      _id
      image
      fullName
      role
    }
  }
`

type Props = {
  children: ReactNode
}

export default function SwitchUserSheet({ children }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<{
    _id: string
    fullName: string
  } | null>(null)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState<string | null>(null)
  const { data: session }: any = useSession()
  const currentUserId = session?.user?._id
  const { switchToUser, loading: switching } = useSwitchUser()

  const { data: profileData } = useQuery(GET_CURRENT_USER, {
    variables: { _id: currentUserId },
    fetchPolicy: "cache-and-network",
    skip: !currentUserId || !open,
  })
  const { data: usersData, loading: usersLoading } = useQuery(
    GET_ACTIVE_USERS,
    {
      fetchPolicy: "cache-and-network",
      skip: !open,
    }
  )

  const currentUser = (profileData as any)?.user
  const otherUsers = ((usersData as any)?.activeUsers || []).filter(
    (u: any) => u._id !== currentUserId
  )

  const reset = () => {
    setSelected(null)
    setPin("")
    setPinError(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handlePinChange = (next: string) => {
    setPin(next)
    if (pinError) setPinError(null)
  }

  const handleComplete = async (enteredPin: string) => {
    if (!selected) return
    const result = await switchToUser(selected._id, enteredPin)
    if (result.ok) {
      toast.success(result.message)
      setOpen(false)
      reset()
    } else {
      setPinError("Wrong Pin. Enter the Right Pin Again")
      setPin("")
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full data-[side=right]:w-full data-[side=right]:sm:max-w-[min(72rem,95vw)]">
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-bold">
            Switch User
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col items-center gap-4 text-center">
            <div>
              <span className="block font-heading text-lg font-bold break-words text-primary">
                {currentUser
                  ? `${currentUser.name} ${currentUser.surname}`
                  : session?.user?.name}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {(currentUser?.role || session?.user?.role || "").toLowerCase()}
              </span>
            </div>
            <Avatar className="size-24 sm:size-32 lg:size-40">
              <AvatarImage src={currentUser?.image || undefined} />
              <AvatarFallback className="bg-zinc-300 text-4xl">
                {currentUser?.name?.[0]}
                {currentUser?.surname?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="w-full space-y-0.5 text-xs break-words text-muted-foreground">
              {currentUser?.username && <div>@{currentUser.username}</div>}
              {currentUser?.email && <div>{currentUser.email}</div>}
            </div>
          </div>

          <div className="min-w-0">
            {!selected ? (
              usersLoading ? (
                <span className="text-sm text-muted-foreground">Loading…</span>
              ) : otherUsers.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No other active users found.
                </span>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {otherUsers.map((user: any) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() =>
                        setSelected({ _id: user._id, fullName: user.fullName })
                      }
                      className="flex min-w-0 flex-col items-center gap-2 transition-opacity hover:opacity-75"
                    >
                      <Avatar className="size-14 shrink-0 sm:size-16">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback className="bg-zinc-300">
                          {user.fullName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="w-full text-center text-xs leading-tight font-medium break-words sm:text-sm">
                        {user.fullName}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="flex min-w-0 flex-col items-center gap-4 py-6">
                <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-center font-medium break-words sm:text-left">
                    Enter PIN for {selected.fullName}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reset}
                    disabled={switching}
                  >
                    Back to list
                  </Button>
                </div>
                <PinPad
                  value={pin}
                  onChange={handlePinChange}
                  onComplete={handleComplete}
                  disabled={switching}
                  error={!!pinError}
                  errorMessage={pinError || undefined}
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

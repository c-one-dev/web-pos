"use client"
import { useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useSession } from "next-auth/react"
import { useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import PinPad from "@/components/custom/pin-pad"
import { useIdleTimer } from "@/hooks/use-idle-timer"
import { useSwitchUser } from "@/hooks/use-switch-user"

const GET_ACTIVE_USERS = gql`
  query ActiveUsersForLockScreen {
    activeUsers {
      _id
      image
      fullName
      role
    }
  }
`

function UnlockCard({
  onUnlock,
  currentUserId,
}: {
  onUnlock: () => void
  currentUserId?: string
}) {
  const [selected, setSelected] = useState<{
    _id: string
    fullName: string
  } | null>(null)
  const [pin, setPin] = useState("")
  const { data, loading } = useQuery(GET_ACTIVE_USERS, {
    fetchPolicy: "cache-and-network",
  })
  const { switchToUser, loading: switching } = useSwitchUser()
  const users = (data as any)?.activeUsers || []

  const handleComplete = async (enteredPin: string) => {
    if (!selected) return
    const result = await switchToUser(selected._id, enteredPin)
    if (result.ok) {
      toast.success(result.message)
      onUnlock()
    } else {
      toast.error(result.message)
      setPin("")
    }
  }

  return (
    <div className="w-full max-w-3xl bg-background p-6 shadow-lg">
      {!selected ? (
        <>
          <h2 className="mb-4 text-lg font-bold">Who&apos;s there?</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-8" />
            </div>
          ) : (
            <div className="grid max-h-100 grid-cols-3 gap-x-6 gap-y-8 overflow-y-auto p-2 sm:grid-cols-4">
              {users.map((user: any) => {
                const isCurrentUser = user._id === currentUserId
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() =>
                      setSelected({ _id: user._id, fullName: user.fullName })
                    }
                    className="flex flex-col items-center gap-2 transition-opacity hover:opacity-75"
                  >
                    <Avatar
                      className={cn(
                        "size-16",
                        isCurrentUser &&
                          "size-20 rounded-full ring-[3px] ring-primary"
                      )}
                    >
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-center text-sm font-medium">
                      {user.fullName}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="-mt-1">
                        You
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full items-center justify-between">
            <div>
              <span className="block font-medium">Enter your PIN</span>
              <span className="text-xs text-muted-foreground">
                {selected.fullName} · Max 4-digit
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected(null)
                setPin("")
              }}
              disabled={switching}
            >
              Back to list
            </Button>
          </div>
          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            disabled={switching}
          />
        </div>
      )}
    </div>
  )
}

export default function IdleLockScreen({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status }: any = useSession()
  const { idle, reset } = useIdleTimer(status === "authenticated")

  return (
    <>
      {children}
      {status === "authenticated" && idle && (
        <div className="fixed inset-0 z-100 flex items-start justify-center bg-black/40 p-4 pt-24">
          <UnlockCard onUnlock={reset} currentUserId={session?.user?._id} />
        </div>
      )}
    </>
  )
}

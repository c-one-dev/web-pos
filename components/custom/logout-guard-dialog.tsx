"use client"
import { signOut } from "next-auth/react"
import { useLazyQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { CashRegisterIcon, WarningIcon } from "@phosphor-icons/react"
import { format } from "date-fns"

// Only returns shifts opened by the signed-in user, so a cashier who never
// opened a register is never stopped on the way out.
const MY_OPEN_SESSIONS = gql`
  query MyOpenRegisterSessions {
    myOpenRegisterSessions {
      _id
      openedAt
      register {
        _id
        name
      }
    }
  }
`

/**
 * Wraps the Log out control. If the user still has a register shift open,
 * logging out is interrupted with a warning first: closing a register needs a
 * counted drawer, so this sends them to that register rather than trying to
 * close it silently. Once nothing is left open, the Log out button appears.
 */
export default function LogoutGuardDialog({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const router = useRouter()
  // Lazy rather than a skipped useQuery: the check has to finish BEFORE the
  // dialog is shown, otherwise every user with nothing open sees it flash for
  // the length of the round trip on their way out.
  const [fetchOpenSessions, { data, loading }] = useLazyQuery(
    MY_OPEN_SESSIONS,
    {
      fetchPolicy: "network-only",
    }
  )
  const sessions = (data as any)?.myOpenRegisterSessions || []
  const hasOpen = sessions.length > 0

  const onLogoutClick = async () => {
    if (checking) return
    setChecking(true)
    try {
      const result = await fetchOpenSessions()
      const fresh = (result?.data as any)?.myOpenRegisterSessions || []
      // Nothing open - log straight out. No dialog is shown at all, so the
      // common case costs no extra click and no flash.
      if (!fresh.length) {
        signOut()
        return
      }
      setOpen(true)
    } catch {
      // A failed check must not strand someone at their till. Warn rather
      // than block: show the dialog so they can still close a register by
      // hand, or cancel and retry.
      setOpen(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <span onClick={onLogoutClick}>{children}</span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          className={cn(
            "gap-5 p-4 sm:p-6",
            // The primitive caps width with data-[size=default]:sm:max-w-sm,
            // an attribute variant that outranks a plain sm:max-w-*. Matching
            // its chain is what makes this take effect.
            "data-[size=default]:max-w-[calc(100vw-2rem)]",
            "data-[size=default]:sm:max-w-2xl"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl">
              {hasOpen && (
                <WarningIcon className="text-destructive" size={28} />
              )}
              {hasOpen ? "Register still open" : "Ready to log out"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-base">
                <p>
                  {hasOpen
                    ? "You opened a register that hasn't been closed yet. Close it so this shift's cash is counted and reconciled before you go."
                    : "All of your registers are closed."}
                </p>
                {hasOpen && (
                  <p className="text-muted-foreground italic">
                    Naa kay register nga wala pa nasirado. Sirad-i kini aron
                    maihap ug ma-reconcile ang kwarta niining shift sa dili ka
                    pa mogawas.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {loading && (
            <div className="flex justify-center py-6">
              <Spinner className="size-8 text-primary" />
            </div>
          )}

          {!loading && hasOpen && (
            <div className="flex flex-col gap-2.5">
              {sessions.map((session: any) => (
                <div
                  key={session._id}
                  className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CashRegisterIcon
                      size={24}
                      className="shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium">
                        {session.register?.name || "Register"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Opened{" "}
                        {session.openedAt
                          ? format(Number(session.openedAt), "PP p")
                          : "-"}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full shrink-0 text-base sm:w-auto"
                    onClick={() => {
                      // Closing needs a counted drawer, so hand them over to
                      // that register's page instead of closing from here.
                      setOpen(false)
                      router.push(`/cash-register/${session.register?._id}`)
                    }}
                  >
                    Close Now
                  </Button>
                </div>
              ))}
            </div>
          )}

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full text-base sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            {!loading && !hasOpen && (
              <Button
                type="button"
                size="lg"
                className="w-full text-base sm:w-auto"
                onClick={() => signOut()}
              >
                Log out
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

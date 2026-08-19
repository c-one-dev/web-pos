"use client"
import { usePathname, useRouter } from "next/navigation"
import { permissionsForRoute } from "@/validators/permissionRegistry"
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { LockKeyIcon } from "@phosphor-icons/react"

// Blocks a page the user has no permission for, so a menu item hidden from
// the sidebar can't simply be typed into the address bar instead. This is the
// UX half only - the real enforcement is per-field in app/graphql/route.ts,
// which refuses the data even if someone renders the page shell anyway.
export default function RequirePermission({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const { can, ready } = usePermissions()
  const required = permissionsForRoute(pathname)

  // Ungated route, or permissions not known yet - render normally rather than
  // flashing a denial at someone who does have access. Nothing is leaked by
  // rendering the shell: every query behind it is checked server-side.
  if (!required || !ready || can(...required)) return <>{children}</>

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
      <LockKeyIcon size={32} className="text-muted-foreground" />
      <p className="text-lg font-medium">
        You don&apos;t have access to this page.
      </p>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Ask an administrator or manager to grant you this permission from the
        Users page.
      </p>
      <Button variant="outline" onClick={() => router.back()}>
        Go back
      </Button>
    </div>
  )
}

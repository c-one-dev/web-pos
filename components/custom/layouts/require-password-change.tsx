"use client"
import { useSession } from "next-auth/react"
import ChangePasswordForm from "@/components/custom/change-password-form"

export default function RequirePasswordChange({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { data: session, status } = useSession()

  if (
    status === "authenticated" &&
    (session?.user as any)?.mustChangePassword
  ) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-primary/20">
        <div className="border bg-background p-6">
          <ChangePasswordForm />
        </div>
      </div>
    )
  }

  return <>{children}</>
}

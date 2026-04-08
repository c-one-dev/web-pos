"use client"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "next-auth/react"

export default function Page() {
  const { data: session, status }: any = useSession()

  return (
    <div>
      <span className="block">
        Welcome to the dashboard, {session?.user?.name}!
      </span>
      Dashboard <Button onClick={() => signOut()}>Log out</Button>
    </div>
  )
}

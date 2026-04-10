"use client"
import { createApolloClient } from "@/lib/apollo"
import { ApolloProvider } from "@apollo/client/react"
import { SessionProvider, useSession } from "next-auth/react"
import React, { useMemo } from "react"
import { AblyProvider } from "ably/react"
import { ablyClient } from "@/lib/ably"

function ClientLayout({ children }: { children: React.ReactNode }) {
  const { data, status } = useSession()
  const session = data as any

  const client = useMemo(() => {
    return createApolloClient(
      status === "authenticated" ? session?.accessToken : undefined
    )
  }, [session?.accessToken, status])

  return <ApolloProvider client={client}>{children}</ApolloProvider>
}

function ApolloLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AblyProvider client={ablyClient}>
      <SessionProvider>
        <ClientLayout>{children}</ClientLayout>
      </SessionProvider>
    </AblyProvider>
  )
}

export default ApolloLayout

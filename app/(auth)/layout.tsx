import Header from "@/components/custom/header"
import AppSidebar from "@/components/custom/app-sidebar"
import React from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import RequirePasswordChange from "@/components/custom/layouts/require-password-change"

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <RequirePasswordChange>
      <SidebarProvider className="w-full">
        <AppSidebar />
        <main className="flex flex-1 flex-col">
          <Header />
          <div className="flex-1">{children}</div>
        </main>
      </SidebarProvider>
    </RequirePasswordChange>
  )
}

import Header from "@/components/custom/header"
import AppSidebar from "@/components/custom/app-sidebar"
import React from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import RequirePasswordChange from "@/components/custom/layouts/require-password-change"
import IdleLockScreen from "@/components/custom/layouts/idle-lock-screen"
import RequirePermission from "@/components/custom/layouts/require-permission"
import SearchHotkey from "@/components/custom/search-hotkey"

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <IdleLockScreen>
      <RequirePasswordChange>
        {/* F3 focuses whichever page's search box is on screen. */}
        <SearchHotkey />
        <SidebarProvider className="w-full">
          <AppSidebar />
          <main className="flex flex-1 flex-col">
            <Header />
            <div className="flex-1">
              <RequirePermission>{children}</RequirePermission>
            </div>
          </main>
        </SidebarProvider>
      </RequirePasswordChange>
    </IdleLockScreen>
  )
}

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
          {/* min-w-0 stops wide page content - the register's product type
              strip, a wide table - from stretching this column past the
              viewport and scrolling the whole app sideways. A flex item
              defaults to min-width:auto, which is what let that happen. */}
          {/* h-svh + overflow-hidden caps the app at the viewport so pages
              scroll INSIDE their own regions. Without it the register's
              product grid grew the window itself and pushed the cart's Pay
              button below the fold. */}
          <main className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
            <Header />
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <RequirePermission>{children}</RequirePermission>
            </div>
          </main>
        </SidebarProvider>
      </RequirePasswordChange>
    </IdleLockScreen>
  )
}

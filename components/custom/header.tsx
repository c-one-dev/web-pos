"use client"
import { useSession } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Button } from "../ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { SidebarTrigger } from "../ui/sidebar"
import SwitchUserSheet from "./switch-user-sheet"
import MyProfileSheet from "./my-profile-sheet"
import ChangePasswordDialog from "./change-password-dialog"
import LogoutGuardDialog from "./logout-guard-dialog"

function ProfileMenu() {
  const { data: session }: any = useSession()
  const user = session?.user
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-full space-x-1">
          <Avatar>
            <AvatarImage
              src="https://github.com/shadcn.png"
              alt="@shadcn"
              className="grayscale"
            />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span>{user?.name}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role?.toLowerCase()}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <MyProfileSheet>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Profile
            </DropdownMenuItem>
          </MyProfileSheet>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <SwitchUserSheet>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Switch User
            </DropdownMenuItem>
          </SwitchUserSheet>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Security</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <ChangePasswordDialog>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Change Password
                  </DropdownMenuItem>
                </ChangePasswordDialog>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <LogoutGuardDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Log out
            </DropdownMenuItem>
          </LogoutGuardDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Header() {
  return (
    <div className="sticky flex h-12 w-full items-center justify-between border-b bg-sidebar">
      <SidebarTrigger className="h-full" />
      <div className="flex items-center gap-2 pr-2">
        <ProfileMenu />
      </div>
    </div>
  )
}

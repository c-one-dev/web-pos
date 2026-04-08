import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token

    if (token) {
      return NextResponse.next()
    } else {
      return NextResponse.redirect(new URL("/", req.url))
    }
  },
  {
    pages: {
      signIn: "/",
      signOut: "/",
      error: "/",
    },
    callbacks: {
      authorized: () => true,
    },
  }
)

export const config = {
  matcher: ["/", "/dashboard/:path*", "/user/:path*"],
}

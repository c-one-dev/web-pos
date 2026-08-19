import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

// Page access is decided per-user by permissions now, not by role
// (validators/roleAccessRegistry.ts holds the role defaults, and an
// ADMIN/MANAGER can grant a user more than their role's default through the
// Permissions dialog). This middleware runs on the edge and can't read the
// permission list out of MongoDB, so it only enforces "must be signed in".
//
// The permission side is enforced in two places that CAN see the list:
//   - components/custom/layouts/require-permission.tsx blocks the page
//   - app/graphql/route.ts refuses every field the user isn't allowed
// so a hand-typed URL still gets nothing but an access-denied screen.

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token

    if (!token) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
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
  matcher: [
    "/",
    "/dashboard/:path*",
    "/user/:path*",
    "/brand/:path*",
    "/cash-register/:path*",
    "/product/:path*",
    "/process/:path*",
    "/sale-history/:path*",
    "/product-type/:path*",
    "/payment/:path*",
    "/outlet/:path*",
    "/customer/:path*",
    "/payment-method/:path*",
    "/reports/:path*",
  ],
}

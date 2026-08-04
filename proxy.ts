import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

// Route prefixes CASHIER may not open directly by URL, mirroring the
// GraphQL-level restriction in app/graphql/route.ts (cashierRestrictedFields)
// — that layer blocks the actual data, this one avoids landing on a page
// shell full of failed-query error states in the first place.
const CASHIER_RESTRICTED_PREFIXES = [
  "/reports",
  "/user",
  "/outlet",
  "/brand",
  "/payment-method",
]

// Manager keeps everything Admin has except the Users page — mirrors
// managerRestrictedFields in app/graphql/route.ts.
const MANAGER_RESTRICTED_PREFIXES = ["/user"]

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token

    if (!token) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    const restrictedPrefixes =
      token.role === "CASHIER"
        ? CASHIER_RESTRICTED_PREFIXES
        : token.role === "MANAGER"
          ? MANAGER_RESTRICTED_PREFIXES
          : []

    if (
      restrictedPrefixes.some((prefix) =>
        req.nextUrl.pathname.startsWith(prefix)
      )
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
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

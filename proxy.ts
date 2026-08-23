// proxy.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const AUTH_SECRET =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""

// Auth pages where logged-in users should NOT enter
const AUTH_ROUTES = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
]

// Protected routes requiring a valid session
const PROTECTED_ROUTES = [
    "/dashboard",
    "/creator",
    "/fan",
    "/admin",
    "/onboarding",
]

// Cookie name prefixes for Auth.js / NextAuth
const AUTH_COOKIE_PREFIXES = [
    "authjs.",
    "__Secure-authjs.",
    "__Host-authjs.",
    "next-auth.",
    "__Secure-next-auth.",
    "__Host-next-auth.",
]

// Standard cookie names to always explicitly clear
const STANDARD_AUTH_COOKIES = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
]

/**
 * Checks if the request contains any auth session cookies
 */
function hasSessionCookies(req: NextRequest): boolean {
    const allCookies = req.cookies.getAll()
    return allCookies.some(
        (c) =>
            c.name.includes("session-token") ||
            AUTH_COOKIE_PREFIXES.some((prefix) => c.name.startsWith(prefix))
    )
}

/**
 * Clear all auth session and csrf cookies from response
 */
function clearAuthCookies(req: NextRequest, res: NextResponse): void {
    // 1. Delete all matching cookies present on incoming request (including chunked .0, .1)
    for (const cookie of req.cookies.getAll()) {
        const isAuthCookie =
            cookie.name.includes("session-token") ||
            AUTH_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))

        if (isAuthCookie) {
            res.cookies.set(cookie.name, "", {
                path: "/",
                maxAge: 0,
                expires: new Date(0),
            })
        }
    }

    // 2. Also explicitly clear all standard auth cookie variations
    for (const name of STANDARD_AUTH_COOKIES) {
        res.cookies.set(name, "", {
            path: "/",
            maxAge: 0,
            expires: new Date(0),
        })
    }
}

/**
 * Safely verify session token across environments (HTTP / HTTPS / standard prefixes)
 */
async function verifySessionToken(req: NextRequest) {
    const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"

    try {
        // Try default configuration matching current protocol
        let token = await getToken({
            req,
            secret: AUTH_SECRET,
            secureCookie: isHttps,
        })

        // Fallback: try inverted secureCookie flag (useful for proxy / dev / staging setups)
        if (!token) {
            token = await getToken({
                req,
                secret: AUTH_SECRET,
                secureCookie: !isHttps,
            })
        }

        // Fallback: check legacy next-auth cookie names
        if (!token) {
            token = await getToken({
                req,
                secret: AUTH_SECRET,
                cookieName: isHttps ? "__Secure-next-auth.session-token" : "next-auth.session-token",
            })
        }

        if (token && (token.id || token.sub || token.email)) {
            return { valid: true, token }
        }

        return { valid: false, token: null }
    } catch (err) {
        console.error("[proxy] Error verifying session token:", err)
        return { valid: false, token: null }
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    const isAuthRoute = AUTH_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
    const isProtectedRoute = PROTECTED_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
    )

    const sessionCookiePresent = hasSessionCookies(request)
    let hasValidSession = false
    let isBadSession = false

    if (sessionCookiePresent) {
        const { valid, token } = await verifySessionToken(request)
        if (valid && token) {
            hasValidSession = true
        } else {
            // A session cookie was sent, but it cannot be decoded/verified or is expired
            isBadSession = true
        }
    }

    // ── 1. AUTH ROUTES (/login, /register, etc.) ─────────────────────────────
    if (isAuthRoute) {
        // Logged-in user trying to access /login: redirect to /dashboard
        if (hasValidSession) {
            return NextResponse.redirect(new URL("/dashboard", request.url))
        }

        // Bad session: Auto-delete corrupted cookies and allow fresh login page
        if (isBadSession) {
            const response = NextResponse.next()
            clearAuthCookies(request, response)
            return response
        }

        return NextResponse.next()
    }

    // ── 2. PROTECTED ROUTES (/dashboard, /creator, /fan, /admin, etc.) ──────
    if (isProtectedRoute) {
        // Valid session: allow access
        if (hasValidSession) {
            return NextResponse.next()
        }

        // Bad session: Auto-delete corrupted cookies and redirect to /login
        if (isBadSession) {
            const redirectUrl = new URL("/login", request.url)
            redirectUrl.searchParams.set("callbackUrl", pathname)
            const response = NextResponse.redirect(redirectUrl)
            clearAuthCookies(request, response)
            return response
        }

        // No session: redirect to /login
        const redirectUrl = new URL("/login", request.url)
        redirectUrl.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(redirectUrl)
    }

    // ── 3. ALL OTHER / PUBLIC ROUTES ─────────────────────────────────────────
    // If a bad session cookie exists on any public route, clean it up
    if (isBadSession) {
        const response = NextResponse.next()
        clearAuthCookies(request, response)
        return response
    }

    return NextResponse.next()
}

export default proxy

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes, including NextAuth API)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt
         * - Static media extensions
         */
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|wav|mp3|ogg)$).*)",
    ],
}

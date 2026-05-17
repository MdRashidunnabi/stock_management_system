import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 "proxy" (formerly "middleware").
 *
 * Runs on every navigation that matches the matcher below. Refreshes the
 * Supabase session cookie and redirects unauthenticated users away from
 * protected routes.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/api/health") ||
    // Serwist serves the service worker + helper scripts under /serwist/.
    path.startsWith("/serwist/") ||
    // The PWA manifest must always be reachable, including for unauthenticated users.
    path === "/manifest.webmanifest" ||
    path === "/manifest.json" ||
    path.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimisation)
     *  - favicon.ico, robots.txt, sitemap.xml
     *  - any path with a file extension (.js, .css, .png, ...)
     *  - the Serwist service-worker route
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|serwist|.*\\..*).*)",
  ],
};

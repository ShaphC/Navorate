import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              response.headers.set(key, value);
            });
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();

  const claims = data?.claims;

  const pathname = request.nextUrl.pathname;
  const isAuthenticated = !error && !!claims?.sub;

  // Public pages
  const publicPages = ["/login", "/welcome"];

  const isPublicPage = publicPages.some(
    (page) => pathname === page || pathname === `${page}/`,
  );

  // Public API endpoint for marketing-page access requests
  const isPublicApiRoute = pathname === "/api/access-requests";

  // Other API routes manage authentication independently
  const isApiRoute = pathname.startsWith("/api/");

  // Redirect unauthenticated visitors away from protected pages
  if (!isAuthenticated && !isPublicPage && !isApiRoute && !isPublicApiRoute) {
    const url = request.nextUrl.clone();

    url.pathname = "/login";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  // Redirect authenticated users away from the login page
  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();

    url.pathname = "/";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

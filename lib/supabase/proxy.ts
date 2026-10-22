import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && !!data?.claims?.sub;
  const pathname = request.nextUrl.pathname;
  const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/login/";
  const isApiRoute = pathname.startsWith("/api/"); // API routes enforce their own auth.
  const isStaticRoute = pathname.startsWith("/_next/") || pathname === "/favicon.ico" || /\.[a-zA-Z0-9]+$/.test(pathname);

  function redirectWithCookies(destination: string) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }

  if (!isAuthenticated && !isPublicPage && !isApiRoute && !isStaticRoute) {
    return redirectWithCookies("/login");
  }
  if (isAuthenticated && (pathname === "/login" || pathname === "/login/")) {
    return redirectWithCookies("/dashboard");
  }
  return response;
}

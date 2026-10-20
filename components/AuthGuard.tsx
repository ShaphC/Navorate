"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const isPublicPage = pathname === "/login";

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    setChecking(true);
    setAuthenticated(false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || isPublicPage) return;

      if (!session) {
        setAuthenticated(false);
        setChecking(false);
        router.replace("/login");
      }
    });

    async function checkAuth() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          setAuthenticated(false);

          if (!isPublicPage) {
            router.replace("/login");
          }
        } else {
          setAuthenticated(true);
        }
      } catch {
        if (!active) return;

        setAuthenticated(false);

        if (!isPublicPage) {
          router.replace("/login");
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void checkAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router, isPublicPage]);

  // The login page is publicly accessible.
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Never display the dashboard before authentication succeeds.
  if (checking || !authenticated) {
    return (
      <main
        className="auth-page"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#c5c2d6",
          }}
        >
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          <span>Checking your session...</span>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

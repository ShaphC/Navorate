"use client";

import { useEffect, useRef, useState } from "react";
import { Home, LogOut, Loader2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log out.");
      setLoggingOut(false);
    }
  }

  return (
    <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" className="avatar" aria-label="Account menu" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((previous) => !previous)}>
        {email?.charAt(0).toUpperCase() || "M"}
      </button>
      {open && (
        <div role="menu" className="account-dropdown" style={{ position: "absolute", top: "calc(100% + 12px)", right: 0, width: 245, padding: 8, background: "#17172b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, boxShadow: "0 18px 45px rgba(0,0,0,0.35)", zIndex: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 6 }}>
            <UserRound size={18} color="#a7a1c6" />
            <span style={{ fontSize: 12, color: "#c5c2d6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email ?? undefined}>{email || "My account"}</span>
          </div>
          <a href="/" role="menuitem" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 10px", borderRadius: 8, color: "#e5e0f5", textDecoration: "none", fontSize: 14 }}>
            <Home size={17} /> Home
          </a>
          <button type="button" role="menuitem" disabled={loggingOut} onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 10px", background: "transparent", border: 0, borderRadius: 8, color: "#f2d4dc", cursor: loggingOut ? "wait" : "pointer", textAlign: "left", fontSize: 14 }}>
            {loggingOut ? <Loader2 size={17} /> : <LogOut size={17} />}
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
          {error && <p role="alert" style={{ color: "#ff9b9b", fontSize: 12, padding: "0 10px" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

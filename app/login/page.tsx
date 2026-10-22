"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Film, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const REMEMBER_EMAIL_KEY = "mymedia_remembered_email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestMode, setRequestMode] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRequestMode(new URLSearchParams(window.location.search).get("mode") === "request");
  }, []);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Storage may be unavailable in some browsers.
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim();
      const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      try {
        if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
        else localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {
        // Login should still work if storage is unavailable.
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function requestBetaAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setRequestStatus("idle");
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), website }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to send request.");
      setRequestStatus("success");
      setMessage("You're on the list! We'll be in touch about beta access.");
      setName("");
      setWebsite("");
    } catch (error) {
      setRequestStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setRequestMode((previous) => !previous);
    setMessage("");
    setRequestStatus("idle");
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, color: "inherit", textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={16} /> Home
        </Link>
        <div className="auth-brand"><Film size={30} /><span>MyMedia</span></div>
        <h1>{requestMode ? "Request beta access" : "Welcome back"}</h1>
        <p>{requestMode ? "MyMedia is currently invite-only. Join the beta waitlist and we'll reach out when a spot is available." : "Sign in to your MyMedia beta account."}</p>
        {requestMode ? (
          <form onSubmit={requestBetaAccess}>
            <label>Your name
              <div className="auth-field"><UserRound size={17} />
                <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" maxLength={100} required />
              </div>
            </label>
            <label>Email address
              <div className="auth-field"><Mail size={17} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required />
              </div>
            </label>
            <div aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
              <label htmlFor="beta-website">Website</label>
              <input id="beta-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </div>
            {message && <div className="auth-message" role="status" style={requestStatus === "success" ? { color: "#86efac" } : undefined}>{message}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={loading || requestStatus === "success"}>
              {loading ? "Sending request..." : requestStatus === "success" ? "Request sent" : "Request beta access"}
            </button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <label>Email address
              <div className="auth-field"><Mail size={17} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </div>
            </label>
            <label>Password
              <div className="auth-field"><LockKeyhole size={17} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={6} required />
              </div>
            </label>
            <div className="auth-remember" style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10, marginTop: 14, marginBottom: 18 }}>
              <input id="remember-email" type="checkbox" checked={rememberMe} onChange={(event) => {
                const checked = event.target.checked;
                setRememberMe(checked);
                if (!checked) { try { localStorage.removeItem(REMEMBER_EMAIL_KEY); } catch { /* Ignore unavailable storage. */ } }
              }} style={{ width: 16, height: 16, flexShrink: 0, margin: 0, accentColor: "#8b5cf6", cursor: "pointer" }} />
              <label htmlFor="remember-email" style={{ display: "inline", width: "auto", margin: 0, fontSize: 13, fontWeight: 400, lineHeight: "16px", cursor: "pointer" }}>Remember my email address</label>
            </div>
            {message && <div className="auth-message" role="status">{message}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? "Please wait..." : "Sign in"}</button>
          </form>
        )}
        <button type="button" className="auth-switch" onClick={switchMode}>
          {requestMode ? "Already have an account? Sign in" : "New to MyMedia? Request beta access"}
        </button>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const REMEMBER_EMAIL_KEY = "mymedia_remembered_email";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim();

      const result = register
        ? await supabase.auth.signUp({
            email: normalizedEmail,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      // Remember only the email address.
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        // Login should still work if storage is unavailable.
      }

      if (register && !result.data.session) {
        setMessage("Check your email to confirm your account.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Film size={30} />
          <span>MyMedia</span>
        </div>

        <h1>{register ? "Create your account" : "Welcome back"}</h1>
        <p>Your personal entertainment library.</p>

        <form onSubmit={submit}>
          <label>
            Email address
            <div className="auth-field">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label>
            Password
            <div className="auth-field">
              <LockKeyhole size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={register ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>
          </label>

          <div
            className="auth-remember"
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 10,
              marginTop: 14,
              marginBottom: 18,
            }}
          >
            <input
              id="remember-email"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => {
                const checked = event.target.checked;
                setRememberMe(checked);

                if (!checked) {
                  try {
                    localStorage.removeItem(REMEMBER_EMAIL_KEY);
                  } catch {
                    // Ignore unavailable storage.
                  }
                }
              }}
              style={{
                width: 16,
                height: 16,
                flexShrink: 0,
                margin: 0,
                accentColor: "#8b5cf6",
                cursor: "pointer",
              }}
            />

            <label
              htmlFor="remember-email"
              style={{
                display: "inline",
                width: "auto",
                margin: 0,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: "16px",
                cursor: "pointer",
              }}
            >
              Remember my email address
            </label>
          </div>

          {message && <div className="auth-message">{message}</div>}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : register
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setRegister(!register);
            setMessage("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "First time here? Create an account"}
        </button>
      </div>
    </main>
  );
}

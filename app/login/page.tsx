"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const result = register
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({
          email,
          password,
        });

    if (result.error) {
      setMessage(result.error.message);
    } else if (register && !result.data.session) {
      setMessage("Check your email to confirm your account.");
    } else {
      router.replace("/");
      router.refresh();
    }

    setLoading(false);
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          </label>

          {message && <div className="auth-message">{message}</div>}

          <button className="primary-button auth-submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : register
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <button
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

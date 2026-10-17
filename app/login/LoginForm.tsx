"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const router = useRouter();
  const mode = initialMode;
  const lock = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setLoading(true); setError("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim() || email, email, password, callbackURL: "/onboarding" })
        : await authClient.signIn.email({ email, password, callbackURL: "/dashboard" });
      if (result.error) { setError(result.error.message || "Could not sign in. Please try again."); return; }
      router.push(mode === "signup" ? "/onboarding" : "/dashboard"); router.refresh();
    } catch { setError("Could not connect. Your details are still here. Please try again."); }
    finally { lock.current = false; setLoading(false); }
  }
  const inputClass = "min-h-12 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent";
  return <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" aria-busy={loading}>
    {mode === "signup" ? <label className="flex flex-col gap-2"><span>Your name</span><input autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={inputClass} /></label> : null}
    <label className="flex flex-col gap-2"><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className={inputClass} /></label>
    <div className="flex flex-col gap-2"><label htmlFor="auth-password">Password</label><div className="password-control"><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} aria-describedby={mode === "signup" ? "password-hint" : undefined} value={password} onChange={event => setPassword(event.target.value)} className={inputClass} /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide" : "Show"}</button></div>{mode === "signup" ? <small id="password-hint" className="field-hint">Use at least 8 characters.</small> : null}</div>
    {error ? <p className="text-warn" role="alert">{error}</p> : null}
    <button type="submit" disabled={loading} className="button button-primary">{loading ? mode === "signup" ? "Creating account…" : "Signing in…" : mode === "signup" ? "Create account" : "Sign in"}</button>
  </form>;
}

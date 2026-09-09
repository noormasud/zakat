"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { emailFor } from "@/lib/types";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailFor(username),
      password,
    });

    if (error) {
      setBusy(false);
      setError("That username and password do not match an account.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-5 py-12">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <h1 className="font-medium tracking-tight text-[2.1rem] leading-tight">Zakat Tracker</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Sign in to pick up where your ledger left off.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-semibold">
            Username
          </label>
          <input
            id="username"
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <p className="text-[14px]" style={{ color: "var(--pend)" }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--solid w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-[15px] text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-ink underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}

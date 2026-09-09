"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import Loader from "@/components/Loader";
import { emailFor } from "@/lib/types";

const NAME_RULE = /^[a-z0-9_]{3,24}$/;

type NameState = "empty" | "invalid" | "checking" | "free" | "taken";

export default function SignUp() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nameState, setNameState] = useState<NameState>("empty");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Check availability as they type, so the permanence of the choice is
  // never a surprise at submit time.
  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value) return setNameState("empty");
    if (!NAME_RULE.test(value)) return setNameState("invalid");

    setNameState("checking");
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", {
        candidate: value,
      });
      if (error) return setNameState("invalid");
      setNameState(data ? "free" : "taken");
    }, 350);

    return () => clearTimeout(timer);
  }, [username, supabase]);

  const mismatch = confirm.length > 0 && password !== confirm;
  const ready =
    name.trim().length > 0 &&
    nameState === "free" &&
    password.length >= 8 &&
    password === confirm &&
    !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);

    const handle = username.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: emailFor(handle),
      password,
      options: { data: { username: handle, display_name: name.trim() } },
    });

    if (error) {
      setBusy(false);
      setError(
        /already/i.test(error.message)
          ? "That username is taken. Pick another one."
          : error.message
      );
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  const nameNote: Record<NameState, string> = {
    empty: "3–24 characters. Lowercase letters, numbers and underscores.",
    invalid: "Use 3–24 lowercase letters, numbers or underscores.",
    checking: "Checking…",
    free: `${username.trim().toLowerCase()} is available.`,
    taken: "Taken. Try a different one.",
  };

  return (
    <main className="page page--auth">
      <div className="theme-corner"><ThemeToggle /></div>
      <h1 className="font-medium tracking-tight text-[2.1rem] leading-tight">
        Start your ledger
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        One account, one running record of what you owe and what you have given.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
            Your name
          </label>
          <input
            id="name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            maxLength={40}
            required
          />
          <p className="mt-1.5 text-[13px] text-muted">
            What the app calls you. Change it any time in settings.
          </p>
        </div>

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
          <p
            className="mt-1.5 text-[13px]"
            style={{
              color:
                nameState === "taken" || nameState === "invalid"
                  ? "var(--pend)"
                  : nameState === "free"
                  ? "var(--ok)"
                  : "var(--muted)",
            }}
          >
            {nameNote[nameState]}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            This is permanent — it cannot be changed later.
          </p>
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
            autoComplete="new-password"
            required
          />
          <p className="mt-1.5 text-[13px] text-muted">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            className="field"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {mismatch && (
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--pend)" }}>
              The two passwords do not match.
            </p>
          )}
        </div>

        {error && (
          <p className="text-[14px]" style={{ color: "var(--pend)" }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--solid w-full" disabled={!ready}>
          {busy ? <Loader variant="inline" /> : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-[15px] text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-ink underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

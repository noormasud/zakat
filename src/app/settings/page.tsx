"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { longDate } from "@/lib/format";

const SERVICE_ACCOUNT =
  process.env.NEXT_PUBLIC_GOOGLE_SA_EMAIL ?? "your-service-account@…iam.gserviceaccount.com";

/** Accepts a full Sheets URL or a bare ID and returns the ID. */
function toSheetId(input: string) {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (match ? match[1] : input).trim();
}

export default function Settings() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sheet, setSheet] = useState("");
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwNote, setPwNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .single();
      setProfile(data as Profile);
      setSheet(data?.sheet_id ?? "");
    })();
  }, [supabase, router]);

  async function saveSheet() {
    const id = sheet ? toSheetId(sheet) : null;
    await supabase.from("profiles").update({ sheet_id: id }).eq("id", profile!.id);
    setSheet(id ?? "");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function changePassword() {
    if (password.length < 8) return setPwNote("Use at least 8 characters.");
    if (password !== confirm) return setPwNote("The two passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password });
    setPwNote(error ? error.message : "Password changed.");
    setPassword("");
    setConfirm("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-[34rem] px-5 py-16">
        <p className="text-[15px] text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[34rem] px-5 pb-24 pt-6">
      <Link href="/dashboard" className="text-[14px] underline">
        Back to ledger
      </Link>

      <h1 className="mt-5 font-medium tracking-tight text-[2rem] leading-tight">Settings</h1>

      <section className="rule mt-7 pt-6">
        <h2 className="font-medium tracking-tight text-[1.3rem]">Account</h2>
        <p className="mt-2 text-[15px]">
          <span className="text-muted">Username</span>{" "}
          <span className="font-semibold">{profile.username}</span>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Permanent, and unique to you.
          {profile.year_start
            ? ` Your first Zakat year began ${longDate(profile.year_start)}.`
            : ""}
        </p>
      </section>

      <section className="rule mt-7 pt-6">
        <h2 className="font-medium tracking-tight text-[1.3rem]">Mirror to a Google Sheet</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Every entry you record is written to your own spreadsheet within a few
          seconds. Edits and deletions are mirrored too.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-muted">
          <li>Create a Google Sheet.</li>
          <li>
            Share it, with Editor access, to{" "}
            <span className="break-all font-semibold text-ink">{SERVICE_ACCOUNT}</span>
          </li>
          <li>Paste the sheet link below.</li>
        </ol>

        <input
          className="field mt-4"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button className="btn btn--solid" onClick={saveSheet}>
            Save sheet
          </button>
          {sheet && (
            <button
              className="text-[14px] underline"
              onClick={() => {
                setSheet("");
                supabase.from("profiles").update({ sheet_id: null }).eq("id", profile.id);
              }}
            >
              Disconnect
            </button>
          )}
          {saved && (
            <span className="text-[14px]" style={{ color: "var(--ok)" }}>
              Saved
            </span>
          )}
        </div>
      </section>

      <section className="rule mt-7 pt-6">
        <h2 className="font-medium tracking-tight text-[1.3rem]">Change password</h2>
        <div className="mt-3 space-y-3">
          <input
            className="field"
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button className="btn btn--solid w-full" onClick={changePassword}>
            Change password
          </button>
          {pwNote && <p className="text-[14px] text-muted">{pwNote}</p>}
        </div>
      </section>

      <section className="rule mt-7 pt-6">
        <button className="btn btn--quiet w-full" onClick={signOut}>
          Sign out
        </button>
      </section>
    </main>
  );
}

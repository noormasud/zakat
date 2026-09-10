"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { emailFor, type Profile } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";
import Loader from "@/components/Loader";

const SERVICE_ACCOUNT =
  process.env.NEXT_PUBLIC_GOOGLE_SA_EMAIL ??
  "your-service-account@…iam.gserviceaccount.com";

/**
 * The mirror only appears once the Edge Function is actually deployed.
 * Set NEXT_PUBLIC_SHEETS_SYNC=on to switch it back on — the database
 * column, the function and the settings panel are all still here.
 */
const SHEETS_SYNC_ENABLED = process.env.NEXT_PUBLIC_SHEETS_SYNC === "on";

/** Accepts a full Sheets URL or a bare ID and returns the ID. */
function toSheetId(input: string) {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (match ? match[1] : input).trim();
}

export default function Settings() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [nameNote, setNameNote] = useState<string | null>(null);
  const [sheet, setSheet] = useState("");
  const [sheetNote, setSheetNote] = useState<string | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwNote, setPwNote] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

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
      setName(data?.display_name ?? "");
      setSheet(data?.sheet_id ?? "");
    })();
  }, [supabase, router]);

  async function saveName() {
    if (!profile) return;
    const value = name.trim();
    if (!value) return setNameNote("Enter a name.");
    await supabase
      .from("profiles")
      .update({ display_name: value })
      .eq("id", profile.id);
    setProfile({ ...profile, display_name: value });
    setNameNote("Saved.");
    setTimeout(() => setNameNote(null), 2500);
  }

  async function saveSheet() {
    if (!profile) return;
    const id = sheet ? toSheetId(sheet) : null;
    await supabase.from("profiles").update({ sheet_id: id }).eq("id", profile.id);
    setSheet(id ?? "");
    setSheetNote(id ? "Saved." : "Disconnected.");
    setTimeout(() => setSheetNote(null), 2500);
  }

  /**
   * Supabase will change a password for anyone holding a live session, so it
   * never asks for the old one. We re-authenticate first, otherwise a stranger
   * at an unlocked laptop could lock the owner out.
   */
  async function changePassword() {
    if (!profile) return;
    setPwOk(false);

    if (!current) return setPwNote("Enter your current password.");
    if (next.length < 8) return setPwNote("The new password needs at least 8 characters.");
    if (next !== confirm) return setPwNote("The two new passwords do not match.");
    if (next === current) return setPwNote("That is already your password.");

    setPwBusy(true);
    const { error: wrong } = await supabase.auth.signInWithPassword({
      email: emailFor(profile.username),
      password: current,
    });

    if (wrong) {
      setPwBusy(false);
      return setPwNote("That is not your current password.");
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setPwBusy(false);

    if (error) return setPwNote(error.message);

    setCurrent("");
    setNext("");
    setConfirm("");
    setPwOk(true);
    setPwNote("Password changed.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!profile) {
    return (
      <main><Loader /></main>
    );
  }

  return (
    <main className="page">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-[13px] text-muted hover:text-ink">
          ‹ Back
        </Link>
        <ThemeToggle />
      </div>

      <h1 className="mt-5 text-[1.75rem] font-medium tracking-tight">Settings</h1>

      <section className="rule mt-7 pt-6">
        <h2 className="text-[1.05rem] font-medium">Your name</h2>
        <p className="mt-1.5 text-[13px] text-muted">
          What the app calls you at the top of the ledger.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="field"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn--solid whitespace-nowrap" onClick={saveName}>
            Save name
          </button>
        </div>
        {nameNote && <p className="mt-2 text-[13px] text-muted">{nameNote}</p>}
      </section>

      <section className="rule mt-7 pt-6">
        <h2 className="text-[1.05rem] font-medium">Username</h2>
        <p className="mt-1.5 text-[15px] font-medium">{profile.username}</p>
        <p className="mt-1 text-[13px] text-muted">
          This is how you sign in. It is permanent and cannot be changed.
        </p>
      </section>

      {SHEETS_SYNC_ENABLED && (
        <section className="rule mt-7 pt-6">
          <h2 className="text-[1.05rem] font-medium">Mirror to a Google Sheet</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Every entry you record is written to your own spreadsheet within a few
            seconds. Edits and deletions are mirrored too.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted">
            <li>Create a Google Sheet.</li>
            <li>
              Share it, with Editor access, to{" "}
              <span className="break-all font-medium text-ink">{SERVICE_ACCOUNT}</span>
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
                className="text-[13px] text-muted hover:text-ink"
                onClick={() => {
                  setSheet("");
                  saveSheet();
                }}
              >
                Disconnect
              </button>
            )}
            {sheetNote && (
              <span className="text-[13px]" style={{ color: "var(--ok)" }}>
                {sheetNote}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="rule mt-7 pt-6">
        <h2 className="text-[1.05rem] font-medium">Change password</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="cur">
              Current password
            </label>
            <input
              id="cur"
              className="field"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="new">
              New password
            </label>
            <input
              id="new"
              className="field"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="conf">
              Confirm new password
            </label>
            <input
              id="conf"
              className="field"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button
            className="btn btn--solid w-full"
            onClick={changePassword}
            disabled={pwBusy}
          >
            {pwBusy ? <Loader variant="inline" /> : "Change password"}
          </button>
          {pwNote && (
            <p
              className="text-[13px]"
              style={{ color: pwOk ? "var(--ok)" : "var(--pend)" }}
            >
              {pwNote}
            </p>
          )}
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

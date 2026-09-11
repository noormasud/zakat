"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { emailFor, type Payment, type Profile, type ZakatYear } from "@/lib/types";
import { longDate } from "@/lib/format";
import { downloadWorkbook } from "@/lib/excel";
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

  const [years, setYears] = useState<ZakatYear[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [earliest, setEarliest] = useState<ZakatYear | null>(null);
  const [prevStart, setPrevStart] = useState("");
  const [prevDue, setPrevDue] = useState("");
  const [prevPaid, setPrevPaid] = useState("");
  const [prevNote, setPrevNote] = useState<string | null>(null);
  const [prevBusy, setPrevBusy] = useState(false);

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

      const [{ data: yrs }, { data: pays }] = await Promise.all([
        supabase.from("zakat_years").select("*").order("start_date"),
        supabase.from("payments").select("*").order("paid_on"),
      ]);

      const list = (yrs ?? []) as ZakatYear[];
      setYears(list);
      setPayments((pays ?? []) as Payment[]);

      const first = list[0];
      if (first) {
        setEarliest(first);
        const before = new Date(`${first.start_date}T00:00:00`);
        before.setDate(before.getDate() - 365);
        setPrevStart(before.toLocaleDateString("en-CA"));
      }
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

  /** Adds a year immediately before the earliest one on record. */
  async function addEarlierYear() {
    const due = Number(prevDue.replace(/[^\d]/g, "")) || 0;
    const paid = Number(prevPaid.replace(/[^\d]/g, "")) || 0;
    if (!prevStart) return setPrevNote("Pick the date that year started.");

    const clash = years.find(
      (y) => prevStart >= y.start_date && prevStart <= y.end_date
    );
    if (clash) {
      return setPrevNote(
        `That date already falls inside the year running ${longDate(
          clash.start_date
        )} to ${longDate(clash.end_date)}. You can change its figures from the ledger — switch to it using the date under your name, then edit the amount due or its entries.`
      );
    }

    const overlapsAfter = years.find((y) => {
      const end = new Date(
        new Date(`${prevStart}T00:00:00`).getTime() + 364 * 86400000
      ).toLocaleDateString("en-CA");
      return y.start_date >= prevStart && y.start_date <= end;
    });
    if (overlapsAfter) {
      return setPrevNote(
        `A year starting then would run into the one that begins ${longDate(
          overlapsAfter.start_date
        )}. Choose an earlier date.`
      );
    }

    if (due === 0 && paid === 0) return setPrevNote("Enter what was due, what was paid, or both.");

    setPrevBusy(true);
    const { error } = await supabase.rpc("add_previous_year", {
      p_start: prevStart,
      p_due: due,
      p_paid: paid,
    });
    setPrevBusy(false);

    if (error) return setPrevNote(error.message);
    setPrevDue("");
    setPrevPaid("");
    setPrevNote("Added. It will appear in the year list on your ledger.");
    router.refresh();
  }

  function exportExcel() {
    if (!profile) return;
    downloadWorkbook(
      profile.display_name || profile.username,
      years.map((year) => ({
        year,
        payments: payments
          .filter((p) => p.year_id === year.id)
          .sort((a, b) => a.paid_on.localeCompare(b.paid_on)),
      }))
    );
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
        <div className="inline-row mt-3">
          <input
            className="field"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn--solid btn--inline" onClick={saveName}>
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
        <h2 className="text-[1.05rem] font-medium">Export</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          An Excel workbook with a summary, every entry across all years, and a
          tab for each year on its own.
        </p>
        <button className="btn btn--quiet mt-3 w-full" onClick={exportExcel}>
          Download spreadsheet
        </button>
      </section>

      <section className="rule mt-7 pt-6">
        <h2 className="text-[1.05rem] font-medium">Add an earlier year</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          For years before you started using this app. A shortfall is added to
          what the following year owes; an excess counts as already given
          against it.
        </p>

        <div className="mt-3">
          <label className="label" htmlFor="prev-start">
            That year started on
          </label>
          <input
            id="prev-start"
            type="date"
            className="field"
            value={prevStart}
            max={earliest ? earliest.start_date : undefined}
            onChange={(e) => setPrevStart(e.target.value)}
          />
          <p className="mt-1.5 text-[12px] text-muted">
            {prevStart
              ? `Runs to ${longDate(
                  new Date(
                    new Date(`${prevStart}T00:00:00`).getTime() + 364 * 86400000
                  ).toLocaleDateString("en-CA")
                )}.`
              : "Pick a date."}
            {earliest
              ? ` It has to finish before your current earliest year, which starts ${longDate(
                  earliest.start_date
                )}.`
              : ""}
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="prev-due">
              Zakat that was due
            </label>
            <input
              id="prev-due"
              className="field"
              inputMode="numeric"
              placeholder="0"
              value={prevDue}
              onChange={(e) => setPrevDue(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div>
            <label className="label" htmlFor="prev-paid">
              Amount already paid
            </label>
            <input
              id="prev-paid"
              className="field"
              inputMode="numeric"
              placeholder="0"
              value={prevPaid}
              onChange={(e) => setPrevPaid(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>

        <button
          className="btn btn--solid mt-3 w-full"
          onClick={addEarlierYear}
          disabled={prevBusy}
        >
          {prevBusy ? <Loader variant="inline" /> : "Add the year"}
        </button>
        {prevNote && <p className="mt-2 text-[13px] text-muted">{prevNote}</p>}
      </section>

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

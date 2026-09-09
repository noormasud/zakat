"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Payment, Profile, ZakatYear } from "@/lib/types";
import { rupees, plainNumber, longDate, yearRange, yearTag, todayIso } from "@/lib/format";
import { downloadWorkbook } from "@/lib/excel";
import { describeDevice } from "@/lib/device";
import YearMeter from "@/components/YearMeter";
import AddEntry from "@/components/AddEntry";
import EntryList from "@/components/EntryList";
import ThemeToggle from "@/components/ThemeToggle";
import Loader from "@/components/Loader";

export default function Dashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [years, setYears] = useState<ZakatYear[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rolledOver, setRolledOver] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return router.replace("/login");

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .single();
    setProfile(prof as Profile);

    if (prof?.year_start) {
      const { data: created } = await supabase.rpc("ensure_current_year");
      if (created && created > 0) setRolledOver(created);
    }

    const [{ data: yrs }, { data: pays }] = await Promise.all([
      supabase.from("zakat_years").select("*").order("year_number", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
    ]);

    setYears((yrs ?? []) as ZakatYear[]);
    setPayments((pays ?? []) as Payment[]);
    setLoading(false);
    return yrs as ZakatYear[] | null;
  }, [supabase, router]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayIso();
  const currentYear =
    years.find((y) => today >= y.start_date && today <= y.end_date) ?? years[0];
  const selected = years.find((y) => y.id === selectedId) ?? currentYear;
  const isCurrent = !!selected && selected.id === currentYear?.id;
  const isClosed = !!selected && selected.end_date < today;

  const yearPayments = useMemo(
    () =>
      payments
        .filter((p) => p.year_id === selected?.id)
        // Newest entry first, so whatever you just recorded is at the top.
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [payments, selected]
  );
  const given = yearPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  async function addPayment(entry: {
    amount: number;
    paid_on: string;
    description: string | null;
  }) {
    if (!selected || !profile) return;
    const { data, error } = await supabase
      .from("payments")
      .insert({
        ...entry,
        year_id: selected.id,
        user_id: profile.id,
        device: describeDevice(),
      })
      .select()
      .single();

    if (!error && data) setPayments((prev) => [data as Payment, ...prev]);
  }

  async function deletePayment(id: string) {
    await supabase.from("payments").delete().eq("id", id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  async function editNote(id: string, note: string) {
    await supabase.from("payments").update({ description: note || null }).eq("id", id);
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description: note || null } : p))
    );
  }

  async function saveDue() {
    const value = Number(dueDraft.replace(/[^\d]/g, ""));
    if (Number.isNaN(value)) return;
    await supabase.rpc("set_due_amount", { p_amount: value });
    setEditingDue(false);
    await load();
  }

  function exportExcel() {
    if (!profile) return;
    downloadWorkbook(
      profile.display_name || profile.username,
      [...years]
        .sort((a, b) => a.year_number - b.year_number)
        .map((year) => ({
          year,
          payments: payments
            .filter((p) => p.year_id === year.id)
            .sort((a, b) => a.paid_on.localeCompare(b.paid_on)),
        }))
    );
  }

  if (loading) {
    return (
      <main><Loader /></main>
    );
  }

  if (profile && !profile.year_start) {
    return (
      <Onboarding who={profile.display_name || profile.username} onDone={load} />
    );
  }

  return (
    <main className="page">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium sm:text-[18px]">
            {profile?.display_name || profile?.username}
          </p>
          {selected && (
            <p className="mt-0.5 text-[11px] text-muted sm:text-[12px]">
              Zakat year · {yearRange(selected.start_date, selected.end_date)}
            </p>
          )}
        </div>
        <nav className="flex shrink-0 items-center gap-3.5 text-[13px] text-muted">
          <ThemeToggle />
          <button onClick={exportExcel} className="hover:text-ink">
            Export
          </button>
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-raised text-[12px] font-medium text-ink"
          >
            {(profile?.display_name || profile?.username || "?")
              .charAt(0)
              .toUpperCase()}
          </Link>
        </nav>
      </header>

      {rolledOver > 0 && (
        <div
          className="mt-5 border-l-[3px] bg-raised px-4 py-3"
          style={{ borderColor: "var(--pend)" }}
          role="status"
        >
          <p className="text-[15px] font-semibold">
            {rolledOver === 1
              ? "A new Zakat year has started."
              : `${rolledOver} Zakat years have passed since you last checked in.`}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Your new year runs to {longDate(currentYear?.end_date ?? "")}. The
            year before is kept exactly as it closed.
          </p>
          <button
            onClick={() => setRolledOver(0)}
            className="mt-2 text-[14px] underline"
          >
            Got it
          </button>
        </div>
      )}

      {years.length > 1 && (
        <div className="mt-6">
          <label htmlFor="year" className="mb-1.5 block text-sm font-semibold">
            Showing
          </label>
          <select
            id="year"
            className="field"
            value={selected?.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {yearTag(y.start_date, y.end_date)} — {yearRange(y.start_date, y.end_date)}
                {y.id === currentYear?.id ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-7">
        {selected && (
          <YearMeter year={selected} given={given} isCurrent={isCurrent} />
        )}
      </div>

      <div className="rule mt-7 pt-5">
        {editingDue ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field"
              inputMode="numeric"
              autoFocus
              placeholder="Total Zakat due"
              value={dueDraft}
              onChange={(e) => setDueDraft(e.target.value.replace(/[^\d]/g, ""))}
            />
            <div className="flex gap-2">
              <button className="btn btn--solid flex-1 whitespace-nowrap" onClick={saveDue}>
                Save amount
              </button>
              <button className="btn btn--quiet" onClick={() => setEditingDue(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px]">
              <span className="text-muted">Zakat due this year</span>{" "}
              <span className="tabular font-semibold">
                {rupees(Number(selected?.due_amount ?? 0))}
              </span>
            </p>
            {!isClosed && (
              <button
                className="shrink-0 text-[14px] underline"
                onClick={() => {
                  setDueDraft(String(Math.round(Number(selected?.due_amount ?? 0))));
                  setEditingDue(true);
                }}
              >
                Change
              </button>
            )}
          </div>
        )}

        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {isClosed
            ? "This year has closed. Its figures stay as they were."
            : "Changing this updates the year in progress and every year after it. Closed years keep the amount they finished on."}
        </p>
      </div>

      {selected && (
        <div className="mt-8">
          <AddEntry year={selected} onSave={addPayment} />
        </div>
      )}

      <div className="mt-10">
        <EntryList
          payments={yearPayments}
          onDelete={deletePayment}
          onEditNote={editNote}
        />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Onboarding({
  who,
  onDone,
}: {
  who: string;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [start, setStart] = useState(todayIso());
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const end = new Date(new Date(`${start}T00:00:00`).getTime() + 364 * 86400000);

  async function begin() {
    setBusy(true);
    await supabase.rpc("start_tracking", {
      p_start: start,
      p_due: Number(due.replace(/[^\d]/g, "")) || 0,
    });
    onDone();
  }

  return (
    <main className="page page--auth">
      <h1 className="font-medium tracking-tight text-[2rem] leading-tight">
        Set up your Zakat year, {who}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Two things and you are done. Both can be adjusted later.
      </p>

      <div className="mt-8 space-y-5">
        <div>
          <label htmlFor="start" className="mb-1.5 block text-sm font-semibold">
            My Zakat year starts on
          </label>
          <input
            id="start"
            type="date"
            className="field"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <p className="mt-1.5 text-[13px] text-muted">
            Year 1 will run to {longDate(end.toLocaleDateString("en-CA"))}.
          </p>
        </div>

        <div>
          <label htmlFor="due" className="mb-1.5 block text-sm font-semibold">
            Total Zakat due this year
          </label>
          <input
            id="due"
            className="field"
            inputMode="numeric"
            placeholder="e.g. 250000"
            value={due ? plainNumber(Number(due)) : ""}
            onChange={(e) => setDue(e.target.value.replace(/[^\d]/g, ""))}
          />
          <p className="mt-1.5 text-[13px] text-muted">
            In rupees. Leave it at zero if you have not worked it out yet.
          </p>
        </div>

        <button className="btn btn--solid w-full" onClick={begin} disabled={busy}>
          {busy ? <Loader variant="inline" /> : "Open my ledger"}
        </button>
      </div>
    </main>
  );
}

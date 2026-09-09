"use client";

import { useEffect, useRef, useState } from "react";
import { plainNumber, rupees, shortAmount, todayIso } from "@/lib/format";
import type { ZakatYear } from "@/lib/types";

const DENOMINATIONS = [5000, 10000, 15000, 20000, 50000, 100000];

type Draft = { amount: number; paid_on: string; description: string | null };

/**
 * Pills build the amount. On a phone, the amount row opens a bottom sheet
 * holding the date and an optional note; on wider screens those same two
 * fields sit inline and there is no sheet at all.
 */
export default function AddEntry({
  year,
  onSave,
}: {
  year: ZakatYear;
  onSave: (entry: Draft) => Promise<void>;
}) {
  const today = todayIso();
  const withinYear = today >= year.start_date && today <= year.end_date;
  const defaultDate = withinYear ? today : year.end_date;

  const [amount, setAmount] = useState(0);
  const [paidOn, setPaidOn] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const sheetAmount = useRef<HTMLInputElement>(null);

  // Lock the page behind the sheet and let Escape dismiss it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function bump(value: number) {
    setAmount((a) => a + value);
    setError(false);
    setFlash(value);
    setTimeout(() => setFlash(null), 170);
  }

  function typeAmount(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    setAmount(digits ? Number(digits) : 0);
    if (digits) setError(false);
  }

  async function commit() {
    if (amount <= 0) return setError(true);
    if (busy) return;
    setBusy(true);
    try {
      await onSave({ amount, paid_on: paidOn, description: note.trim() || null });
      setAmount(0);
      setNote("");
      setPaidOn(defaultDate);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const dateAndNote = (idPrefix: string) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor={`${idPrefix}-date`}>
          Date given
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          className="field"
          value={paidOn}
          min={year.start_date}
          max={year.end_date}
          onChange={(e) => setPaidOn(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-note`}>
          Who it went to (optional)
        </label>
        <input
          id={`${idPrefix}-note`}
          className="field"
          placeholder="Edhi Foundation"
          maxLength={140}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <section>
      <p className="label">Add an amount</p>

      <div className="flex flex-wrap gap-2">
        {DENOMINATIONS.map((d) => (
          <button
            key={d}
            type="button"
            className="pill"
            data-on={flash === d}
            onClick={() => bump(d)}
          >
            {shortAmount(d)}
          </button>
        ))}
      </div>

      {/* phone: tap through to the sheet */}
      <button
        type="button"
        className="amt-row mt-3.5 sm:hidden"
        onClick={() => {
          setOpen(true);
          setTimeout(() => sheetAmount.current?.focus(), 340);
        }}
      >
        <span className="flex-1 text-[14px] text-muted">Amount</span>
        <span
          className="tabular text-[18px] font-medium"
          style={{ color: amount ? "var(--fg)" : "var(--dim)" }}
        >
          {rupees(amount)}
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </button>

      {/* wider screens: everything stays on the page */}
      <div className="mt-3.5 hidden sm:block">
        <div className="amt-row">
          <span className="text-[18px] text-muted">Rs</span>
          <input
            className="bare tabular text-[26px]"
            inputMode="numeric"
            placeholder="0"
            aria-label="Amount given"
            value={amount ? plainNumber(amount) : ""}
            onChange={(e) => typeAmount(e.target.value)}
          />
          {amount > 0 && (
            <button
              type="button"
              className="shrink-0 text-[13px] text-muted hover:text-ink"
              onClick={() => setAmount(0)}
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-3">{dateAndNote("web")}</div>
        {error && <p className="err mt-2">Add an amount first</p>}
        <button
          type="button"
          className="btn btn--solid mt-3 w-full"
          onClick={commit}
          disabled={busy}
        >
          {busy ? "Saving…" : "Record entry"}
        </button>
      </div>

      {/* the sheet itself — never rendered on desktop */}
      <div className="sm:hidden">
        <div
          className="scrim"
          data-open={open}
          onClick={() => setOpen(false)}
          aria-hidden={!open}
        />
        <div
          className="sheet"
          data-open={open}
          role="dialog"
          aria-modal="true"
          aria-label="New entry"
          aria-hidden={!open}
        >
          <div className="sheet__grab" />
          <p className="mb-3.5 text-[17px] font-medium">New entry</p>

          <div className="mb-3.5 flex items-baseline gap-2 border-b border-line pb-2">
            <span className="text-[17px] text-muted">Rs</span>
            <input
              ref={sheetAmount}
              className="bare tabular text-[30px]"
              inputMode="numeric"
              placeholder="0"
              aria-label="Amount given"
              value={amount ? plainNumber(amount) : ""}
              onChange={(e) => typeAmount(e.target.value)}
            />
          </div>

          {dateAndNote("sheet")}
          {error && <p className="err mt-2">Add an amount first</p>}

          <button
            type="button"
            className="btn btn--solid mt-3.5 w-full"
            onClick={commit}
            disabled={busy}
          >
            {busy ? "Saving…" : "Record entry"}
          </button>
          <button
            type="button"
            className="btn btn--ghost w-full"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

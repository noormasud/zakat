"use client";

import { useEffect, useRef, useState } from "react";
import { plainNumber, shortAmount, todayIso } from "@/lib/format";
import type { ZakatYear } from "@/lib/types";
import Loader from "./Loader";

const DENOMINATIONS = [5000, 10000, 15000, 20000, 50000, 100000];

type Draft = { amount: number; paid_on: string; description: string | null };

/**
 * One button on the page. It opens a bottom sheet on a phone and a centred
 * panel on a larger screen — same markup, different shape.
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

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [paidOn, setPaidOn] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function reset() {
    setAmount(0);
    setNote("");
    setPaidOn(defaultDate);
  }

  function bump(value: number) {
    setAmount((a) => a + value);
    setFlash(value);
    setTimeout(() => setFlash(null), 170);
  }

  async function commit() {
    if (amount <= 0 || busy) return;
    setBusy(true);
    try {
      await onSave({ amount, paid_on: paidOn, description: note.trim() || null });
      reset();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--solid w-full"
        onClick={() => setOpen(true)}
      >
        Add an amount
      </button>

      <div
        className="overlay"
        data-open={open}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />

      <div
        className="sheet"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Add an amount"
        aria-hidden={!open}
      >
        <div className="sheet__grab" />
        <p className="mb-4 text-[17px] font-medium">Add an amount</p>

        <div className="amt-row">
          <span className="text-[18px] text-muted">Rs</span>
          <input
            ref={amountInput}
            className="bare tabular text-[26px]"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            aria-label="Amount given"
            tabIndex={open ? 0 : -1}
            value={amount ? plainNumber(amount) : ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              setAmount(digits ? Number(digits) : 0);
            }}
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

        <div className="pill-strip mt-3">
          {DENOMINATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className="pill"
              data-on={flash === d}
              tabIndex={open ? 0 : -1}
              onClick={() => bump(d)}
            >
              +{shortAmount(d)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label className="label" htmlFor="paid-on">
              Date given
            </label>
            <input
              id="paid-on"
              type="date"
              className="field"
              value={paidOn}
              min={year.start_date}
              max={year.end_date}
              tabIndex={open ? 0 : -1}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="note">
              Who it went to (optional)
            </label>
            <input
              id="note"
              className="field"
              placeholder="Edhi Foundation"
              maxLength={140}
              value={note}
              tabIndex={open ? 0 : -1}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn--solid mt-4 w-full"
          onClick={commit}
          disabled={amount <= 0 || busy}
          tabIndex={open ? 0 : -1}
        >
          {busy ? (
            <Loader variant="inline" />
          ) : amount > 0 ? (
            `Record Rs ${plainNumber(amount)}`
          ) : (
            "Record"
          )}
        </button>

        <button
          type="button"
          className="btn btn--ghost w-full"
          onClick={() => setOpen(false)}
          tabIndex={open ? 0 : -1}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

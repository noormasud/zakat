"use client";

import { useState } from "react";
import { plainNumber, todayIso } from "@/lib/format";
import type { ZakatYear } from "@/lib/types";
import Sheet from "./Sheet";
import EntryForm, { type EntryDraft } from "./EntryForm";
import Loader from "./Loader";

export default function AddEntry({
  year,
  onSave,
}: {
  year: ZakatYear;
  onSave: (entry: {
    amount: number;
    paid_on: string;
    description: string | null;
  }) => Promise<void>;
}) {
  const today = todayIso();
  const withinYear = today >= year.start_date && today <= year.end_date;
  const defaultDate = withinYear ? today : year.end_date;

  const blank: EntryDraft = { amount: 0, paid_on: defaultDate, description: "" };

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(blank);
  const [flash, setFlash] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  function bump(value: number) {
    setDraft((d) => ({ ...d, amount: d.amount + value }));
    setFlash(value);
    setTimeout(() => setFlash(null), 170);
  }

  async function commit() {
    if (draft.amount <= 0 || busy) return;
    setBusy(true);
    try {
      await onSave({
        amount: draft.amount,
        paid_on: draft.paid_on,
        description: draft.description.trim() || null,
      });
      setDraft(blank);
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

      <Sheet open={open} onClose={() => setOpen(false)} title="Add an amount">
        <EntryForm
          year={year}
          draft={draft}
          onChange={setDraft}
          flash={flash}
          onBump={bump}
        />

        <button
          type="button"
          className="btn btn--solid mt-4 w-full"
          onClick={commit}
          disabled={draft.amount <= 0 || busy}
        >
          {busy ? (
            <Loader variant="inline" />
          ) : draft.amount > 0 ? (
            `Record Rs ${plainNumber(draft.amount)}`
          ) : (
            "Record"
          )}
        </button>
        <button
          type="button"
          className="btn btn--ghost w-full"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </Sheet>
    </>
  );
}

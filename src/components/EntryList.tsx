"use client";

import { useState } from "react";
import { rupees, longDate, plainNumber } from "@/lib/format";
import type { Payment, ZakatYear } from "@/lib/types";
import Sheet from "./Sheet";
import EntryForm, { type EntryDraft } from "./EntryForm";
import Loader from "./Loader";

export default function EntryList({
  year,
  payments,
  onDelete,
  onUpdate,
}: {
  year: ZakatYear;
  payments: Payment[];
  onDelete: (id: string) => Promise<void>;
  onUpdate: (
    id: string,
    changes: { amount: number; paid_on: string; description: string | null }
  ) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [draft, setDraft] = useState<EntryDraft>({
    amount: 0,
    paid_on: "",
    description: "",
  });
  const [flash, setFlash] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  function startEdit(p: Payment) {
    setEditing(p);
    setDraft({
      amount: Number(p.amount),
      paid_on: p.paid_on,
      description: p.description ?? "",
    });
  }

  function bump(value: number) {
    setDraft((d) => ({ ...d, amount: d.amount + value }));
    setFlash(value);
    setTimeout(() => setFlash(null), 170);
  }

  async function save() {
    if (!editing || draft.amount <= 0 || busy) return;
    setBusy(true);
    try {
      await onUpdate(editing.id, {
        amount: draft.amount,
        paid_on: draft.paid_on,
        description: draft.description.trim() || null,
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("Delete this entry?")) return;
    setBusy(true);
    try {
      await onDelete(editing.id);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <button
        type="button"
        className="disclosure"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="label">
          Entries{" "}
          {payments.length > 0 && <span className="tabular">({payments.length})</span>}
        </span>
        <span className="flex items-center gap-2">
          {!expanded && payments.length > 0 && (
            <span className="tabular text-[13px] text-muted">{rupees(total)}</span>
          )}
          <span className="chevron" data-open={expanded} aria-hidden>
            ⌄
          </span>
        </span>
      </button>

      {expanded && (
        <div className="mt-2">
          {payments.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-muted">
              Nothing recorded for this year yet. Use the button above to add
              your first entry.
            </p>
          ) : (
            <ul>
              {payments.map((p) => (
                <li key={p.id} className="rule">
                  <button
                    type="button"
                    className="row"
                    onClick={() => startEdit(p)}
                  >
                    <span className="min-w-0">
                      <span className="tabular block text-[16px] font-medium">
                        {rupees(Number(p.amount))}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted">
                        {p.description || "No note"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-[12px] text-muted">
                        {longDate(p.paid_on)}
                      </span>
                      <span className="chevron -rotate-90" aria-hidden>
                        ⌄
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit entry"
      >
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
          onClick={save}
          disabled={draft.amount <= 0 || busy}
        >
          {busy ? <Loader variant="inline" /> : `Save Rs ${plainNumber(draft.amount)}`}
        </button>
        <button
          type="button"
          className="btn btn--quiet mt-2 w-full"
          style={{ color: "var(--pend)" }}
          onClick={remove}
        >
          Delete this entry
        </button>
        <button
          type="button"
          className="btn btn--ghost w-full"
          onClick={() => setEditing(null)}
        >
          Cancel
        </button>
      </Sheet>
    </section>
  );
}

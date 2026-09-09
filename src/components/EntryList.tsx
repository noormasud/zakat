"use client";

import { useState } from "react";
import { rupees, longDate } from "@/lib/format";
import type { Payment } from "@/lib/types";

export default function EntryList({
  payments,
  onDelete,
  onEditNote,
}: {
  payments: Payment[];
  onDelete: (id: string) => Promise<void>;
  onEditNote: (id: string, note: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <section>
      <p className="label">
        Entries{" "}
        {payments.length > 0 && (
          <span className="tabular">({payments.length})</span>
        )}
      </p>

      {payments.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-muted">
          Nothing recorded for this year yet. Tap a denomination above to add
          your first entry.
        </p>
      ) : (
        <ul>
          {payments.map((p) => {
            const open = openId === p.id;
            return (
              <li key={p.id} className="rule py-3 first:border-t-0 first:pt-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={open}
                  onClick={() => {
                    setOpenId(open ? null : p.id);
                    setDraft(p.description ?? "");
                  }}
                >
                  <span className="min-w-0">
                    <span className="tabular block text-[16px] font-medium">
                      {rupees(Number(p.amount))}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {p.description || "No note"}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[12px] text-muted">
                    {longDate(p.paid_on)}
                  </span>
                </button>

                {open && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="field"
                      placeholder="Who it went to"
                      maxLength={140}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn--solid flex-1 whitespace-nowrap"
                        onClick={async () => {
                          await onEditNote(p.id, draft.trim());
                          setOpenId(null);
                        }}
                      >
                        Save note
                      </button>
                      <button
                        type="button"
                        className="btn btn--quiet whitespace-nowrap"
                        style={{ color: "var(--pend)" }}
                        onClick={async () => {
                          if (confirm("Delete this entry?")) {
                            await onDelete(p.id);
                            setOpenId(null);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

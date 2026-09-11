"use client";

import { plainNumber, shortAmount } from "@/lib/format";
import type { ZakatYear } from "@/lib/types";

const DENOMINATIONS = [5000, 10000, 15000, 20000, 50000, 100000];

export type EntryDraft = {
  amount: number;
  paid_on: string;
  description: string;
};

/** The three fields of an entry. Shared by the add and edit sheets. */
export default function EntryForm({
  year,
  draft,
  onChange,
  flash,
  onBump,
}: {
  year: ZakatYear;
  draft: EntryDraft;
  onChange: (next: EntryDraft) => void;
  flash: number | null;
  onBump: (value: number) => void;
}) {
  return (
    <>
      <div className="amt-row">
        <span className="text-[18px] text-muted">Rs</span>
        <input
          className="bare tabular text-[26px]"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          aria-label="Amount given"
          value={draft.amount ? plainNumber(draft.amount) : ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChange({ ...draft, amount: digits ? Number(digits) : 0 });
          }}
        />
        {draft.amount > 0 && (
          <button
            type="button"
            className="shrink-0 text-[13px] text-muted hover:text-ink"
            onClick={() => onChange({ ...draft, amount: 0 })}
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
            onClick={() => onBump(d)}
          >
            +{shortAmount(d)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="entry-date">
            Date given
          </label>
          <input
            id="entry-date"
            type="date"
            className="field"
            value={draft.paid_on}
            min={year.start_date}
            max={year.end_date}
            onChange={(e) => onChange({ ...draft, paid_on: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="entry-note">
            Who it went to (optional)
          </label>
          <input
            id="entry-note"
            className="field"
            placeholder="Edhi Foundation"
            maxLength={140}
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}

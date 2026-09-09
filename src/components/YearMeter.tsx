"use client";

import { rupees, daysLeft } from "@/lib/format";
import type { ZakatYear } from "@/lib/types";

export default function YearMeter({
  year,
  given,
  isCurrent,
}: {
  year: ZakatYear;
  given: number;
  isCurrent: boolean;
}) {
  const due = Number(year.due_amount);
  const remaining = due - given;
  const done = due > 0 && remaining <= 0;
  const pct = due > 0 ? Math.min(100, (given / due) * 100) : 0;
  const left = daysLeft(year.end_date);

  return (
    <section>
      <span className="chip" data-done={done}>
        {done ? "Fully paid" : due > 0 ? "Pending" : "No amount set"}
      </span>

      <p className="mt-2.5 text-[13px] text-muted">
        {done ? "Given this year" : "Still to give"}
      </p>

      <p
        className="tabular hero mt-0.5 font-medium leading-[1.05] tracking-tight"
        style={{ color: done ? "var(--ok)" : "var(--fg)" }}
      >
        {rupees(done ? given : Math.max(0, remaining))}
      </p>

      <p className="mt-1.5 text-[13px] text-muted">
        {done
          ? `Your obligation of ${rupees(due)} is met`
          : due > 0
          ? `of ${rupees(due)} due`
          : "Set the amount due below"}
      </p>

      <div className="mt-4">
        <div
          className="bar"
          role="img"
          aria-label={`${Math.round(pct)} percent of this year given`}
        >
          <div className="bar__fill" data-done={done} style={{ width: `${pct}%` }} />
        </div>
        <div className="tabular mt-1.5 flex justify-between text-[12px] text-muted">
          <span>{rupees(given)} given</span>
          <span>{Math.round(pct)}%</span>
        </div>
      </div>

      {isCurrent && (
        <p
          className="mt-3 text-[12px]"
          style={{ color: left <= 30 ? "var(--pend)" : "var(--dim)" }}
        >
          {left <= 0 ? "This year ends today" : `${left} days left in this year`}
        </p>
      )}

      {done && given > due && (
        <p className="tabular mt-2 text-[13px]" style={{ color: "var(--ok)" }}>
          {rupees(given - due)} given beyond what was due.
        </p>
      )}
    </section>
  );
}

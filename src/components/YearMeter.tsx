"use client";

import { rupees, longDate, daysLeft } from "@/lib/format";
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
        className="tabular mt-0.5 text-[2.4rem] font-medium leading-[1.05] tracking-tight sm:text-[3rem]"
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
        {" · year "}
        {year.year_number}
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

      <p className="mt-3 text-[12px] text-muted">
        {longDate(year.start_date)} to {longDate(year.end_date)}
        {isCurrent && (
          <span style={{ color: left <= 30 ? "var(--pend)" : "inherit" }}>
            {" · "}
            {left <= 0 ? "ends today" : `${left} days left`}
          </span>
        )}
      </p>

      {done && given > due && (
        <p className="tabular mt-2 text-[13px]" style={{ color: "var(--ok)" }}>
          {rupees(given - due)} given beyond what was due.
        </p>
      )}
    </section>
  );
}

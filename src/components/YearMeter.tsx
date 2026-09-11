"use client";

import { rupees, daysLeft } from "@/lib/format";
import type { ZakatYear } from "@/lib/types";

/**
 * `carryIn` is the net position of every earlier year: negative if they closed
 * short, positive if more was given than was owed. A shortfall is added to what
 * this year owes; an excess counts as already given against it.
 */
export default function YearMeter({
  year,
  given,
  carryIn,
  isCurrent,
}: {
  year: ZakatYear;
  given: number;
  carryIn: number;
  isCurrent: boolean;
}) {
  const ownDue = Number(year.due_amount);
  const arrears = Math.max(0, -carryIn);
  const credit = Math.max(0, carryIn);

  const due = ownDue + arrears;
  const paid = given + credit;
  const remaining = due - paid;
  const done = due > 0 && remaining <= 0;
  const nothingSet = due === 0 && paid === 0;

  const pct = due > 0 ? Math.min(100, (paid / due) * 100) : paid > 0 ? 100 : 0;
  const left = daysLeft(year.end_date);

  return (
    <section>
      <span className="chip" data-done={done}>
        {nothingSet ? "No amount set" : done ? "Fully paid" : "Pending"}
      </span>

      <p className="mt-2.5 text-[13px] text-muted">
        {done ? "Given this year" : "Still to give"}
      </p>

      <p
        className="tabular hero mt-0.5 font-medium leading-[1.05] tracking-tight"
        style={{ color: done ? "var(--ok)" : "var(--fg)" }}
      >
        {rupees(done ? paid : Math.max(0, remaining))}
      </p>

      <p className="mt-1.5 text-[13px] text-muted">
        {done
          ? due > 0
            ? `Your obligation of ${rupees(due)} is met`
            : "Nothing was owed"
          : due > 0
          ? `of ${rupees(due)} due`
          : "Set the amount due below"}
      </p>

      {/* Only shown when an earlier year actually contributes — otherwise the
          headline figure is the whole story and pills would be noise. */}
      {carryIn !== 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="chip" data-tone="plain">
            {rupees(ownDue)} this year
          </span>
          {arrears > 0 && (
            <span className="chip" data-tone="pend">
              + {rupees(arrears)} from earlier
            </span>
          )}
          {credit > 0 && (
            <span className="chip" data-tone="ok">
              − {rupees(credit)} carried in
            </span>
          )}
        </div>
      )}

      <div className="mt-4">
        <div
          className="bar"
          role="img"
          aria-label={`${Math.round(pct)} percent of this year given`}
        >
          <div className="bar__fill" data-done={done} style={{ width: `${pct}%` }} />
        </div>
        <div className="tabular mt-1.5 flex justify-between text-[12px] text-muted">
          <span>{rupees(paid)} given</span>
          <span>{Math.round(pct)}%</span>
        </div>
      </div>

      {done && paid > due && (
        <p className="tabular mt-2 text-[13px]" style={{ color: "var(--ok)" }}>
          + {rupees(paid - due)} beyond what was due, carried to next year
        </p>
      )}

      {isCurrent && (
        <p
          className="mt-3 text-[12px]"
          style={{ color: left <= 30 ? "var(--pend)" : "var(--dim)" }}
        >
          {left <= 0 ? "This year ends today" : `${left} days left in this year`}
        </p>
      )}
    </section>
  );
}

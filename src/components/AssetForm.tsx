"use client";

import {
  ASSET_CATEGORIES,
  WEIGHED,
  WEIGHT_UNITS,
  type Asset,
} from "@/lib/types";
import { rupees, plainNumber } from "@/lib/format";

export type AssetDraft = Omit<Asset, "id" | "year_id" | "position">;

export const blankAsset = (): AssetDraft => ({
  name: "",
  category: "cash",
  value: 0,
  rate: 2.5,
  deducts: false,
  weight: null,
  unit: "tola",
  unit_price: null,
});

/** Gold and silver are entered as weight times rate; the value follows. */
export function valueOf(a: AssetDraft) {
  if (WEIGHED.includes(a.category)) {
    return Number(a.weight ?? 0) * Number(a.unit_price ?? 0);
  }
  return Number(a.value ?? 0);
}

export function zakatOf(a: AssetDraft) {
  return (valueOf(a) * Number(a.rate)) / 100 * (a.deducts ? -1 : 1);
}

export default function AssetForm({
  draft,
  onChange,
}: {
  draft: AssetDraft;
  onChange: (next: AssetDraft) => void;
}) {
  const weighed = WEIGHED.includes(draft.category);
  const digits = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
  const decimals = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;

  return (
    <>
      <div>
        <label className="label" htmlFor="asset-cat">
          What kind of asset
        </label>
        <select
          id="asset-cat"
          className="field"
          value={draft.category}
          onChange={(e) => {
            const cat = ASSET_CATEGORIES.find((c) => c.id === e.target.value);
            onChange({
              ...draft,
              category: e.target.value,
              rate: cat?.rate ?? 2.5,
              deducts: cat?.deducts ?? false,
            });
          }}
        >
          {ASSET_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <label className="label" htmlFor="asset-name">
          Name it (optional)
        </label>
        <input
          id="asset-name"
          className="field"
          placeholder={weighed ? "Wedding set" : "Savings account"}
          maxLength={60}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </div>

      {weighed ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="asset-weight">
                Weight
              </label>
              <input
                id="asset-weight"
                className="field"
                inputMode="decimal"
                placeholder="0"
                value={draft.weight ?? ""}
                onChange={(e) =>
                  onChange({ ...draft, weight: decimals(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-unit">
                Measured in
              </label>
              <select
                id="asset-unit"
                className="field"
                value={draft.unit ?? "tola"}
                onChange={(e) => onChange({ ...draft, unit: e.target.value })}
              >
                {WEIGHT_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    per {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="asset-price">
              Rate per {draft.unit ?? "tola"}
            </label>
            <div className="amt-row">
              <span className="text-[16px] text-muted">Rs</span>
              <input
                id="asset-price"
                className="bare tabular text-[19px]"
                inputMode="numeric"
                placeholder="0"
                value={draft.unit_price ? plainNumber(draft.unit_price) : ""}
                onChange={(e) =>
                  onChange({ ...draft, unit_price: digits(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="carry mt-3">
            <div className="tabular flex items-baseline justify-between text-[14px]">
              <span className="text-muted">
                {draft.weight ?? 0} {draft.unit ?? "tola"} at{" "}
                {rupees(draft.unit_price ?? 0)}
              </span>
              <span className="font-medium">{rupees(valueOf(draft))}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <label className="label" htmlFor="asset-value">
            {draft.deducts ? "Amount you owe" : "What it is worth"}
          </label>
          <div className="amt-row">
            <span className="text-[16px] text-muted">Rs</span>
            <input
              id="asset-value"
              className="bare tabular text-[19px]"
              inputMode="numeric"
              placeholder="0"
              value={draft.value ? plainNumber(Number(draft.value)) : ""}
              onChange={(e) =>
                onChange({ ...draft, value: digits(e.target.value) })
              }
            />
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="label" htmlFor="asset-rate">
          Zakat rate
        </label>
        <div className="rate">
          <input
            id="asset-rate"
            className="field"
            inputMode="decimal"
            value={draft.rate}
            onChange={(e) => onChange({ ...draft, rate: decimals(e.target.value) })}
          />
          <span>%</span>
        </div>
      </div>

      <div className="carry mt-3">
        <div className="tabular flex items-baseline justify-between text-[14px]">
          <span className="text-muted">
            {draft.deducts ? "Reduces the Zakat by" : "Zakat on this"}
          </span>
          <span
            className="font-medium"
            style={{ color: draft.deducts ? "var(--pend)" : "var(--fg)" }}
          >
            {rupees(Math.abs(zakatOf(draft)))}
          </span>
        </div>
      </div>
    </>
  );
}

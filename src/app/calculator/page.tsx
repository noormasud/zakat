"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ASSET_CATEGORIES, WEIGHED, type Asset, type ZakatYear } from "@/lib/types";
import { rupees, yearRange, todayIso } from "@/lib/format";
import Loader from "@/components/Loader";
import ThemeToggle from "@/components/ThemeToggle";
import Sheet from "@/components/Sheet";
import AssetForm, {
  blankAsset,
  valueOf,
  zakatOf,
  type AssetDraft,
} from "@/components/AssetForm";

const labelFor = (id: string) =>
  ASSET_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export default function Calculator() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [year, setYear] = useState<ZakatYear | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetDraft>(blankAsset());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return router.replace("/login");

    const today = todayIso();
    const { data: years } = await supabase
      .from("zakat_years")
      .select("*")
      .order("year_number", { ascending: false });

    const list = (years ?? []) as ZakatYear[];
    const current =
      list.find((y) => today >= y.start_date && today <= y.end_date) ?? list[0];
    if (!current) return router.replace("/dashboard");
    setYear(current);

    const { data: rows } = await supabase
      .from("zakat_assets")
      .select("*")
      .eq("year_id", current.id)
      .order("position");

    setAssets((rows ?? []) as Asset[]);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    load();
  }, [load]);

  const holdings = assets
    .filter((a) => !a.deducts)
    .reduce((sum, a) => sum + valueOf(a), 0);
  const debts = assets
    .filter((a) => a.deducts)
    .reduce((sum, a) => sum + valueOf(a), 0);
  const total = assets.reduce((sum, a) => sum + zakatOf(a), 0);
  const payable = Math.max(0, total);

  function startAdd() {
    setEditingId(null);
    setDraft(blankAsset());
    setOpen(true);
  }

  function startEdit(a: Asset) {
    setEditingId(a.id);
    setDraft({
      name: a.name,
      category: a.category,
      value: Number(a.value),
      rate: Number(a.rate),
      deducts: a.deducts,
      weight: a.weight === null ? null : Number(a.weight),
      unit: a.unit ?? "tola",
      unit_price: a.unit_price === null ? null : Number(a.unit_price),
    });
    setOpen(true);
  }

  async function save() {
    if (!year || busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      // Keep `value` authoritative so exports and totals need no special case.
      const record = { ...draft, value: valueOf(draft) };

      if (editingId) {
        await supabase.from("zakat_assets").update(record).eq("id", editingId);
        setAssets((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, ...record } : a))
        );
      } else {
        const { data } = await supabase
          .from("zakat_assets")
          .insert({
            ...record,
            user_id: auth.user.id,
            year_id: year.id,
            position: assets.length,
          })
          .select()
          .single();
        if (data) setAssets((prev) => [...prev, data as Asset]);
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editingId) return;
    if (!confirm("Remove this asset?")) return;
    await supabase.from("zakat_assets").delete().eq("id", editingId);
    setAssets((prev) => prev.filter((a) => a.id !== editingId));
    setOpen(false);
  }

  async function applyToYear() {
    await supabase.rpc("set_due_amount", { p_amount: Math.round(payable) });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <main><Loader /></main>;

  return (
    <main className="page">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-[13px] text-muted hover:text-ink">
          ‹ Back
        </Link>
        <ThemeToggle />
      </div>

      <h1 className="mt-5 text-[1.75rem] font-medium tracking-tight">
        Zakat calculator
      </h1>
      {year && (
        <p className="mt-1 text-[12px] text-muted">
          For {yearRange(year.start_date, year.end_date)}
        </p>
      )}

      <div className="rule mt-6 pt-5">
        <p className="label">Zakat payable</p>
        <p className="tabular hero font-medium leading-[1.05] tracking-tight">
          {rupees(payable)}
        </p>
        {total < 0 && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--pend)" }}>
            Your deductions exceed your assets, so nothing is payable.
          </p>
        )}
      </div>

      <button className="btn btn--solid mt-5 w-full" onClick={startAdd}>
        Add an asset
      </button>

      {assets.length > 0 && (
        <div className="carry mt-5">
          <div className="tabular flex items-baseline justify-between text-[14px]">
            <span className="text-muted">What you hold</span>
            <span>{rupees(holdings)}</span>
          </div>
          <div className="tabular mt-1 flex items-baseline justify-between text-[14px]">
            <span className="text-muted">Less debts you owe</span>
            <span style={{ color: debts > 0 ? "var(--pend)" : "inherit" }}>
              {debts > 0 ? `− ${rupees(debts)}` : rupees(0)}
            </span>
          </div>
          <div className="rule mt-2.5 pt-2.5">
            <div className="tabular flex items-baseline justify-between text-[14px]">
              <span className="text-muted">Net holdings</span>
              <span className="font-medium">{rupees(holdings - debts)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-7">
        <p className="label">
          Assets{" "}
          {assets.length > 0 && <span className="tabular">({assets.length})</span>}
        </p>

        {assets.length === 0 ? (
          <p className="text-[14px] leading-relaxed text-muted">
            Nothing listed yet. Add what you hold and the Zakat is worked out as
            you go.
          </p>
        ) : (
          <ul>
            {assets.map((a) => (
              <li key={a.id} className="rule">
                <button type="button" className="row" onClick={() => startEdit(a)}>
                  <span className="min-w-0">
                    <span className="tabular block text-[16px] font-medium">
                      {rupees(valueOf(a))}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {a.name ? `${a.name} · ` : ""}
                      {labelFor(a.category)}
                      {WEIGHED.includes(a.category) && a.weight
                        ? ` · ${Number(a.weight)} ${a.unit ?? "tola"}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className="tabular text-[12px]"
                      style={{ color: a.deducts ? "var(--pend)" : "var(--dim)" }}
                    >
                      {a.deducts ? "−" : ""}
                      {rupees(Math.abs(zakatOf(a)))}
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

      {payable > 0 && (
        <div className="rule mt-8 pt-5">
          <button className="btn btn--solid w-full" onClick={applyToYear}>
            Set {rupees(payable)} as this year&rsquo;s Zakat due
          </button>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {saved
              ? "Saved. You can still change the figure by hand on the ledger."
              : "This fills in the year's due amount. It stays editable afterwards, and closed years are untouched."}
          </p>
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit asset" : "Add an asset"}
      >
        <AssetForm draft={draft} onChange={setDraft} />

        <button
          className="btn btn--solid mt-4 w-full"
          onClick={save}
          disabled={busy}
        >
          {busy ? <Loader variant="inline" /> : editingId ? "Save asset" : "Add asset"}
        </button>
        {editingId && (
          <button
            className="btn btn--quiet mt-2 w-full"
            style={{ color: "var(--pend)" }}
            onClick={remove}
          >
            Remove this asset
          </button>
        )}
        <button className="btn btn--ghost w-full" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </Sheet>
    </main>
  );
}

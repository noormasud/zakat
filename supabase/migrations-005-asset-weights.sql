-- ============================================================
-- 005 — Gold and silver are held by weight, not by value.
-- Record the weight and the rate, and let the app do the sum.
-- ============================================================

alter table public.zakat_assets add column if not exists weight     numeric(14,3);
alter table public.zakat_assets add column if not exists unit       text;
alter table public.zakat_assets add column if not exists unit_price numeric(14,2);

notify pgrst, 'reload schema';

-- Records which device an entry was made from, alongside the created_at
-- timestamp that already exists. This is bookkeeping metadata: it appears
-- in the Excel export only, never in the app, and is distinct from the
-- date the Zakat was actually given.

alter table public.payments add column if not exists device text;

-- If the Sheets sync is already deployed, redeploy it after running this so
-- it picks up the extra column:
--   supabase functions deploy sheets-sync --no-verify-jwt

# Zakat Tracker

A private ledger for one person's Zakat: what is owed each year, what has been
given, and what is still outstanding. Amounts in PKR, Zakat years of 365 days.

- **Sign in with a username** — no email. Usernames are unique and permanent.
- **Quick entry** — tap `+5k`, `+10k`, `+15k`, `+20k`, `+50k`, `+1 lakh` to build an
  amount, or type your own. Each entry records a date and an optional note.
- **Automatic year rollover** — when a year ends, the next one opens and the app
  says so on your next visit. Closed years are never rewritten.
- **Changing the amount due** applies to the year in progress and all years after
  it, never to years that have already closed.
- **Excel download** — one sheet per year plus a summary tab.
- **Google Sheets mirror** — optional, per account. Every entry, edit and deletion
  is reflected in a spreadsheet you own.
- **Light and dark themes** — toggled from the header, remembered per device, and
  defaulting to your system setting. Colour means one thing only: amber for an
  outstanding year, green for one that is met.
- **Adapts to the device** — on a phone the amount row opens a bottom sheet for the
  date and note; on a wider screen those fields sit inline on the page.

Stack: Next.js 14 (App Router) · Supabase (Postgres, Auth, Edge Functions) · Vercel.

---

## 1. Create the Supabase project

1. Go to supabase.com, create a project, and note the **Project URL** and the
   **anon public** key from *Project Settings → API*.
2. Open the **SQL Editor**, paste the whole of `supabase/schema.sql`, and run it.
3. Go to *Authentication → Sign In / Providers → Email* and turn
   **Confirm email** **off**. Sign-ups use a synthetic address derived from the
   username, so there is no inbox to confirm from.

## 2. Run it locally

```bash
npm install
cp .env.example .env.local     # fill in the two NEXT_PUBLIC_ values
npm run dev
```

Open http://localhost:3000, create an account, set your year start date and the
amount due, and you are tracking.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repo. The framework is detected
   automatically; no build settings to change.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Then in Supabase, under *Authentication → URL Configuration*, set the
   **Site URL** to your Vercel domain.

---

## 4. Google Sheets mirror (optional, off by default)

The panel for this is hidden unless `NEXT_PUBLIC_SHEETS_SYNC=on` is set, so
nobody is offered a feature that has no function behind it. Work through the
steps below, then add that variable last.

The sync is per account: each user links their own sheet, and the function only
ever writes that user's rows.

### Make a service account

1. In the [Google Cloud Console](https://console.cloud.google.com), create a
   project and enable the **Google Sheets API**.
2. *IAM & Admin → Service Accounts → Create service account*. Name it anything.
3. On the new account, *Keys → Add key → Create new key → JSON*. Download it.
4. From that JSON you need two values: `client_email` and `private_key`.

### Deploy the function

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set \
  GOOGLE_SA_EMAIL="zakat-sync@your-project.iam.gserviceaccount.com" \
  GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

supabase functions deploy sheets-sync --no-verify-jwt
```

Keep the `\n` escapes in the private key exactly as they appear in the JSON file.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Point the database at it

In Supabase, *Database → Webhooks → Create a new hook*:

| Field | Value |
| --- | --- |
| Table | `public.payments` |
| Events | Insert, Update, Delete |
| Type | Supabase Edge Functions |
| Function | `sheets-sync` |
| Method | POST |

### Tell the app which service account to name

Add one more Vercel environment variable so the Settings page shows users the
right address to share their sheet with:

```
NEXT_PUBLIC_GOOGLE_SA_EMAIL=zakat-sync@your-project.iam.gserviceaccount.com
```

### What each user does

Create a Google Sheet, share it as **Editor** with that service account address,
and paste the sheet link into Settings. A tab named `Zakat` appears and stays in
step with the app.

---

## How the data is arranged

| Table | Holds |
| --- | --- |
| `profiles` | Username, the amount currently due, the first year's start date, linked sheet |
| `zakat_years` | One row per year: number, start, end, and the amount due *for that year* |
| `payments` | One row per entry: amount, date, note, and the year it belongs to |

Row level security is on for all three, so a query can only ever return rows
belonging to the signed-in user. The service role key never reaches the browser —
only the Edge Function uses it.

Two triggers do the quiet work: one creates a profile the moment an account is
made (if the username is taken, the whole sign-up rolls back, so there are no
half-made accounts), and one refuses any attempt to change a username.

Because each year stores its own `due_amount`, revising the figure through
`set_due_amount` touches only rows whose `end_date` is today or later. History
stays as it was.

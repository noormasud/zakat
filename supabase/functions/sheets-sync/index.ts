// Mirrors a user's Zakat ledger into their own Google Sheet.
//
// Triggered by a Supabase database webhook on public.payments
// (INSERT, UPDATE and DELETE). Rather than tracking row positions, it
// rewrites the user's tab from the database every time — which keeps edits
// and deletions correct with no bookkeeping.
//
// Deploy:  supabase functions deploy sheets-sync --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TAB = "Zakat";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ---------- Google auth ------------------------------------------- */

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlText = (text: string) => b64url(new TextEncoder().encode(text));

function pemToBuffer(pem: string) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;

  const email = Deno.env.get("GOOGLE_SA_EMAIL")!;
  const now = Math.floor(Date.now() / 1000);

  const claim = {
    iss: email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned =
    `${b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64urlText(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(Deno.env.get("GOOGLE_SA_PRIVATE_KEY")!),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  });

  const json = await res.json();
  if (!json.access_token) throw new Error(`Google token failed: ${JSON.stringify(json)}`);

  cachedToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

/* ---------- Sheets calls ------------------------------------------ */

async function sheets(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Sheets ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ensureTab(sheetId: string, token: string) {
  const meta = await sheets(`/${sheetId}?fields=sheets.properties.title`, token);
  const exists = meta.sheets?.some(
    (s: { properties: { title: string } }) => s.properties.title === TAB
  );
  if (exists) return;
  await sheets(`/${sheetId}:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
  });
}

/* ---------- Handler ----------------------------------------------- */

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload.old_record;
    const userId: string | undefined = row?.user_id;
    if (!userId) return new Response("no user", { status: 200 });

    const { data: profile } = await admin
      .from("profiles")
      .select("username, sheet_id")
      .eq("id", userId)
      .single();

    if (!profile?.sheet_id) return new Response("no sheet linked", { status: 200 });

    const [{ data: years }, { data: payments }] = await Promise.all([
      admin
        .from("zakat_years")
        .select("id, year_number, start_date, end_date, due_amount")
        .eq("user_id", userId),
      admin
        .from("payments")
        .select("year_id, amount, paid_on, description, created_at")
        .eq("user_id", userId)
        .order("paid_on", { ascending: true }),
    ]);

    const yearById = new Map((years ?? []).map((y) => [y.id, y]));

    const header = [
      "Zakat year",
      "Year starts",
      "Year ends",
      "Date given",
      "Amount (PKR)",
      "Given to",
      "Recorded at",
    ];

    const body = (payments ?? []).map((p) => {
      const y = yearById.get(p.year_id);
      return [
        y ? `Year ${y.year_number}` : "",
        y?.start_date ?? "",
        y?.end_date ?? "",
        p.paid_on,
        Number(p.amount),
        p.description ?? "",
        new Date(p.created_at).toISOString(),
      ];
    });

    const token = await accessToken();
    await ensureTab(profile.sheet_id, token);

    // Clear then rewrite, so removed entries actually disappear.
    await sheets(`/${profile.sheet_id}/values/${TAB}!A:G:clear`, token, { method: "POST" });
    await sheets(
      `/${profile.sheet_id}/values/${TAB}!A1?valueInputOption=USER_ENTERED`,
      token,
      { method: "PUT", body: JSON.stringify({ values: [header, ...body] }) }
    );

    return new Response(JSON.stringify({ ok: true, rows: body.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

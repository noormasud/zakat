const nf = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

export function rupees(n: number) {
  return `Rs ${nf.format(Math.round(n))}`;
}

export function plainNumber(n: number) {
  return nf.format(Math.round(n));
}

/** 5000 -> "5k", 100000 -> "1 lac" */
export function shortAmount(n: number) {
  if (n >= 100000) return `${n / 100000} lac`;
  return `${n / 1000}k`;
}

export function longDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function shortDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short",
  });
}

export function daysLeft(endIso: string) {
  const end = new Date(`${endIso}T00:00:00`).getTime();
  const now = new Date(new Date().toDateString()).getTime();
  return Math.round((end - now) / 86400000);
}

export const todayIso = () => new Date().toLocaleDateString("en-CA");

/**
 * Years are named by the dates they cover, not by their ordinal. "Year 2"
 * means nothing to anyone; "15 Mar 2026 – 14 Mar 2027" is the actual answer
 * to "which year am I looking at".
 */
export function yearRange(startIso: string, endIso: string) {
  return `${longDate(startIso)} – ${longDate(endIso)}`;
}

/** Compact form for dropdowns and spreadsheet tabs: "2026–27" or "2026". */
export function yearTag(startIso: string, endIso: string) {
  const start = startIso.slice(0, 4);
  const end = endIso.slice(0, 4);
  return start === end ? start : `${start}–${end.slice(2)}`;
}

/**
 * When an entry was keyed into the app — distinct from the date the Zakat
 * was actually given. Export only.
 */
export function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

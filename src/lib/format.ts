const nf = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

export function rupees(n: number) {
  return `Rs ${nf.format(Math.round(n))}`;
}

export function plainNumber(n: number) {
  return nf.format(Math.round(n));
}

/** 5000 -> "5k", 100000 -> "1 lakh" */
export function shortAmount(n: number) {
  if (n >= 100000) return `${n / 100000} lakh`;
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

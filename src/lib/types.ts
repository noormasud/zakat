export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  default_due_amount: number;
  year_start: string | null;
  sheet_id: string | null;
};

export type ZakatYear = {
  id: string;
  year_number: number;
  start_date: string;
  end_date: string;
  due_amount: number;
};

export type Payment = {
  id: string;
  year_id: string;
  amount: number;
  paid_on: string;
  description: string | null;
  device: string | null;
  created_at: string;
};

/** Usernames double as the login handle, so they need a stable e-mail form. */
export const USER_EMAIL_DOMAIN = "users.zakattracker.app";
export const emailFor = (username: string) =>
  `${username.trim().toLowerCase()}@${USER_EMAIL_DOMAIN}`;

export type Asset = {
  id: string;
  year_id: string;
  name: string;
  category: string;
  value: number;
  rate: number;
  deducts: boolean;
  position: number;
  /** Gold and silver only: held by weight, valued at a rate per unit. */
  weight: number | null;
  unit: string | null;
  unit_price: number | null;
};

/** Categories priced by weight rather than entered as a lump value. */
export const WEIGHED = ["gold", "silver"];

export const WEIGHT_UNITS = [
  { id: "tola", label: "tola" },
  { id: "gram", label: "gram" },
];

/**
 * Every category sits at 2.5%, and every rate is editable per row.
 */
export const ASSET_CATEGORIES: {
  id: string;
  label: string;
  rate: number;
  deducts?: boolean;
}[] = [
  { id: "cash",       label: "Cash and bank",            rate: 2.5 },
  { id: "gold",       label: "Gold",                     rate: 2.5 },
  { id: "silver",     label: "Silver",                   rate: 2.5 },
  { id: "business",   label: "Business stock",           rate: 2.5 },
  { id: "property",   label: "Property held for resale",  rate: 2.5 },
  { id: "shares",     label: "Shares and investments",   rate: 2.5 },
  { id: "receivable", label: "Money owed to you",        rate: 2.5 },
  { id: "crops",      label: "Agricultural produce",     rate: 2.5 },
  { id: "livestock",  label: "Livestock",                rate: 2.5 },
  { id: "other",      label: "Other zakatable asset",    rate: 2.5 },
  { id: "debt",       label: "Debt you owe (deduct)",    rate: 2.5, deducts: true },
];

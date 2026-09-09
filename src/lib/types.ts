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

import type { Config } from "tailwindcss";

/** Colours resolve to CSS variables so both themes work from one class set. */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:     "var(--fg)",
        paper:   "var(--bg)",
        surface: "var(--s2)",
        raised:  "var(--s1)",
        muted:   "var(--dim)",
        line:    "var(--bd)",
        ok:      "var(--ok)",
        pending: "var(--pend)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

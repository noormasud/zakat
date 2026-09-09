"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  // Read after mount only — the real value is set by the bootstrap script
  // in the document head, so rendering it on the server would mismatch.
  useEffect(() => {
    setTheme(
      (document.documentElement.dataset.theme as "light" | "dark") ?? "light"
    );
  }, []);

  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private browsing — the choice just won't persist */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="text-[13px] text-muted hover:text-ink"
    >
      {theme === null ? "" : theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

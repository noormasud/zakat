"use client";

import { useEffect } from "react";

/**
 * A bottom sheet on a phone, a centred panel on a larger screen. The element
 * stays mounted and is moved off-screen, so anything inside it is taken out
 * of the tab order while closed.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className="overlay"
        data-open={open}
        aria-hidden={!open}
        onClick={onClose}
      />
      <div
        className="sheet"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <div className="sheet__grab" />
        <p className="mb-4 text-[17px] font-medium">{title}</p>
        {children}
      </div>
    </>
  );
}

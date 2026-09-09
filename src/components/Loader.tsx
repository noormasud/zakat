/**
 * One loading treatment everywhere. Full page shows the wordmark above the
 * dots; inline shows the dots alone, sized to sit beside or inside other
 * content without shifting the layout.
 */
export default function Loader({
  variant = "page",
  mark = "Zakat",
}: {
  variant?: "page" | "block" | "inline";
  mark?: string;
}) {
  if (variant === "inline") {
    return (
      <span className="dots dots--sm" role="status" aria-label="Loading">
        <span /><span /><span />
      </span>
    );
  }

  return (
    <div
      className={`loader ${variant === "page" ? "loader--page" : "py-10"}`}
      role="status"
      aria-label="Loading"
    >
      {variant === "page" && <p className="loader__mark">{mark}</p>}
      <span className="dots">
        <span /><span /><span />
      </span>
    </div>
  );
}

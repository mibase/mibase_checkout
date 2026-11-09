import { useEffect, useRef } from "react";

// Small modal question with two answers. Focus starts on the first answer,
// Escape or a tap outside counts as "no", and focus goes back where it was.
export default function ConfirmDialog({ title, children, yesLabel, noLabel, onYes, onNo }) {
  const yesRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    yesRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onNo();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onNo]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--on-accent)_60%,transparent)] p-4 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onNo()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="w-full max-w-md space-y-4 rounded-2xl border-2 border-[var(--border-light)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-xl"
      >
        <h2 id="confirm-title" className="text-xl font-bold">
          {title}
        </h2>
        <div id="confirm-body" className="text-[var(--text-primary)]">
          {children}
        </div>
        <div className="space-y-3">
          <button
            ref={yesRef}
            type="button"
            onClick={onYes}
            className="w-full min-h-14 rounded-xl bg-[var(--primary-cyan)] px-4 text-lg font-semibold text-[var(--on-accent)]"
          >
            {yesLabel}
          </button>
          <button
            type="button"
            onClick={onNo}
            className="w-full min-h-14 rounded-xl border-2 border-[var(--border-light)] bg-[var(--surface)] px-4 text-lg font-semibold"
          >
            {noLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

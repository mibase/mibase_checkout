// Outcome / notice box. tone: "success" | "error" | "info".
const TONES = {
  success: "border-[var(--primary-cyan)] text-[var(--cyan-text)]",
  error: "border-[var(--error-text)] text-[var(--error-text)]",
  info: "border-[var(--border-light)] text-[var(--text-primary)]",
};

export default function Message({ tone = "info", title, children }) {
  if (!title && !children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border-2 bg-[var(--surface)] p-4 ${TONES[tone]}`}
    >
      {title && <p className="text-lg font-bold">{title}</p>}
      {children && <div className="mt-1 text-[var(--text-primary)]">{children}</div>}
    </div>
  );
}

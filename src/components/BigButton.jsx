// Full-width touch target (min 56 px). variant: "primary" | "secondary".
const VARIANTS = {
  primary: "bg-[var(--primary-cyan)] text-[var(--on-accent)] border-transparent",
  secondary: "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-light)]",
};

export default function BigButton({ variant = "primary", className = "", children, ...rest }) {
  return (
    <button
      type="button"
      className={`w-full min-h-14 rounded-xl border-2 px-4 text-lg font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

import { forwardRef } from "react";

// Big, phone-friendly input. numeric brings up the number keypad; masked hides
// the PIN as it is typed. Enter submits the surrounding form.
const NumberField = forwardRef(function NumberField(
  { id, label, value, onChange, numeric = true, masked = false, maxLength, hint, autoFocus, ...rest },
  ref
) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-lg font-semibold">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={masked ? "password" : "text"}
        inputMode={numeric ? "numeric" : "text"}
        pattern={numeric ? "[0-9]*" : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={maxLength}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
        className="w-full min-h-14 rounded-xl border-2 border-[var(--border-light)] bg-[var(--surface)] px-4 text-2xl tracking-widest text-[var(--text-primary)] focus:border-[var(--primary-cyan)] focus:outline-none"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-[var(--muted-text)]">
          {hint}
        </p>
      )}
    </div>
  );
});

export default NumberField;

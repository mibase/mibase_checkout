import { useState } from "react";
import { checkoutApi, newRequestId } from "../lib/checkoutApi";
import { formatDate } from "../lib/format";

// Toy codes that make a toy unborrowable for everyone; a refusal with one of
// these greys the row out (FR-010e). Member-level refusals (limit, membership)
// leave the row as it is.
const TOY_LABELS = { ON_LOAN: "On loan", RESERVED: "Reserved", HELD: "Reserved" };
const TOY_CODES = new Set(["ON_LOAN", "RESERVED", "HELD", "NOT_IN_CIRCULATION", "QUARANTINE", "STOCKTAKE", "NOT_FOUND"]);

const smallButton =
  "min-h-11 shrink-0 rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

// Search results (FR-010b): Borrow (with due date), Return (on loan to this
// member), or greyed out with a general status and no button.
export default function ToyResults({ results, onChange, onBorrowed, onReturn }) {
  const [confirming, setConfirming] = useState(null); // { idcat, requestId }
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState({});

  if (results.length === 0) {
    return <p className="text-[var(--muted-text)]">No toys found. Check the toy ID or try part of the name.</p>;
  }

  function startBorrow(row) {
    setRowError((e) => ({ ...e, [row.idcat]: "" }));
    setConfirming({ idcat: row.idcat, requestId: newRequestId() }); // reused if Confirm is retried
  }

  async function confirmBorrow(row) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await checkoutApi.borrow(row.idcat, confirming.requestId);
      setConfirming(null);
      onBorrowed(r);
    } catch (err) {
      if (err.code === "SESSION_EXPIRED") return;
      setConfirming(null);
      setRowError((e) => ({ ...e, [row.idcat]: err.message }));
      if (TOY_CODES.has(err.code)) {
        onChange(results.map((x) =>
          x.idcat === row.idcat ? { ...x, action: "none", status_label: TOY_LABELS[err.code] ?? "Not available" } : x
        ));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ul className="space-y-2" aria-label="Search results">
      {results.map((row) => {
        const inactive = row.action === "none";
        const isConfirming = confirming?.idcat === row.idcat;
        return (
          <li
            key={row.idcat}
            className={`rounded-xl border-2 p-3 ${
              inactive
                ? "border-[var(--inactive-border)] bg-[var(--inactive-bg)] text-[var(--inactive-text)]"
                : "border-[var(--border-light)] bg-[var(--surface)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{row.name}</p>
                <p className={`text-sm ${inactive ? "" : "text-[var(--muted-text)]"}`}>
                  {row.idcat}
                  {row.action === "borrow" && <> · due back {formatDate(row.due)}</>}
                  {row.action === "return" && <> · on loan to you</>}
                  {inactive && <> · {row.status_label}</>}
                </p>
              </div>
              {row.action === "borrow" && !isConfirming && (
                <button
                  type="button"
                  onClick={() => startBorrow(row)}
                  disabled={busy}
                  className={`${smallButton} bg-[var(--primary-cyan)] text-[var(--on-accent)]`}
                >
                  Borrow
                </button>
              )}
              {row.action === "return" && (
                <button
                  type="button"
                  onClick={() => onReturn({ idcat: row.idcat, name: row.name })}
                  className={`${smallButton} border-2 border-[var(--primary-cyan)] bg-[var(--surface)] text-[var(--text-primary)]`}
                >
                  Return
                </button>
              )}
            </div>
            {isConfirming && (
              <div className="mt-3 space-y-2">
                <p>
                  Borrow this toy? Due back <span className="font-semibold">{formatDate(row.due)}</span>.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmBorrow(row)}
                    disabled={busy}
                    className={`${smallButton} flex-1 bg-[var(--primary-cyan)] text-[var(--on-accent)]`}
                  >
                    {busy ? "Borrowing…" : "Confirm borrow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    disabled={busy}
                    className={`${smallButton} border-2 border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-primary)]`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {rowError[row.idcat] && (
              <p role="alert" className="mt-2 text-sm font-semibold text-[var(--error-text)]">
                {rowError[row.idcat]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

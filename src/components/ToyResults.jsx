import { useState } from "react";
import { checkoutApi, newRequestId } from "../lib/checkoutApi";
import { formatDate } from "../lib/format";

// Toy codes that make a toy unborrowable for everyone; a refusal with one of
// these greys the row out (FR-010e). Member-level refusals (limit, membership)
// leave the row as it is.
const TOY_LABELS = { RESERVATION_TOY: "Reservation toy", ON_LOAN: "On loan", RESERVED: "Reserved", HELD: "Reserved" };
const TOY_CODES = new Set(["RESERVATION_TOY", "ON_LOAN", "RESERVED", "HELD", "NOT_IN_CIRCULATION", "QUARANTINE", "STOCKTAKE", "NOT_FOUND"]);

const smallButton =
  "min-h-11 shrink-0 rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

// The toy's photo (from search.php, '' when it has none; a teddy is shown then). Lazy-loaded so a
// long result list doesn't download every photo on mobile data. Tapping it
// shows it larger; tapping again shrinks it.
export function ToyPhoto({ url, inactive }) {
  const [failed, setFailed] = useState(false);
  const [big, setBig] = useState(false);
  const box = "h-20 w-20 shrink-0 rounded-xl border border-[var(--border-light)] bg-[var(--card-background)]";
  if (!url || failed) {
    // Same placeholder as the member portal's ItemImage: a teddy on the card background.
    return (
      <div className={`${box} flex items-center justify-center text-3xl ${inactive ? "opacity-60 grayscale" : ""}`} aria-hidden="true">
        🧸
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setBig(true)} className="shrink-0" aria-label="Show larger photo">
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`${box} object-cover ${inactive ? "opacity-60 grayscale" : ""}`}
        />
      </button>
      {big && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--on-accent)_80%,transparent)] p-4"
          onClick={() => setBig(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Toy photo"
        >
          <img src={url} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </>
  );
}

// Search results (FR-010b): Borrow (with due date), Return (on loan to this
// member), or greyed out with a general status and no button.
export default function ToyResults({ results, onChange, onBorrowed, onReturn, onBorrowError, returnsEnabled = false }) {
  const [confirming, setConfirming] = useState(null); // { idcat, requestId }
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState({});

  if (results.length === 0) {
    return <p className="text-[var(--muted-text)]">No toys found. Check the toy ID or try part of the name.</p>;
  }

  function startBorrow(row) {
    onBorrowError?.("");
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
      onBorrowError?.(`${row.idcat}: ${err.message}`);
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
              <ToyPhoto url={row.image_url} inactive={inactive} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{row.name}</p>
                <p className={`text-sm ${inactive ? "" : "text-[var(--muted-text)]"}`}>
                  {row.idcat}
                  {row.action === "borrow" && <> · due back {formatDate(row.due)}</>}
                  {row.action === "return" && <span className="ml-2 inline-flex rounded-full bg-[var(--primary-cyan)] px-2 py-0.5 text-xs font-semibold text-[var(--on-accent)]">On loan to you</span>}
                  {inactive && (row.status_label === "On loan" ? <span className="ml-2 inline-flex rounded-full border border-[var(--inactive-border)] bg-[var(--card-background)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)]">On loan</span> : <> · {row.status_label}</>)}
                </p>
                {row.toy_status && row.toy_status.toUpperCase() !== "ACTIVE" && <p className="mt-1 text-sm font-semibold text-[var(--error-text)]">{row.toy_status}</p>}
                {row.alert && <p className="mt-1 text-sm font-semibold text-[var(--error-text)]">{row.alert.replace(/[\r\n]+/g, " ")}</p>}
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
              {returnsEnabled && row.action === "return" && (
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

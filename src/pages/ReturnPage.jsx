import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NumberField from "../components/NumberField";
import BigButton from "../components/BigButton";
import Message from "../components/Message";
import PhotoCapture from "../components/PhotoCapture";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi, newRequestId } from "../lib/checkoutApi";
import { formatDate } from "../lib/format";

// Return: pick a current loan (or type its toy ID) -> take photo -> confirm.
export default function ReturnPage() {
  const navigate = useNavigate();
  const { addReturned } = useCheckout();
  const [loans, setLoans] = useState(null);
  const [selected, setSelected] = useState(null); // {transaction_id?, idcat, name?}
  const [typed, setTyped] = useState("");
  const [photo, setPhoto] = useState(null);
  const [requestId, setRequestId] = useState("");
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await checkoutApi.loans();
      setLoans(r.loans);
    } catch (err) {
      if (err.code !== "SESSION_EXPIRED") setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function choose(item) {
    setSelected(item);
    setPhoto(null);
    setError("");
    setRequestId(newRequestId()); // kept for retries of this return
  }

  function chooseTyped(e) {
    e.preventDefault();
    const id = typed.trim().toUpperCase();
    if (!id) return;
    const match = loans?.find((l) => l.idcat.toUpperCase() === id);
    choose(match ?? { idcat: id });
  }

  async function confirm() {
    if (!photo || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await checkoutApi.returnToy({
        transactionId: selected.transaction_id,
        idcat: selected.idcat,
        requestId,
        photoBlob: photo,
      });
      addReturned({ idcat: r.idcat, name: r.name, late: r.late });
      setDone(r);
      setSelected(null);
      setPhoto(null);
      setTyped("");
      setLoans((ls) => ls?.filter((l) => l.idcat !== r.idcat) ?? ls);
    } catch (err) {
      if (err.code === "SESSION_EXPIRED") return;
      if (err.code === "PHOTO_REQUIRED" || err.code === "PHOTO_INVALID") setPhoto(null);
      if (err.code === "NOT_ON_LOAN_TO_YOU") setSelected(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <Message tone="success" title="Returned">
          <p>
            <span className="font-semibold">{done.name}</span> ({done.idcat})
          </p>
          {done.late && <p className="mt-1 text-[var(--error-text)]">{done.message}</p>}
          {!done.late && <p className="mt-1">Thank you!</p>}
        </Message>
        <div className="space-y-3">
          {loans?.length > 0 && <BigButton onClick={() => setDone(null)}>Return another toy</BigButton>}
          <BigButton variant="secondary" onClick={() => navigate("/borrow")}>
            Borrow a toy
          </BigButton>
          <BigButton variant="secondary" onClick={() => navigate("/done")}>
            Finish
          </BigButton>
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Return a toy</h1>
        <Message tone="info" title={selected.name ?? selected.idcat}>
          Toy ID {selected.idcat}
        </Message>
        <PhotoCapture photo={photo} onChange={setPhoto} />
        {error && <Message tone="error">{error}</Message>}
        <BigButton onClick={confirm} disabled={!photo || busy}>
          {busy ? "Returning…" : error ? "Try again" : "Confirm return"}
        </BigButton>
        <BigButton variant="secondary" onClick={() => setSelected(null)} disabled={busy}>
          Choose a different toy
        </BigButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Return a toy</h1>
      {error && <Message tone="error">{error}</Message>}
      {loans === null && !error && <p className="text-[var(--muted-text)]">Loading your toys…</p>}
      {loans?.length === 0 && <Message tone="info">You have nothing to return.</Message>}
      {loans?.length > 0 && (
        <>
          <p className="text-[var(--muted-text)]">Tap the toy you are returning.</p>
          <ul className="space-y-2">
            {loans.map((l) => (
              <li key={l.transaction_id}>
                <button
                  type="button"
                  onClick={() => choose(l)}
                  className="w-full min-h-14 rounded-xl border-2 border-[var(--border-light)] bg-[var(--surface)] p-3 text-left focus:border-[var(--primary-cyan)] focus:outline-none"
                >
                  <span className="block font-semibold">{l.name}</span>
                  <span className="text-sm text-[var(--muted-text)]">
                    {l.idcat} · due {formatDate(l.due)}
                  </span>
                  {l.overdue && (
                    <span className="ml-2 rounded bg-[var(--error-text)] px-2 py-0.5 text-xs font-bold text-[var(--on-error)]">
                      Overdue
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={chooseTyped} className="space-y-3">
            <NumberField
              id="return-toy-id"
              label="Or type the toy ID"
              numeric={false}
              value={typed}
              onChange={(v) => setTyped(v.toUpperCase())}
              maxLength={20}
              autoCapitalize="characters"
            />
            <BigButton type="submit" variant="secondary" disabled={!typed.trim()}>
              Use this toy ID
            </BigButton>
          </form>
        </>
      )}
      <BigButton variant="secondary" onClick={() => navigate("/choose")}>
        Back
      </BigButton>
    </div>
  );
}

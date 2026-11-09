import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NumberField from "../components/NumberField";
import BigButton from "../components/BigButton";
import Message from "../components/Message";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi, newRequestId } from "../lib/checkoutApi";
import { formatDate } from "../lib/format";

// Borrow: toy ID -> show name and due date -> confirm -> "Borrowed! Due ...".
export default function BorrowPage() {
  const navigate = useNavigate();
  const { addBorrowed } = useCheckout();
  const [idcat, setIdcat] = useState("");
  const [toy, setToy] = useState(null); // lookup result
  const [requestId, setRequestId] = useState("");
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function find(e) {
    e.preventDefault();
    if (!idcat.trim() || busy) return;
    setBusy(true);
    setError("");
    setToy(null);
    try {
      const t = await checkoutApi.toy(idcat);
      setToy(t);
      setRequestId(newRequestId()); // reused if Confirm is retried
    } catch (err) {
      if (err.code !== "SESSION_EXPIRED") setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await checkoutApi.borrow(toy.idcat, requestId);
      addBorrowed({ idcat: r.idcat, name: r.name, due: r.due });
      setDone(r);
      setToy(null);
    } catch (err) {
      if (err.code !== "SESSION_EXPIRED") setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function another() {
    setDone(null);
    setIdcat("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (done) {
    return (
      <div className="space-y-6">
        <Message tone="success" title="Borrowed!">
          <p>
            <span className="font-semibold">{done.name}</span> ({done.idcat})
          </p>
          <p className="mt-1">
            Due back <span className="font-semibold">{formatDate(done.due)}</span>
          </p>
          {Number(done.rent_charged) > 0 && (
            <p className="mt-1 text-sm">A rent charge of ${done.rent_charged} was added to your account.</p>
          )}
        </Message>
        <div className="space-y-3">
          <BigButton onClick={another}>Borrow another toy</BigButton>
          <BigButton variant="secondary" onClick={() => navigate("/return")}>
            Return a toy
          </BigButton>
          <BigButton variant="secondary" onClick={() => navigate("/done")}>
            Finish
          </BigButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Borrow a toy</h1>
      <form onSubmit={find} className="space-y-4">
        <NumberField
          ref={inputRef}
          id="toy-id"
          label="Toy ID"
          numeric={false}
          value={idcat}
          onChange={(v) => {
            setIdcat(v.toUpperCase());
            setToy(null);
          }}
          maxLength={20}
          autoCapitalize="characters"
          hint="The ID printed on the toy's label, e.g. BG10."
          autoFocus
        />
        {!toy && (
          <BigButton type="submit" disabled={!idcat.trim() || busy}>
            {busy ? "Looking…" : "Find toy"}
          </BigButton>
        )}
      </form>

      {error && <Message tone="error">{error}</Message>}

      {toy && toy.can_borrow && (
        <div className="space-y-4">
          <Message tone="info" title={toy.name}>
            <p>Toy ID {toy.idcat}</p>
            <p className="mt-1">
              Due back <span className="font-semibold">{formatDate(toy.due)}</span>
            </p>
          </Message>
          <BigButton onClick={confirm} disabled={busy}>
            {busy ? "Borrowing…" : "Confirm borrow"}
          </BigButton>
        </div>
      )}
      {toy && !toy.can_borrow && (
        <Message tone="error" title={toy.name}>
          {toy.reason}
        </Message>
      )}

      <BigButton variant="secondary" onClick={() => navigate("/choose")}>
        Back
      </BigButton>
    </div>
  );
}

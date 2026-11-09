import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NumberField from "../components/NumberField";
import BigButton from "../components/BigButton";
import Message from "../components/Message";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi } from "../lib/checkoutApi";

// Step 1: member ID. Shows whether self-checkout is switched on.
export default function StartPage() {
  const navigate = useNavigate();
  const { memberId, setMemberId, notice, setNotice, reset } = useCheckout();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    checkoutApi
      .status()
      .then((s) => alive && setStatus(s))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  // A visit left open in this browser (e.g. after a reload) can't be resumed
  // without the in-memory token, so end it on the server.
  useEffect(() => {
    if (status?.session) checkoutApi.finish().catch(() => {});
  }, [status]);

  function submit(e) {
    e.preventDefault();
    if (!memberId) return;
    setNotice("");
    navigate("/pin");
  }

  if (error) return <Message tone="error" title="Can't connect">{error}</Message>;
  if (!status) return <p className="text-[var(--muted-text)]">Loading…</p>;

  if (!status.enabled) {
    return (
      <Message tone="info" title="Self-checkout isn't available">
        Please see a volunteer to borrow or return toys.
      </Message>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{status.library_name || "Toy library"}</h1>
        <p className="mt-1 text-[var(--muted-text)]">Borrow or return toys with your phone.</p>
      </div>
      {notice && <Message tone="info">{notice}</Message>}
      <NumberField
        id="member-id"
        label="Member number"
        value={memberId}
        onChange={(v) => {
          if (notice) reset();
          setMemberId(v);
        }}
        maxLength={10}
        hint="The number on your membership card."
        autoFocus
      />
      <BigButton type="submit" disabled={!memberId}>
        Next
      </BigButton>
    </form>
  );
}

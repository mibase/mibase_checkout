import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import NumberField from "../components/NumberField";
import BigButton from "../components/BigButton";
import Message from "../components/Message";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi } from "../lib/checkoutApi";

// Step 2: PIN. Always shown, whatever ID was typed. The PIN lives only in this
// component's state and is cleared as soon as the request is sent.
export default function PinPage() {
  const navigate = useNavigate();
  const { memberId, startVisit } = useCheckout();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!memberId) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    if (pin.length !== 4 || busy) return;
    const typed = pin;
    setPin("");
    setBusy(true);
    setError("");
    try {
      const visit = await checkoutApi.verify(memberId, typed);
      startVisit(visit);
      navigate("/choose", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="text-[var(--muted-text)]">
        Member number <span className="font-semibold text-[var(--text-primary)]">{memberId}</span>
      </p>
      {error && <Message tone="error">{error}</Message>}
      <NumberField
        id="pin"
        label="Your 4-digit PIN"
        value={pin}
        onChange={setPin}
        masked
        maxLength={4}
        autoFocus
        hint="No PIN? Please see a volunteer."
      />
      <BigButton type="submit" disabled={pin.length !== 4 || busy}>
        {busy ? "Checking…" : "Continue"}
      </BigButton>
      <BigButton variant="secondary" onClick={() => navigate("/")}>
        Back
      </BigButton>
    </form>
  );
}

import { useNavigate } from "react-router-dom";
import BigButton from "../components/BigButton";
import { useCheckout } from "../context/CheckoutContext";

// Step 3: Borrow, Return, or Finish (Finish shows the summary first; the
// visit ends from the summary screen, constitution IV).
export default function ChoosePage() {
  const navigate = useNavigate();
  const { firstName, summary } = useCheckout();
  const done = summary.borrowed.length + summary.returned.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hi {firstName}</h1>
      <p className="text-[var(--muted-text)]">What would you like to do?</p>
      <div className="space-y-3">
        <BigButton onClick={() => navigate("/borrow")}>Borrow a toy</BigButton>
        <BigButton onClick={() => navigate("/return")}>Return a toy</BigButton>
        <BigButton variant="secondary" onClick={() => navigate("/done")}>
          {done ? "Finish" : "Cancel"}
        </BigButton>
      </div>
    </div>
  );
}

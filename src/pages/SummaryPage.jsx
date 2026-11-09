import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BigButton from "../components/BigButton";
import { useCheckout } from "../context/CheckoutContext";
import { checkoutApi } from "../lib/checkoutApi";
import { formatDate } from "../lib/format";

const AUTO_END_SECONDS = 30;

// Last screen INSIDE the visit (FR-021, constitution IV). "Done" or 30 seconds
// without a tap ends the visit on the server, clears memory, and shows the
// blank start screen; replace navigation keeps Back from showing member data.
export default function SummaryPage() {
  const navigate = useNavigate();
  const { firstName, summary, reset } = useCheckout();
  const [left, setLeft] = useState(AUTO_END_SECONDS);
  const ended = useRef(false);

  const end = useCallback(async () => {
    if (ended.current) return;
    ended.current = true;
    try {
      await checkoutApi.finish();
    } catch {
      /* the session also expires on its own */
    }
    reset();
    navigate("/", { replace: true });
  }, [navigate, reset]);

  useEffect(() => {
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left <= 0) end();
  }, [left, end]);

  const { borrowed, returned } = summary;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Thanks, {firstName}!</h1>
      {borrowed.length === 0 && returned.length === 0 && (
        <p className="text-[var(--muted-text)]">Nothing was borrowed or returned this time.</p>
      )}
      {borrowed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Borrowed</h2>
          <ul className="mt-2 space-y-2">
            {borrowed.map((t, i) => (
              <li key={`b${i}`} className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-light)]">
                <span className="font-semibold">{t.name}</span> <span className="text-[var(--muted-text)]">({t.idcat})</span>
                <br />
                Due back <span className="font-semibold">{formatDate(t.due)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {returned.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Returned</h2>
          <ul className="mt-2 space-y-2">
            {returned.map((t, i) => (
              <li key={`r${i}`} className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-light)]">
                <span className="font-semibold">{t.name}</span> <span className="text-[var(--muted-text)]">({t.idcat})</span>
                {t.late && <span className="block text-[var(--error-text)]">Returned late, please see a volunteer about any charge.</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <BigButton onClick={end}>Done</BigButton>
      <p className="text-center text-sm text-[var(--muted-text)]">This screen closes in {Math.max(left, 0)} seconds.</p>
    </div>
  );
}

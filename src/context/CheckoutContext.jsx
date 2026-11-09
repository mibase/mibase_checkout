import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setCheckoutToken, setSessionExpiredHandler } from "../lib/api";

// In-memory state for one verified visit. Never holds the PIN, and nothing is
// written to browser storage (constitution I). reset() clears everything.
const CheckoutContext = createContext(null);

const emptySummary = () => ({ borrowed: [], returned: [] });

export function CheckoutProvider({ children }) {
  const [memberId, setMemberId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [summary, setSummary] = useState(emptySummary);
  const [notice, setNotice] = useState("");
  const [expiredAt, setExpiredAt] = useState(0);

  const reset = useCallback((message = "") => {
    setCheckoutToken(null);
    setMemberId("");
    setFirstName("");
    setSummary(emptySummary());
    setNotice(message);
  }, []);

  const startVisit = useCallback(({ first_name, token }) => {
    setCheckoutToken(token);
    setFirstName(first_name);
    setSummary(emptySummary());
    setNotice("");
  }, []);

  const addBorrowed = useCallback((item) => setSummary((s) => ({ ...s, borrowed: [...s.borrowed, item] })), []);
  const addReturned = useCallback((item) => setSummary((s) => ({ ...s, returned: [...s.returned, item] })), []);

  // Any API call answering SESSION_EXPIRED ends the visit (FR-008); pages
  // watch `expiredAt` and go back to the start screen.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      reset("Your session ended. Please start again.");
      setExpiredAt(Date.now());
    });
    return () => setSessionExpiredHandler(null);
  }, [reset]);

  const value = useMemo(
    () => ({
      memberId, setMemberId, firstName, summary, setSummary, notice, setNotice, expiredAt,
      reset, startVisit, addBorrowed, addReturned, verified: firstName !== "",
    }),
    [memberId, firstName, summary, notice, expiredAt, reset, startVisit, addBorrowed, addReturned]
  );
  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  return useContext(CheckoutContext);
}

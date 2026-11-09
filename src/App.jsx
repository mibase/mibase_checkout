import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import StartPage from "./pages/StartPage";
import PinPage from "./pages/PinPage";
import ChoosePage from "./pages/ChoosePage";
import BorrowPage from "./pages/BorrowPage";
import ReturnPage from "./pages/ReturnPage";
import SummaryPage from "./pages/SummaryPage";
import { useCheckout } from "./context/CheckoutContext";

// Pages after the PIN need a verified visit; otherwise back to the start.
function RequireVisit({ children }) {
  const { verified } = useCheckout();
  return verified ? children : <Navigate to="/" replace />;
}

// When the server says the session expired, leave whatever page we are on (FR-008).
function ExpiryWatcher() {
  const { expiredAt } = useCheckout();
  const navigate = useNavigate();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (expiredAt) navigate("/", { replace: true });
  }, [expiredAt, navigate]);
  return null;
}

export default function App() {
  return (
    <>
      <ExpiryWatcher />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<StartPage />} />
          <Route path="/pin" element={<PinPage />} />
          <Route path="/choose" element={<RequireVisit><ChoosePage /></RequireVisit>} />
          <Route path="/borrow" element={<RequireVisit><BorrowPage /></RequireVisit>} />
          <Route path="/return" element={<RequireVisit><ReturnPage /></RequireVisit>} />
          <Route path="/done" element={<RequireVisit><SummaryPage /></RequireVisit>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

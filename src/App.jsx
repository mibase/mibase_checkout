import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import StartPage from "./pages/StartPage";
import PinPage from "./pages/PinPage";
import MyToysPage from "./pages/MyToysPage";
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
  // Act once per expiry: `navigate` changes on every page change, so without
  // this an old expiry would keep sending the member back to the start screen.
  const handled = useRef(expiredAt);
  useEffect(() => {
    if (!expiredAt || expiredAt === handled.current) return;
    handled.current = expiredAt;
    navigate("/", { replace: true });
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
          <Route path="/toys" element={<RequireVisit><MyToysPage /></RequireVisit>} />
          <Route path="/done" element={<RequireVisit><SummaryPage /></RequireVisit>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

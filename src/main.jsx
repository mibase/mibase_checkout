import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CheckoutProvider } from "./context/CheckoutContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <CheckoutProvider>
        <App />
      </CheckoutProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import { API_BASE } from "./apiConfig";

// The verified visit's request secret (X-Checkout-Token). Held in memory only,
// never in localStorage/sessionStorage; set by CheckoutContext after verify.
let checkoutToken = null;
let onSessionExpired = null;

export function setCheckoutToken(token) {
  checkoutToken = token;
}

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, formData } = {}) {
  const headers = { Accept: "application/json" };
  if (checkoutToken) headers["X-Checkout-Token"] = checkoutToken;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Couldn't reach the library. Check your connection and try again.", 0, "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(data.error || `Something went wrong (${res.status}). Please try again.`, res.status, data.code);
    if (err.code === "SESSION_EXPIRED" && onSessionExpired) onSessionExpired();
    throw err;
  }
  return data;
}

export const apiGet = (path) => request(path);
export const apiPost = (path, body = {}) => request(path, { method: "POST", body });
export const apiUpload = (path, formData) => request(path, { method: "POST", formData });

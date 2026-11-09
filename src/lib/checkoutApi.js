// Wrappers for the member self-checkout endpoints (specs contracts/member-api.md).
import { apiGet, apiPost, apiUpload } from "./api";

export const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const checkoutApi = {
  status: () => apiGet("/status.php"),
  verify: (memberId, pin) => apiPost("/verify.php", { member_id: memberId, pin }),
  loans: () => apiGet("/loans.php"),
  toy: (idcat) => apiPost("/toy.php", { idcat }),
  borrow: (idcat, requestId) => apiPost("/borrow.php", { idcat, request_id: requestId }),
  returnToy: ({ transactionId, idcat, requestId, photoBlob }) => {
    const fd = new FormData();
    if (transactionId) fd.append("transaction_id", String(transactionId));
    else fd.append("idcat", idcat);
    fd.append("request_id", requestId);
    fd.append("photo", photoBlob, "return.jpg");
    return apiUpload("/return.php", fd);
  },
  summary: () => apiGet("/summary.php"),
  finish: () => apiPost("/finish.php"),
};

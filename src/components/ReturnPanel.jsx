import { useState } from "react";
import BigButton from "./BigButton";
import Message from "./Message";
import PhotoCapture from "./PhotoCapture";

// Photo + confirm step for one toy or for Return All (FR-016, FR-016a, FR-018a).
// onConfirm(photoBlob) does the upload; it throws ApiError on failure. The
// parent keeps the request id so a retry is not recorded twice (FR-019).
export default function ReturnPanel({ title, children, hint, onConfirm, onCancel }) {
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!photo || busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(photo);
    } catch (err) {
      if (err.code === "SESSION_EXPIRED") return;
      if (err.code === "PHOTO_REQUIRED" || err.code === "PHOTO_INVALID") setPhoto(null);
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Message tone="info">{children}</Message>
      <PhotoCapture photo={photo} onChange={setPhoto} hint={hint} />
      {error && <Message tone="error">{error}</Message>}
      <BigButton onClick={confirm} disabled={!photo || busy}>
        {busy ? "Returning…" : error ? "Try again" : "Confirm return"}
      </BigButton>
      <BigButton variant="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </BigButton>
    </div>
  );
}

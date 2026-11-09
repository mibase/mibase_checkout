import { useEffect, useRef, useState } from "react";
import BigButton from "./BigButton";
import Message from "./Message";
import { resizeToJpeg } from "../lib/photo";

// Opens the phone camera (capture="environment"), shows a preview, and hands
// the resized JPEG blob to onChange. If the camera is blocked or nothing is
// chosen, explains what to do (constitution IV).
const DEFAULT_HINT = "Take a photo of the toy on the returns shelf, just the toy please.";

export default function PhotoCapture({ photo, onChange, hint = DEFAULT_HINT }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!photo) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function picked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await resizeToJpeg(file));
    } catch (err) {
      setError(err.message || "Couldn't read that photo. Please take it again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[var(--muted-text)]">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={picked}
        aria-label="Take a photo of the toy"
      />
      {preview && (
        <img
          src={preview}
          alt="Photo of the toy you are returning"
          className="w-full max-h-72 rounded-xl border border-[var(--border-light)] object-contain bg-[var(--surface)]"
        />
      )}
      <BigButton variant={photo ? "secondary" : "primary"} onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Preparing photo…" : photo ? "Retake photo" : "Take photo"}
      </BigButton>
      {error && (
        <Message tone="error">
          {error} If your camera doesn't open, allow camera access for this site in your browser settings, or
          return the toy at the desk.
        </Message>
      )}
    </div>
  );
}

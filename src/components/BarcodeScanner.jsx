import { useEffect, useRef, useState } from "react";

// Full-screen camera view that reads a toy's barcode and hands back its text.
// ZXing is loaded only when the scanner opens, so it adds nothing to the first
// page load. Works on iPhone Safari and Android Chrome; the camera needs HTTPS
// (or localhost). Typing the toy ID stays available if scanning can't be used.
export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let controls = null;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Scanning needs a secure (https) connection on this phone. Please type the toy ID instead.");
        setStarting(false);
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (stopped) return;
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.CODE_128,
              BarcodeFormat.CODE_39,
              BarcodeFormat.CODE_93,
              BarcodeFormat.CODABAR,
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.UPC_A,
              BarcodeFormat.ITF,
              BarcodeFormat.QR_CODE,
            ],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result, _err, c) => {
            if (!result || stopped) return;
            const text = result.getText().trim();
            if (!text) return;
            stopped = true;
            c.stop();
            navigator.vibrate?.(60);
            onScan(text);
          }
        );
        if (stopped) controls.stop();
        else setStarting(false);
      } catch (err) {
        if (stopped) return;
        setStarting(false);
        const name = err?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Camera access was blocked. Allow the camera for this site in your browser settings, or type the toy ID.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No camera was found on this device. Please type the toy ID instead.");
        } else if (name === "NotReadableError") {
          setError("The camera is being used by another app. Close it and try again, or type the toy ID.");
        } else {
          setError("Couldn't start the camera. Please type the toy ID instead.");
        }
      }
    }

    start();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      stopped = true;
      controls?.stop();
      document.removeEventListener("keydown", onKey);
    };
  }, [onScan, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan toy barcode"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--on-accent)] text-[var(--white)]"
    >
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="h-36 w-full max-w-xs rounded-2xl border-4 border-[var(--primary-cyan)]" />
          </div>
        )}
      </div>
      <div className="space-y-3 bg-[var(--on-accent)] p-4">
        {error ? (
          <p role="alert" className="text-center">
            {error}
          </p>
        ) : (
          <p className="text-center" aria-live="polite">
            {starting ? "Starting the camera…" : "Point the camera at the barcode on the toy's label."}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-14 rounded-xl bg-[var(--white)] px-4 text-lg font-semibold text-[var(--on-accent)]"
        >
          {error ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

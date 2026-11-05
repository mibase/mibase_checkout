import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function HomePage() {
  const [status, setStatus] = useState({ state: "loading" });

  useEffect(() => {
    apiGet("/health.php")
      .then((data) => setStatus({ state: "ok", data }))
      .catch((err) => setStatus({ state: "error", message: err.message }));
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome</h1>
      <div className="rounded-lg bg-[var(--surface)] border border-[var(--border-light)] p-4">
        <p className="text-sm text-[var(--muted-text)]">API status</p>
        {status.state === "loading" && <p>Checking…</p>}
        {status.state === "ok" && (
          <p>
            PHP {status.data.php} · database{" "}
            {status.data.db ? "connected" : `not connected (${status.data.db_error})`}
          </p>
        )}
        {status.state === "error" && (
          <p className="text-[var(--error-text)]">{status.message}</p>
        )}
      </div>
    </section>
  );
}

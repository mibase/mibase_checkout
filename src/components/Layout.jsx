import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { checkoutApi } from "../lib/checkoutApi";

// Library header on every screen (FR-020a): the library's logo (config
// library.logo_url, same as the member portal) to the left of its name. No logo, or one
// that fails to load, leaves just the name.
export default function Layout() {
  const [library, setLibrary] = useState({ name: "", logo: "" });
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    checkoutApi
      .status()
      .then((s) => alive && setLibrary({ name: s.library_name || "", logo: s.logo_url || "" }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const showLogo = library.logo && !logoFailed;
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-light)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-md items-center justify-start gap-3 px-4 py-4">
          {showLogo && (
            <img
              src={library.logo}
              alt=""
              className="h-10 w-10 shrink-0 object-contain"
              onError={() => setLogoFailed(true)}
            />
          )}
          <p className="min-w-0 text-lg font-bold">{library.name || "Toy library"}</p>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

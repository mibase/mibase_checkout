import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-light)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[var(--container-width)] px-4 py-4 font-semibold">
          Mibase Checkout
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-[var(--container-width)] px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

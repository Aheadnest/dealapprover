import { Link, useRouterState } from "@tanstack/react-router";
import { clearSession } from "../../lib/auth/session";
import { Logo } from "../Logo";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  to: string;
}

const NAV: NavItem[] = [
  { label: "Items", to: "/app/items" },
  { label: "Scans", to: "/app/scans" },
  { label: "Account", to: "/app/account" },
  { label: "Billing", to: "/app/billing" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const state = useRouterState();
  const currentPath = state.location.pathname;

  function handleLogout() {
    clearSession();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-page">
      <header className="bg-white border-b border-line shadow-nav sticky top-0 z-40">
        <div className="max-w-content mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/app/items" aria-label="DealApprover home">
            <Logo size="md" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => {
              const active = currentPath.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-ink text-white" : "text-ink-soft hover:text-ink hover:bg-bg-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button onClick={handleLogout} className="ml-2 btn-ghost">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-content mx-auto w-full px-6 py-10">{children}</main>

      <footer className="border-t border-line py-6">
        <div className="max-w-content mx-auto px-6 text-xs text-ink-mute flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} DealApprover</span>
          <span>
            <a href="https://dealapprover.com" className="hover:text-ink">
              dealapprover.com
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

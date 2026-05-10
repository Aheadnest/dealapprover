import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRefreshToken, getAccessToken, setAccessToken, setRefreshToken, clearSession } from "../../lib/auth/session";
import { AppShell } from "../../components/layout/AppShell";

export const Route = createFileRoute("/app")({
  beforeLoad: () => {
    if (!getRefreshToken() && !getAccessToken()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  // Synchronously decide ready: if we already have an access token, ready immediately.
  // Otherwise mark "loading" and run the refresh effect.
  const initialReady = !!getAccessToken();
  const [ready, setReady] = useState(initialReady);

  useEffect(() => {
    if (initialReady) return;

    const rt = getRefreshToken();
    if (!rt) {
      window.location.href = "/login";
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) throw new Error("refresh failed");
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        setReady(true);
      } catch {
        clearSession();
        if (!cancelled) window.location.href = "/login";
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialReady]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page">
        <p className="text-ink-soft text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

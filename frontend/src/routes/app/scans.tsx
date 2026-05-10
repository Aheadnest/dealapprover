import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiRequestError } from "../../lib/api/api";

interface Account {
  plan: "free" | "pro" | "business";
}

interface ScanRow {
  slug: string;
  title: string | null;
  total_scans: number;
  unique_countries: number;
  first_scan: string | null;
  last_scan: string | null;
}

export const Route = createFileRoute("/app/scans")({ component: ScansPage });

function ScansPage() {
  const { data: account } = useQuery<Account>({
    queryKey: ["account"],
    queryFn: () => apiFetch<Account>("/api/v1/account"),
  });
  const isPaid = account?.plan === "pro" || account?.plan === "business";

  const { data: scans, isLoading, error } = useQuery<ScanRow[]>({
    queryKey: ["scans"],
    queryFn: () => apiFetch<ScanRow[]>("/api/v1/scans"),
    enabled: isPaid,
    retry: false,
  });

  if (!isPaid) {
    return (
      <div className="max-w-xl">
        <h1 className="text-ink font-bold mb-1" style={{ fontSize: 28, letterSpacing: "-0.01em" }}>
          Scan Analytics
        </h1>
        <p className="text-ink-soft text-sm mb-6">See who viewed your certificates and from where.</p>
        <div className="card p-10 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="font-semibold text-ink mb-1">Pro feature</p>
          <p className="text-ink-soft text-sm mb-4">Upgrade to Pro to track scans and unique countries.</p>
          <Link to="/app/billing" className="btn-primary">Upgrade to Pro</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-ink font-bold mb-1" style={{ fontSize: 28, letterSpacing: "-0.01em" }}>
        Scan Analytics
      </h1>
      <p className="text-ink-soft text-sm mb-6">Per-certificate scan counts (privacy-preserving aggregates).</p>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {error instanceof ApiRequestError && (
        <div className="card p-4 text-sm text-red-600">{error.message}</div>
      )}
      {scans && scans.length === 0 && (
        <div className="card p-10 text-center text-ink-soft text-sm">
          No scans yet. Your certificate trust pages haven't been visited.
        </div>
      )}
      <div className="space-y-2">
        {scans?.map((s) => (
          <div key={s.slug} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">{s.title ?? s.slug}</p>
              <p className="text-xs text-ink-mute mt-0.5">
                <code>{s.slug}</code>
                {s.last_scan && <> · last {new Date(s.last_scan).toLocaleDateString()}</>}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-right">
                <p className="font-bold text-ink">{s.total_scans}</p>
                <p className="text-xs text-ink-mute">scans</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink">{s.unique_countries}</p>
                <p className="text-xs text-ink-mute">countries</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

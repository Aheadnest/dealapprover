import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiPost } from "../../lib/api/api";
import { useState } from "react";
import { queryClient } from "../../lib/queryClient";

interface Account {
  id: string;
  email: string;
  display_name: string;
  plan: "free" | "pro" | "business";
  plan_status: string;
  email_verified_at: string | null;
  phone_e164: string | null;
  phone_verified_at: string | null;
  identity_verified_at: string | null;
  quota_used: number;
}

export const Route = createFileRoute("/app/account")({ component: AccountPage });

function AccountPage() {
  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["account"],
    queryFn: () => apiFetch<Account>("/api/v1/account"),
  });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);

  const phoneStartMutation = useMutation({
    mutationFn: () => apiPost("/api/v1/auth/phone/start", { phone_e164: phone }),
    onSuccess: () => setPhoneSent(true),
  });

  const phoneVerifyMutation = useMutation({
    mutationFn: () => apiPost("/api/v1/auth/phone/verify", { code }),
    onSuccess: () => {
      setPhoneSent(false);
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
  });

  const identityMutation = useMutation({
    mutationFn: () => apiPost<{ url: string }>("/api/v1/auth/identity/start"),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  if (isLoading || !account) return <p className="text-ink-soft">Loading…</p>;

  const verLevel = account.identity_verified_at ? "L2" : account.phone_verified_at ? "L1" : "L0";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-ink font-bold" style={{ fontSize: 28, letterSpacing: "-0.01em" }}>
          Account
        </h1>
        <p className="text-ink-soft text-sm mt-1">Manage profile, verification, and security.</p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-ink mb-4">Profile</h2>
        <div className="space-y-2.5 text-sm">
          <Row label="Email" value={account.email} />
          <Row label="Name" value={account.display_name} />
          <Row label="Email verified" value={account.email_verified_at ? "✓ Yes" : "Pending — check inbox"} />
          <Row label="Plan" value={account.plan.toUpperCase()} />
          <Row label="Certs used this month" value={String(account.quota_used)} />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink">Verification level</h2>
          <span className="badge-active">{verLevel}</span>
        </div>
        <div className="space-y-4">
          <VerifyStep
            done={!!account.email_verified_at}
            label="Email"
            description="Required to issue certificates."
          />
          <div>
            <VerifyStep
              done={!!account.phone_verified_at}
              label="Phone (L1 — Verified contact)"
              description="Adds a verified-contact badge. +2 free certs/month."
            />
            {!account.phone_verified_at && (
              <div className="mt-3 pl-7 space-y-2">
                {!phoneSent ? (
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="+351912345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input flex-1"
                    />
                    <button
                      onClick={() => phoneStartMutation.mutate()}
                      disabled={phoneStartMutation.isPending || !phone.startsWith("+")}
                      className="btn-secondary"
                    >
                      Send code
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="6-digit code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="input flex-1"
                      maxLength={6}
                    />
                    <button
                      onClick={() => phoneVerifyMutation.mutate()}
                      disabled={phoneVerifyMutation.isPending || code.length !== 6}
                      className="btn-primary"
                    >
                      Verify
                    </button>
                  </div>
                )}
                {phoneVerifyMutation.isError && (
                  <p className="text-red-600 text-xs">{(phoneVerifyMutation.error as Error).message}</p>
                )}
              </div>
            )}
          </div>
          <div>
            <VerifyStep
              done={!!account.identity_verified_at}
              label="Government ID (L2 — Premium-verified)"
              description="Adds a gold ID-verified badge. Pro only."
            />
            {!account.identity_verified_at && account.plan !== "free" && (
              <div className="mt-3 pl-7">
                <button
                  onClick={() => identityMutation.mutate()}
                  disabled={identityMutation.isPending}
                  className="btn-secondary"
                >
                  Start ID verification (Stripe)
                </button>
              </div>
            )}
            {!account.identity_verified_at && account.plan === "free" && (
              <p className="mt-2 pl-7 text-xs text-ink-mute">Upgrade to Pro to verify your ID.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyStep({ done, label, description }: { done: boolean; label: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          done ? "bg-brand/15 border border-brand/30" : "bg-bg-muted border border-line"
        }`}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-ink text-sm">{label}</p>
        <p className="text-ink-mute text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-mute">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

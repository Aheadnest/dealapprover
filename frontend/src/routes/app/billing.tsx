import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiPost } from "../../lib/api/api";

interface Account {
  plan: "free" | "pro" | "business";
  plan_status: string;
  plan_renews_at: string | null;
}

export const Route = createFileRoute("/app/billing")({ component: BillingPage });

function BillingPage() {
  const { data: account } = useQuery<Account>({
    queryKey: ["account"],
    queryFn: () => apiFetch<Account>("/api/v1/account"),
  });

  const upgradeMutation = useMutation({
    mutationFn: (plan: "pro" | "business") =>
      apiPost<{ url: string }>("/api/v1/billing/checkout", { plan }),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  const portalMutation = useMutation({
    mutationFn: () => apiPost<{ url: string }>("/api/v1/billing/portal"),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  const isPaid = account?.plan === "pro" || account?.plan === "business";

  const plans = [
    {
      id: "free" as const,
      name: "Free",
      price: "$0",
      period: "/mo",
      description: "Try out DealApprover with 3 certificates per month.",
      features: ["3 certificates / month", "L0 + L1 verification", "Trust pages", "Email support"],
      current: account?.plan === "free",
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: "$9.99",
      period: "/mo",
      description: "For active sellers. Unlimited certificates and scan analytics.",
      features: ["Unlimited certificates", "Scan analytics", "L2 ID verification", "Branded PDF stickers", "Priority support"],
      current: account?.plan === "pro",
      highlighted: true,
    },
    {
      id: "business" as const,
      name: "Business",
      price: "$29.99",
      period: "/mo",
      description: "For shops, refurbishers, and brands.",
      features: ["Everything in Pro", "API access (private beta)", "Custom branding (soon)", "Dedicated support"],
      current: account?.plan === "business",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-ink font-bold" style={{ fontSize: 32, letterSpacing: "-0.01em" }}>
          Billing
        </h1>
        <p className="text-ink-soft mt-1 text-sm">
          Current plan: <strong className="text-ink uppercase">{account?.plan ?? "—"}</strong>
          {account?.plan_renews_at && (
            <> · renews {new Date(account.plan_renews_at).toLocaleDateString()}</>
          )}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start mb-8">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`relative flex flex-col rounded-xl p-6 border ${
              p.highlighted ? "bg-ink border-ink text-white" : "bg-white border-line"
            }`}
          >
            {p.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-3 py-1 rounded-full">
                RECOMMENDED
              </div>
            )}
            <p className={`text-xs font-semibold mb-3 uppercase tracking-wide ${p.highlighted ? "text-ink-mute" : "text-ink-mute"}`}>
              {p.name}
            </p>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-bold">{p.price}</span>
              <span className={`text-sm mb-0.5 ${p.highlighted ? "text-ink-mute" : "text-ink-soft"}`}>
                {p.period}
              </span>
            </div>
            <p className={`text-xs leading-relaxed mb-5 ${p.highlighted ? "text-ink-mute" : "text-ink-soft"}`}>
              {p.description}
            </p>
            <ul className="flex flex-col gap-2.5 mb-6 flex-grow">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 text-brand`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className={p.highlighted ? "text-white" : "text-ink-soft"}>{f}</span>
                </li>
              ))}
            </ul>
            {p.current ? (
              <button disabled className="btn-secondary opacity-60 cursor-default">
                Current plan
              </button>
            ) : p.id === "free" ? (
              <button onClick={() => portalMutation.mutate()} className="btn-secondary">
                Manage subscription
              </button>
            ) : (
              <button
                onClick={() => upgradeMutation.mutate(p.id)}
                disabled={upgradeMutation.isPending}
                className={p.highlighted ? "btn-primary" : "btn-secondary"}
              >
                {upgradeMutation.isPending ? "Loading…" : `Upgrade to ${p.name}`}
              </button>
            )}
          </div>
        ))}
      </div>

      {isPaid && (
        <div className="card p-5">
          <p className="text-sm text-ink-soft mb-3">Need to change billing details or cancel?</p>
          <button onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending} className="btn-secondary">
            {portalMutation.isPending ? "Opening portal…" : "Open Stripe portal"}
          </button>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { apiPost } from "../lib/api/api";
import { AuthLayout } from "../components/AuthLayout";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/api/v1/auth/forgot-password", { email });
    } catch {
      // Intentionally ignored — we always show the same "check email" page to avoid enumeration
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`If an account exists for ${email}, we sent a reset link. It expires in 15 minutes.`}
      >
        <Link to="/login" className="btn-secondary w-full">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We'll email you a reset link valid for 15 minutes."
      footer={
        <Link to="/login" className="text-brand hover:text-brand-hover font-semibold">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            autoComplete="email"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthLayout>
  );
}

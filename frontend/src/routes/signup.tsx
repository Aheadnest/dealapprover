import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { apiPost } from "../lib/api/api";
import { setAccessToken, setRefreshToken } from "../lib/auth/session";
import { AuthLayout } from "../components/AuthLayout";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<AuthResponse>("/api/v1/auth/signup", { email, password });
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`We sent a verification link to ${email}. Verify it, then start issuing certificates.`}
      >
        <button onClick={() => void navigate({ to: "/app/items" })} className="btn-primary w-full">
          Continue to dashboard
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your free account"
      subtitle="3 free certificates / month. No card required."
      footer={
        <p>
          Already have an account?{" "}
          <Link to="/login" className="text-brand hover:text-brand-hover font-semibold">
            Sign in
          </Link>
        </p>
      }
    >
      <a
        href="/api/v1/auth/oauth/google/start?redirect=/app/items"
        className="btn-secondary w-full mb-4"
      >
        Continue with Google
      </a>
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 border-t border-line" />
        <span className="text-xs text-ink-mute uppercase tracking-wide">or</span>
        <div className="flex-1 border-t border-line" />
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating account…" : "Create free account"}
        </button>
      </form>
      <p className="mt-4 text-xs text-ink-mute text-center">
        By signing up you agree to our terms and privacy policy.
      </p>
    </AuthLayout>
  );
}

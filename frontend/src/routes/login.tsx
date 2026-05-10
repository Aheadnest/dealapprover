import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiPost } from "../lib/api/api";
import { setAccessToken, setRefreshToken } from "../lib/auth/session";
import { queryClient } from "../lib/queryClient";
import { AuthLayout } from "../components/AuthLayout";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!window.location.hash.startsWith("#access=")) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access = params.get("access");
    const refresh = params.get("refresh");
    if (access && refresh) {
      setAccessToken(access);
      setRefreshToken(refresh);
      history.replaceState(null, "", window.location.pathname);
      void navigate({ to: "/app/items" });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<AuthResponse>("/api/v1/auth/login", { email, password });
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      await queryClient.invalidateQueries();
      void navigate({ to: "/app/items" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Issue your next certificate in seconds."
      footer={
        <p>
          No account?{" "}
          <Link to="/signup" className="text-brand hover:text-brand-hover font-semibold">
            Sign up free
          </Link>
        </p>
      }
    >
      <a
        href="/api/v1/auth/oauth/google/start?redirect=/app/items"
        className="btn-secondary w-full mb-4"
      >
        <GoogleIcon /> Continue with Google
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="current-password"
          />
          <Link
            to="/forgot-password"
            className="text-xs text-brand hover:text-brand-hover float-right mt-1.5"
          >
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" fill="#34A853" />
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.16-3.16C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
    </svg>
  );
}

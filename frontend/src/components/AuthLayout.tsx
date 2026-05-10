import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      <div className="px-6 py-6">
        <Link to="/" aria-label="DealApprover home">
          <Logo size="md" />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1
              className="text-ink font-bold"
              style={{ fontSize: 28, lineHeight: 1.2, letterSpacing: "-0.02em" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-ink-soft mt-1" style={{ fontSize: 15 }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="card p-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

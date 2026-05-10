import { createFileRoute, redirect } from "@tanstack/react-router";
import { getRefreshToken } from "../lib/auth/session";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (getRefreshToken()) throw redirect({ to: "/app/items" });
    throw redirect({ to: "/login" });
  },
  component: () => null,
});

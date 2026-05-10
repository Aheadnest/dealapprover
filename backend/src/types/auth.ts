export type Plan = "free" | "pro" | "business";
export type PlanStatus = "active" | "past_due" | "canceled";

export interface AuthUser {
  userId: string;
  email: string;
  plan: Plan;
  planStatus: PlanStatus;
  emailVerifiedAt: string | null;
}

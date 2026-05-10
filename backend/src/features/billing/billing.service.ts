import type { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  createCheckoutSession,
  createOrRetrieveCustomer,
  createPortalSession,
  constructWebhookEvent,
} from "../../integrations/stripe/stripe.js";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { Errors, AppError } from "../../utils/errors.js";
import { env } from "../../config/env.js";

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  display_name: string;
  stripe_customer_id: string | null;
  plan: string;
}

export async function createCheckoutUrl(
  userId: string,
  email: string,
  plan: "pro" | "business",
): Promise<string> {
  const priceId =
    plan === "pro" ? env.stripePriceProMonthly : env.stripePriceBusinessMonthly;
  if (!priceId) throw new AppError("BILLING_NOT_CONFIGURED", "Billing not configured for this plan", 500);

  const [rows] = await executeQuery<UserRow[]>(
    "SELECT display_name, stripe_customer_id FROM users WHERE id = ?",
    [userId],
  );
  if (!rows.length) throw Errors.notFound("User");

  let customerId = rows[0].stripe_customer_id;
  if (!customerId) {
    customerId = await createOrRetrieveCustomer(email, rows[0].display_name);
    await executeQuery("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [customerId, userId]);
  }

  const successUrl = `${env.appUrl}/app/billing?success=1`;
  const cancelUrl = `${env.appUrl}/app/billing`;
  return createCheckoutSession(customerId, priceId, successUrl, cancelUrl);
}

export async function createPortalUrl(userId: string): Promise<string> {
  const [rows] = await executeQuery<UserRow[]>(
    "SELECT stripe_customer_id FROM users WHERE id = ?",
    [userId],
  );
  if (!rows.length || !rows[0].stripe_customer_id) {
    throw new AppError("NO_BILLING_ACCOUNT", "No billing account found", 400);
  }
  const returnUrl = `${env.appUrl}/app/billing`;
  return createPortalSession(rows[0].stripe_customer_id, returnUrl);
}

export async function handleStripeWebhook(rawBody: Buffer, sig: string): Promise<void> {
  let event;
  try {
    event = constructWebhookEvent(rawBody, sig);
  } catch {
    throw new AppError("WEBHOOK_INVALID", "Invalid webhook signature", 400);
  }

  // Idempotency
  const [existing] = await executeQuery<RowDataPacket[]>(
    "SELECT id FROM webhook_events WHERE event_id = ?",
    [event.id],
  );
  if (existing.length > 0) return;

  await executeQuery<ResultSetHeader>(
    "INSERT INTO webhook_events (provider, event_id, type, payload, received_at) VALUES ('stripe', ?, ?, ?, NOW(3))",
    [event.id, event.type, JSON.stringify(event)],
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as { customer: string; subscription: string };
      await handleSubscriptionChange(session.customer, "active");
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as unknown as {
        customer: string;
        status: string;
        current_period_end?: number;
        items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
      };
      const priceId = sub.items.data[0]?.price.id;
      const plan = priceId === env.stripePriceProMonthly ? "pro" : priceId === env.stripePriceBusinessMonthly ? "business" : "free";
      const periodEnd = sub.current_period_end ?? sub.items.data[0]?.current_period_end;
      const renewsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      await executeQuery(
        "UPDATE users SET plan = ?, plan_status = ?, plan_renews_at = ? WHERE stripe_customer_id = ?",
        [plan, sub.status === "active" ? "active" : "past_due", renewsAt, sub.customer],
      );
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as { customer: string };
      await executeQuery(
        "UPDATE users SET plan = 'free', plan_status = 'canceled', plan_renews_at = NULL WHERE stripe_customer_id = ?",
        [sub.customer],
      );
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as { customer: string };
      await handleSubscriptionChange(inv.customer, "past_due");
      break;
    }
    case "identity.verification_session.verified": {
      const session = event.data.object as { id: string; metadata: { user_id?: string } };
      const userId = session.metadata?.user_id;
      if (userId) {
        await executeQuery(
          "UPDATE users SET identity_verified_at = NOW(3) WHERE id = ?",
          [userId],
        );
      }
      break;
    }
  }

  await executeQuery(
    "UPDATE webhook_events SET processed_at = NOW(3) WHERE event_id = ?",
    [event.id],
  );
}

async function handleSubscriptionChange(customerId: string, status: string): Promise<void> {
  await executeQuery(
    "UPDATE users SET plan_status = ? WHERE stripe_customer_id = ?",
    [status, customerId],
  );
}

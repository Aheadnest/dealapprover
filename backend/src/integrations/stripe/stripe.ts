import Stripe from "stripe";
import { env } from "../../config/env.js";

export const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session.url!;
}

export async function createOrRetrieveCustomer(
  email: string,
  name: string,
): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
}

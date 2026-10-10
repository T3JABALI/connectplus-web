import { config } from '../config.js';
import { toLocal } from '../lib/phone.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sends the bundle to the customer. Resolves with { providerRef } on success and THROWS on any failure.
//
// "mock" pretends to deliver (development only).
// "http" is a TEMPLATE for a typical reseller API. Replace the request and the success check below
// with what YOUR provider's documentation says. The order reference is sent so a good provider can
// ignore a repeated request for the same order instead of delivering twice.
export async function deliverBundle({ order, offer }) {
  const { provider, apiUrl, apiKey } = config.delivery;

  if (provider === 'mock') {
    await sleep(300);
    return { providerRef: 'MOCK-' + order.ref };
  }

  if (provider === 'http') {
    if (!offer.provider_code) throw new Error(`Offer ${offer.id} has no provider_code set`);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        reference: order.ref,
        phone: toLocal(order.recipient_phone),
        product: offer.provider_code
      }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'success') {
      throw new Error(`Provider rejected the delivery: HTTP ${res.status} ${data.message || data.status || ''}`.trim());
    }
    return { providerRef: String(data.id || order.ref) };
  }

  throw new Error(`Unknown delivery provider: ${provider}`);
}

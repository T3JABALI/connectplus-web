import { config } from '../config.js';

// phone is 2547XXXXXXXX
export async function sendSms(phone, message) {
  const { provider, atUsername, atApiKey, atSenderId, atSandbox } = config.sms;

  if (provider === 'console') {
    console.log(`[SMS to ${phone}] ${message}`);
    return;
  }

  if (provider === 'africastalking') {
    const base = atSandbox ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
    const body = new URLSearchParams({ username: atUsername, to: '+' + phone, message });
    if (atSenderId) body.set('from', atSenderId);
    const res = await fetch(`${base}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: atApiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`SMS provider returned HTTP ${res.status}`);
    const data = await res.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (!recipient || !/success/i.test(recipient.status)) {
      throw new Error('SMS not accepted: ' + (recipient?.status || 'no recipient in response'));
    }
    return;
  }

  throw new Error(`Unknown SMS provider: ${provider}`);
}

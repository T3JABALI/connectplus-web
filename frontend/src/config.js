export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// With no API URL set, the app uses the in-browser mock API.
export const USE_MOCK = !API_URL;
// Customer support contacts (shown on the Help page)
export const SUPPORT_WHATSAPP = '0112581340';
export const SUPPORT_PHONE = '0112581340';
// Shown in the footer next to the network logo
export const NETWORK_MOTTO = 'Twaweza';
export const NETWORK_LOGO = '/safaricom-logo.png';
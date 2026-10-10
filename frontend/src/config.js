export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// With no API URL set, the app uses the in-browser mock API.
export const USE_MOCK = !API_URL;
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '0700 000 000';

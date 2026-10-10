const base = (size) => ({ width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true });
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const Cart = ({ size = 26 }) => (
  <svg {...base(size)} {...stroke}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6" /></svg>
);
export const Phone = ({ size = 26 }) => (
  <svg {...base(size)} {...stroke}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
);
export const Wifi = ({ size = 26 }) => (
  <svg {...base(size)} {...stroke} strokeWidth="2.2"><path d="M2 9a15 15 0 0 1 20 0" /><path d="M5.5 12.5a10 10 0 0 1 13 0" /><path d="M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="19.5" r="1" fill="currentColor" /></svg>
);
export const Users = ({ size = 26 }) => (
  <svg {...base(size)} {...stroke}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7" /></svg>
);
export const Gift = ({ size = 28 }) => (
  <svg {...base(size)} fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8S9 8 8 6.5 9 3 11 4.5 12 8 12 8zm0 0s3 0 4-1.5S15 3 13 4.5 12 8 12 8z" /></svg>
);
export const User = ({ size = 20 }) => (
  <svg {...base(size)} fill="currentColor"><circle cx="12" cy="8" r="4.2" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>
);
export const Whatsapp = ({ size = 16 }) => (
  <svg {...base(size)} fill="currentColor"><path fillRule="evenodd" d="M20.5 3.5A11 11 0 0 0 3.2 17.3L2 22l4.8-1.2A11 11 0 1 0 20.5 3.5zM12 20a8.9 8.9 0 0 1-4.5-1.2l-.3-.2-2.8.7.8-2.7-.2-.3A8.9 8.9 0 1 1 12 20z" /><path d="M16.9 13.3c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1a7.3 7.3 0 0 1-3.6-3.1c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" /></svg>
);
export const Check = ({ size = 30 }) => (
  <svg {...base(size)} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const WifiLogo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><path d="M5 15a21 21 0 0 1 30 0" fill="none" stroke="#1565e8" strokeWidth="4.5" strokeLinecap="round" /><path d="M10 21a14 14 0 0 1 20 0" fill="none" stroke="#1565e8" strokeWidth="4.5" strokeLinecap="round" /><path d="M15 27a7 7 0 0 1 10 0" fill="none" stroke="#22d3ee" strokeWidth="4.5" strokeLinecap="round" /><circle cx="20" cy="33" r="2.8" fill="#22d3ee" /></svg>
);

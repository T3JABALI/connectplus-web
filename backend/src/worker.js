import { reconcilePayments } from './services/orders.js';

// Runs inside the API process. Safe with one instance. With several, the claim queries use
// FOR UPDATE SKIP LOCKED so they do not collide.
export function startWorker() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await reconcilePayments();
    } catch (e) {
      console.error('Worker error:', e.message);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 10000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}

import app from './app.js';
import { config } from './config.js';
import { migrate, pool } from './db.js';
import { startWorker } from './worker.js';

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

async function main() {
  if (config.autoMigrate) await migrate();

  const server = app.listen(config.port, () => {
        console.log(`ConnectPlus API listening on port ${config.port} (${config.env}, mpesa=${config.mpesa.mode})`);
  });
  const stopWorker = config.runWorker ? startWorker() : () => {};

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    stopWorker();
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('Failed to start:', e.message);
  process.exit(1);
});

import { migrate, pool } from './db.js';

migrate()
  .then(() => { console.log('Migrations up to date.'); return pool.end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });

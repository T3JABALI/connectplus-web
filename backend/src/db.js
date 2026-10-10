import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

// Return bigint columns (COUNT, SUM of integers) as JS numbers. Our values stay far below 2^53.
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10
});
pool.on('error', (e) => console.error('Postgres pool error:', e.message));

export const query = (text, params) => pool.query(text, params);

// Runs fn inside a transaction. fn receives a client; use client.query(...) inside.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw e;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727274)'); // one migrator at a time
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('Applied migration', file);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${e.message}`);
      }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(727274)'); } catch { /* ignore */ }
    client.release();
  }
}

/**
 * e2e/helpers/db.ts
 * ─────────────────
 * SQL Server connection pool + typed query helpers.
 * Uses `mssql` with SQL Auth. All credentials come from .env.test via
 * playwright.config.ts → dotenv.config(). Never hard-code credentials here.
 *
 * Usage:
 *   import { db } from './helpers/db';
 *   const rows = await db.query<{ status: string }>(
 *     'SELECT [status] FROM [USER] WHERE [email] = @email',
 *     { email: 'foo@bar.com' }
 *   );
 *   await db.execute('DELETE FROM [USER] WHERE [userId] = @id', { id });
 */

import sql from 'mssql';

// ─── Connection config ────────────────────────────────────────────────────────
const config: sql.config = {
  server: process.env.DB_SERVER ?? 'localhost',
  database: process.env.DB_NAME ?? 'CinemaBookingDB',
  port: Number(process.env.DB_PORT ?? 1433),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    trustServerCertificate: true,   // dev/self-signed certs
    encrypt: false,
  },
  connectionTimeout: 10_000,
  requestTimeout: 15_000,
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

// ─── Singleton pool ───────────────────────────────────────────────────────────
let _pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (_pool && _pool.connected) {
    return _pool;
  }
  _pool = await new sql.ConnectionPool(config).connect();
  return _pool;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a SELECT and return typed rows.
 * Named params: use @paramName in query, pass { paramName: value } in params.
 */
async function query<T extends object = Record<string, unknown>>(
  queryText: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query<T>(queryText);
  return result.recordset;
}

/**
 * Run an INSERT/UPDATE/DELETE (fire-and-forget result).
 */
async function execute(
  queryText: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const pool = await getPool();
  const request = pool.request();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  await request.query(queryText);
}

/**
 * Close the connection pool. Call in globalTeardown if needed.
 */
async function close(): Promise<void> {
  if (_pool) {
    await _pool.close();
    _pool = null;
  }
}

export const db = { query, execute, close };

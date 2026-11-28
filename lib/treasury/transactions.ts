import 'server-only';
import type { Pool, PoolClient } from 'pg';

export class TreasuryError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export async function withTreasuryTransaction<T>(pool: Pool, execute: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    // Keep the legacy lock row only to serialize wallet operations across both
    // games and across rolling deployments. Its balance is never consulted.
    const locked = await client.query('SELECT id FROM demo_treasury WHERE id = 1 FOR UPDATE');
    if (locked.rowCount !== 1) throw new TreasuryError('TREASURY_NOT_INITIALIZED');
    const result = await execute(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}


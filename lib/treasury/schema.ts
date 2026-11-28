import 'server-only';
import type { Pool } from 'pg';
import { migrations } from './migrations';
let initialized:Promise<void>|undefined;
/** Transactional, serialized, repeat-safe migration for this fictitious demo. */
export function ensureDemoSchema(pool:Pool):Promise<void>{
 if(initialized)return initialized;
 initialized=(async()=>{const tx=await pool.connect();try{
  await tx.query('BEGIN');await tx.query("SET LOCAL lock_timeout = '10s'");await tx.query('SELECT pg_advisory_xact_lock($1)',[194851278]);
  await tx.query('CREATE TABLE IF NOT EXISTS demo_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const existing=await tx.query<{version:number}>('SELECT version FROM demo_schema_migrations');const versions=new Set(existing.rows.map(x=>x.version));
  for(const migration of migrations){if(!versions.has(migration.version)){await tx.query(migration.sql);await tx.query('INSERT INTO demo_schema_migrations(version) VALUES($1)',[migration.version]);}}
  await tx.query('COMMIT');
 }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}})().catch(e=>{initialized=undefined;throw e;});
 return initialized;
}

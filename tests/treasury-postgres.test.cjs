/* eslint-disable @typescript-eslint/no-require-imports */
// TEST_DATABASE_URL must point to a disposable PostgreSQL test database.
// Each run creates and drops its own isolated schema.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const url = process.env.TEST_DATABASE_URL;
test('two games cannot reserve the same remaining capacity concurrently', {skip: !url}, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'risk-pg-'));
  for(const name of ['risk','transactions']) {
    const src=fs.readFileSync(path.join(root,'lib/treasury',`${name}.ts`),'utf8').replace("import 'server-only';",'');
    const code=ts.transpile(src,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}).replace('require("./risk")','require("./risk.cjs")');
    fs.writeFileSync(path.join(dir,`${name}.cjs`),code);
  }
  const {withTreasuryTransaction,reserveRisk}=require(path.join(dir,'transactions.cjs'));
  const schema='test_'+randomBytes(8).toString('hex');
  const admin=new Pool({connectionString:url});
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:8});
    await pool.query(fs.readFileSync(path.join(root,'db/migrations/001_fictitious_treasury.sql'),'utf8'));
    for(let i=0;i<9;i++) await withTreasuryTransaction(pool,tx=>reserveRisk(tx,{betId:randomUUID(),playerId:randomUUID(),game:'skyjet',proposedRisk:100000n,operationId:randomUUID()}));
    const result=await Promise.allSettled(['skyjet','pilot-chicken'].map(game=>withTreasuryTransaction(pool,tx=>reserveRisk(tx,{betId:randomUUID(),playerId:randomUUID(),game,proposedRisk:100000n,operationId:randomUUID()}))));
    assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
    const failure=result.find(x=>x.status==='rejected');
    assert.equal(failure.reason.code,'RISK_HOURLY_LIMIT');
    const {rows}=await pool.query("SELECT sum(risk) AS risk FROM demo_risk_reservations WHERE status='open'");
    assert.equal(BigInt(rows[0].risk),1000000n);
  } finally {
    if(pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();fs.rmSync(dir,{recursive:true,force:true});
  }
});

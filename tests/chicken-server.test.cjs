/* eslint-disable @typescript-eslint/no-require-imports */
// PGlite exercises actual PostgreSQL SQL semantics in-process, not multi-client locking.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chicken-test-'));
for (const [name, source] of [['risk','lib/treasury/risk.ts'],['transactions','lib/treasury/transactions.ts'],['wallet','lib/treasury/wallet.ts'],['chicken','lib/treasury/chicken.ts'],['format','lib/pilot-chicken/format.ts']]) {
  const input = fs.readFileSync(path.join(root,source),'utf8').replace("import 'server-only';",'');
  let out = ts.transpile(input,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020});
  for (const dependency of ['risk','transactions','wallet']) out=out.replace(`require("./${dependency}")`,`require("./${dependency}.cjs")`);
  out=out.replace('require("../pilot-chicken/format")','require("./format.cjs")');
  fs.writeFileSync(path.join(dir,`${name}.cjs`),out);
}
const {withTreasuryTransaction}=require(path.join(dir,'transactions.cjs'));
const {chickenAction,chickenSnapshot}=require(path.join(dir,'chicken.cjs'));
const {createDemoWallet,openWager,finishWager}=require(path.join(dir,'wallet.cjs'));
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
test('chicken server applies, retries and restores an action atomically', async () => {
  const db=new PGlite();
  try {
    for(const migration of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','003_fictitious_chicken.sql','005_shared_wallet.sql']) await db.exec(fs.readFileSync(path.join(root,'db/migrations',migration),'utf8'));
    const pool={connect:async()=>({query:async(q,p)=>{const r=await db.query(q,p);return {...r,rowCount:r.rows.length||r.affectedRows||0}},release(){}})};
    const tx=fn=>withTreasuryTransaction(pool,fn), player=id(1), action={kind:'start',amount:500,difficulty:'Easy',free:false};
    const first=await tx(t=>chickenAction(t,player,id(2),action));
    assert.equal(first.balance,29500); assert.equal(first.phase,'playing');
    assert.deepEqual(await tx(t=>chickenAction(t,player,id(2),action)),first);
    const cash=await tx(t=>chickenAction(t,player,id(3),{kind:'cash'}));
    assert.equal(cash.balance,30000);assert.equal(cash.phase,'won');
    assert.deepEqual(await tx(t=>chickenAction(t,player,id(3),{kind:'cash'})),cash);
    assert.equal((await tx(t=>chickenSnapshot(t,player))).history.length,1);
    const wallets=await db.query('SELECT balance FROM demo_shared_wallets');assert.equal(BigInt(wallets.rows[0].balance),3000000n);
  } finally {await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('migration preserves both balances and both games debit the same wallet', async () => {
  const db=new PGlite();
  try {
    for(const migration of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','003_fictitious_chicken.sql']) await db.exec(fs.readFileSync(path.join(root,'db/migrations',migration),'utf8'));
    const player=id(10);
    await db.query("INSERT INTO demo_wallets(player_id,game,balance) VALUES ($1,'skyjet',100000),($1,'pilot-chicken',200000)",[player]);
    await db.exec(fs.readFileSync(path.join(root,'db/migrations/005_shared_wallet.sql'),'utf8'));
    const pool={connect:async()=>({query:async(q,p)=>{const r=await db.query(q,p);return {...r,rowCount:r.rows.length||r.affectedRows||0}},release(){}})};
    const tx=fn=>withTreasuryTransaction(pool,fn);
    assert.equal((await tx(t=>chickenSnapshot(t,player))).balance,3000);
    await tx(async t=>{await createDemoWallet(t,player,'skyjet',id(11));await openWager(t,{playerId:player,game:'skyjet',betId:id(12),operationId:id(13),stake:50000n,fundedStake:50000n,risk:0n});});
    assert.equal((await tx(t=>chickenSnapshot(t,player))).balance,2500);
    await tx(t=>finishWager(t,{playerId:player,betId:id(12),operationId:id(14),payout:50000n,cancel:true}));
    assert.equal((await tx(t=>chickenSnapshot(t,player))).balance,3000);
    await assert.rejects(db.query("UPDATE demo_wallets SET balance=0 WHERE player_id=$1",[player]));
  } finally { await db.close(); }
});

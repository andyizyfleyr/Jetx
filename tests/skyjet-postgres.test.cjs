/* eslint-disable @typescript-eslint/no-require-imports */
// Only use a disposable PostgreSQL test database.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {randomUUID,randomBytes}=require('node:crypto');const {Pool}=require('pg');const ts=require('typescript');const root=path.resolve(__dirname,'..');
test('auto cashout reserves its actual maximum and remains fully covered', {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sky-risk-'));
 for(const name of ['risk','transactions','wallet','skyjetRisk','skyjet']){
  const src=fs.readFileSync(path.join(root,'lib/treasury',name+'.ts'),'utf8').replace("import 'server-only';",'');
  let out=ts.transpile(src,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020});
  for(const dep of ['risk','transactions','wallet','skyjetRisk'])out=out.replace(`require("./${dep}")`,`require("./${dep}.cjs")`);
  fs.writeFileSync(path.join(dir,name+'.cjs'),out);
 }
 const {withTreasuryTransaction,reserveRisk}=require(path.join(dir,'transactions.cjs'));const {skyAction,skySnapshot}=require(path.join(dir,'skyjet.cjs'));
 const schema='skytest_'+randomBytes(8).toString('hex'),admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});let pool;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  for(const f of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','004_fictitious_skyjet.sql','005_shared_wallet.sql'])await pool.query(fs.readFileSync(path.join(root,'db/migrations',f),'utf8'));
  const tx=fn=>withTreasuryTransaction(pool,fn);
  for(let i=0;i<10;i++)await tx(t=>reserveRisk(t,{betId:randomUUID(),playerId:randomUUID(),game:'skyjet',proposedRisk:i===9?90000n:100000n,operationId:randomUUID()}));
  const now=Date.now(),round={id:42,start:now,flightStart:now+5000,crashAt:now+30000,end:now+33000,crash:4,mode:'normal'},player=randomUUID();
  const placed=await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:0,amount:20000,autoTarget:1.1},round,now));assert.equal(placed.balance,29800);assert.equal(placed.riskBudgetCents,8000);
  const reserved=await pool.query("SELECT risk FROM demo_risk_reservations WHERE player_id=$1 AND status='open'",[player]);assert.equal(BigInt(reserved.rows[0].risk),2000n);
  const settled=await tx(t=>skySnapshot(t,player,now+7000));assert.equal(settled.bets.length,0);assert.equal(settled.balance,30020);assert.equal(settled.riskBudgetCents,7800);
  // A free slot may reserve and cancel a next-round bet during the current flight.
  const next={id:43,start:now+33000,flightStart:now+38000,crashAt:now+60000,end:now+63000,crash:4,mode:'normal'};
  const future=await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:1,amount:20000,autoTarget:1.1},round,now+7000,next));
  assert.equal(future.bets[0].roundId,43);assert.equal(future.bets[0].status,'queued');assert.deepEqual(future.usedSlots,[0]);assert.equal(future.balance,29820);
  await assert.rejects(tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:0,amount:20000,autoTarget:1.1},round,now+7000,next)),/GAME_IN_PROGRESS/);
  const cancel=await tx(t=>skyAction(t,player,randomUUID(),{kind:'cancel',slot:1},round,now+8000,next));assert.equal(cancel.balance,30020);assert.equal(cancel.bets.length,0);
  const again=await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:1,amount:20000,autoTarget:1.1},round,now+8000,next));assert.equal(again.bets[0].roundId,43);
  const flying=await tx(t=>skySnapshot(t,player,now+39000,next));assert.equal(flying.bets[0].status,'active');
  const done=await tx(t=>skySnapshot(t,player,now+41000,next));assert.equal(done.bets.length,0);assert.equal(done.balance,30040);
 }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();fs.rmSync(dir,{recursive:true,force:true});}
});

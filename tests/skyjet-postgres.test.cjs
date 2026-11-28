/* eslint-disable @typescript-eslint/no-require-imports */
// Only use a disposable PostgreSQL test database.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {randomUUID,randomBytes}=require('node:crypto');const {Pool}=require('pg');const ts=require('typescript');const root=path.resolve(__dirname,'..');
test('SkyJet accepts and pays without house limits and preserves next round bets', {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sky-risk-'));
 for(const name of ['transactions','wallet','skyjet']){
  const src=fs.readFileSync(path.join(root,'lib/treasury',name+'.ts'),'utf8').replace("import 'server-only';",'');
  let out=ts.transpile(src,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020});
  for(const dep of ['risk','transactions','wallet','skyjetRisk'])out=out.replace(`require("./${dep}")`,`require("./${dep}.cjs")`);
  fs.writeFileSync(path.join(dir,name+'.cjs'),out);
 }
 const {withTreasuryTransaction}=require(path.join(dir,'transactions.cjs'));const {skyAction,skySnapshot}=require(path.join(dir,'skyjet.cjs'));
 const schema='skytest_'+randomBytes(8).toString('hex'),admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});let pool;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  for(const f of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','004_fictitious_skyjet.sql','005_shared_wallet.sql','007_remove_house_bank.sql'])await pool.query(fs.readFileSync(path.join(root,'db/migrations',f),'utf8'));
  const tx=fn=>withTreasuryTransaction(pool,fn);
  await pool.query('UPDATE demo_treasury SET equity=0 WHERE id=1');
  const now=Date.now(),round={id:42,start:now,flightStart:now+5000,crashAt:now+30000,end:now+33000,crash:4,mode:'normal'},player=randomUUID();
  const placed=await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:0,amount:20000,autoTarget:1.1},round,now));assert.equal(placed.balance,29800);
  const reserved=await pool.query('SELECT 1 FROM demo_risk_reservations WHERE player_id=$1',[player]);assert.equal(reserved.rows.length,0);
  const settled=await tx(t=>skySnapshot(t,player,now+7000));assert.equal(settled.bets.length,0);assert.equal(settled.balance,30020);
  // A free slot may reserve and cancel a next-round bet during the current flight.
  const next={id:43,start:now+33000,flightStart:now+38000,crashAt:now+60000,end:now+63000,crash:4,mode:'normal'};
  const future=await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:1,amount:20000,autoTarget:1.1},round,now+7000,next));
  assert.equal(future.bets[0].roundId,43);assert.equal(future.bets[0].status,'queued');assert.deepEqual(future.usedSlots,[0]);assert.equal(future.balance,29820);
  await assert.rejects(tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:0,amount:20000,autoTarget:1.1},round,now+7000,next)),/GAME_IN_PROGRESS/);
  const cancel=await tx(t=>skyAction(t,player,randomUUID(),{kind:'cancel',slot:1},round,now+8000,next));assert.equal(cancel.balance,30020);assert.equal(cancel.bets.length,0);
  const again=await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:1,amount:20000,autoTarget:1.1},round,now+8000,next));assert.equal(again.bets[0].roundId,43);
  const flying=await tx(t=>skySnapshot(t,player,now+39000,next));assert.equal(flying.bets[0].status,'active');
  const done=await tx(t=>skySnapshot(t,player,now+41000,next));assert.equal(done.bets.length,0);assert.equal(done.balance,30040);
  const high={...round,id:44,start:now+70000,flightStart:now+75000,crashAt:now+150000,end:now+153000,crash:90};
  await tx(t=>skyAction(t,player,randomUUID(),{kind:'place',slot:0,amount:1000000,autoTarget:10},high,high.start));
  const large=await tx(t=>skySnapshot(t,player,high.flightStart+40000,high));
  assert.equal(large.balance,120040);assert.equal(large.bets.length,0);
  // Wagers accepted before the change keep their promised automatic cap.
  const {openWager}=require(path.join(dir,'wallet.cjs'));const old=randomUUID();
  const legacy={...round,id:45,start:now+160000,flightStart:now+165000,crashAt:now+200000,end:now+203000,crash:9};
  await tx(async t=>{await openWager(t,{playerId:player,game:'skyjet',betId:old,operationId:randomUUID(),stake:20000n,fundedStake:20000n});await t.query("INSERT INTO demo_risk_reservations(bet_id,player_id,game,risk,status) VALUES($1,$2,'skyjet',10000,'open')",[old,player]);await t.query("INSERT INTO demo_skyjet_bets(bet_id,player_id,slot,round_id,flight_start,crash_at,crash,cap_payout,status) VALUES($1,$2,0,$3,$4,$5,9,30000,'open')",[old,player,legacy.id,legacy.flightStart,legacy.crashAt]);});
  const oldResult=await tx(t=>skySnapshot(t,player,legacy.flightStart+10000,legacy));assert.equal(oldResult.balance,120140);assert.equal(oldResult.bets.length,0);
  const oldRisk=await pool.query('SELECT status FROM demo_risk_reservations WHERE bet_id=$1',[old]);assert.equal(oldRisk.rows[0].status,'settled');
 }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();fs.rmSync(dir,{recursive:true,force:true});}
});

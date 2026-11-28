/* eslint-disable @typescript-eslint/no-require-imports */
// Disposable PostgreSQL database only. Concurrent games must not double-spend.
const { test }=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto'),{Pool}=require('pg'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),url=process.env.TEST_DATABASE_URL;
test('concurrent games share a wallet without house risk limits or double spending',{skip:!url},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wallet-pg-'));
 for(const name of ['transactions','wallet']){
  const src=fs.readFileSync(path.join(root,'lib/treasury',name+'.ts'),'utf8').replace("import 'server-only';",'');
  fs.writeFileSync(path.join(dir,name+'.cjs'),ts.transpile(src,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}).replace('require("./transactions")','require("./transactions.cjs")'));
 }
 const {withTreasuryTransaction:tx}=require(path.join(dir,'transactions.cjs')),{createDemoWallet,openWager,finishWager}=require(path.join(dir,'wallet.cjs'));
 const schema='wallet_'+randomBytes(8).toString('hex'),admin=new Pool({connectionString:url});let pool;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:8});
  for(const m of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','005_shared_wallet.sql','007_remove_house_bank.sql'])await pool.query(fs.readFileSync(path.join(root,'db/migrations',m),'utf8'));
  const player=randomUUID();await tx(pool,t=>createDemoWallet(t,player,'skyjet',randomUUID()));await tx(pool,t=>createDemoWallet(t,player,'pilot-chicken',randomUUID()));
  await pool.query('UPDATE demo_treasury SET equity=0 WHERE id=1');
  const bets=['skyjet','pilot-chicken'].map(game=>({game,betId:randomUUID(),operationId:randomUUID(),playerId:player,stake:2000000n,fundedStake:2000000n}));
  const outcomes=await Promise.allSettled(bets.map(args=>tx(pool,t=>openWager(t,args))));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'INSUFFICIENT_BALANCE');
  const bet=bets[outcomes.findIndex(r=>r.status==='fulfilled')];await tx(pool,t=>finishWager(t,{betId:bet.betId,playerId:player,operationId:randomUUID(),payout:10000000n}));
  const result=await pool.query('SELECT balance FROM demo_shared_wallets WHERE player_id=$1',[player]);assert.equal(BigInt(result.rows[0].balance),11000000n);
  assert.equal((await pool.query('SELECT equity FROM demo_treasury')).rows[0].equity,'0');
 }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();fs.rmSync(dir,{recursive:true,force:true});}
});

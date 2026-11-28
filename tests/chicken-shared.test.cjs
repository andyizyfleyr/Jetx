/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
test('shared rounds seal choices, prevent late entry, settle and reveal verifiable seed',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shared-chicken-'));const db=new PGlite();const clock=Date.now;let now=1800000000000;Date.now=()=>now;
 try{
  for(const [name,src] of [['transactions','lib/treasury/transactions.ts'],['wallet','lib/treasury/wallet.ts'],['chicken','lib/treasury/chicken.ts'],['chickenShared','lib/treasury/chickenShared.ts'],['format','lib/pilot-chicken/format.ts']]){
   let out=ts.transpile(fs.readFileSync(path.join(root,src),'utf8').replace("import 'server-only';",''),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020});
   for(const dep of ['transactions','wallet','chicken'])out=out.replace(`require("./${dep}")`,`require("./${dep}.cjs")`);out=out.replace('require("../pilot-chicken/format")','require("./format.cjs")');fs.writeFileSync(path.join(dir,name+'.cjs'),out);
  }
  for(const m of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','003_fictitious_chicken.sql','004_fictitious_skyjet.sql','005_shared_wallet.sql','006_accounts.sql','007_remove_house_bank.sql','008_chicken_shared_rounds.sql'])await db.exec(fs.readFileSync(path.join(root,'db/migrations',m),'utf8'));
  const {withTreasuryTransaction}=require(path.join(dir,'transactions.cjs')),{sharedSnapshot,sharedAction}=require(path.join(dir,'chickenShared.cjs'));
  const pool={connect:async()=>({query:async(q,p)=>{const r=await db.query(q,p);return {...r,rowCount:r.rows.length||r.affectedRows||0}},release(){}})},tx=fn=>withTreasuryTransaction(pool,fn);
  const players=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
  for(let i=0;i<3;i++)await db.query('INSERT INTO demo_accounts(player_id,username,password_salt,password_hash) VALUES($1,$2,$3,$4)',[players[i],'player'+i,'salt','hash']);
  let s=await tx(t=>sharedSnapshot(t,players[0])),id=s.round.id;
  let seed,digest;do{seed=crypto.randomBytes(32).toString('hex');const sample=n=>parseInt(crypto.createHmac('sha256',Buffer.from(seed,'hex')).update(`chicken-v1:${id}:${n}`).digest('hex').slice(0,13),16)/2**52;digest=[sample(1),sample(2)];}while(digest[0]<.36||digest[1]>=.365);
  const hash=crypto.createHash('sha256').update(Buffer.from(seed,'hex')).digest('hex');await db.query('UPDATE demo_chicken_rounds SET seed=$1,commitment=$2 WHERE id=$3',[seed,hash,id]);
  const start=p=>({kind:'start',amount:p===players[0]?100:10000,free:false,roundId:id});const a=crypto.randomUUID();
  s=await tx(t=>sharedAction(t,players[0],a,start(players[0])));assert.equal(s.balance,29900);assert.equal(s.round.commitment,hash);assert.equal(s.round.phase,'betting');assert.equal(s.seed,undefined);
  const retry=await tx(t=>sharedAction(t,players[0],a,start(players[0])));assert.equal(retry.balance,29900);
  await tx(t=>sharedAction(t,players[1],crypto.randomUUID(),start(players[1])));
  now+=12000;s=await tx(t=>sharedSnapshot(t,players[0]));assert.equal(s.round.step,1);assert.equal(s.round.phase,'decision');
  await assert.rejects(tx(t=>sharedAction(t,players[2],crypto.randomUUID(),start(players[2]))),/BETTING_CLOSED/);
  const move={kind:'next',roundId:id,step:1};await tx(t=>sharedAction(t,players[0],crypto.randomUUID(),move));
  s=await tx(t=>sharedSnapshot(t,players[1]));assert.equal(s.players.find(x=>x.stake===100).status,'playing');assert.equal(JSON.stringify(s.players).includes('chosen'),false);assert.equal(s.round.chosen,false);assert.equal(s.previous,null);
  await tx(t=>sharedAction(t,players[1],crypto.randomUUID(),move));
  await assert.rejects(tx(t=>sharedAction(t,players[0],crypto.randomUUID(),{kind:'cash',roundId:id,step:1})),/CHOICE_LOCKED/);
  now+=10000;s=await tx(t=>sharedSnapshot(t,players[0]));assert.equal(s.step,1);assert.equal(s.round.step,2);assert.equal(s.multiplier,1.09);
  await assert.rejects(tx(t=>sharedAction(t,players[1],crypto.randomUUID(),{kind:'next',roundId:id,step:1})),/STEP_CHANGED/);
  // One goes forward into the shared collision; the other times out and is paid at the previous step.
  await tx(t=>sharedAction(t,players[0],crypto.randomUUID(),{kind:'next',roundId:id,step:2}));now+=10000;
  const after=await tx(t=>sharedSnapshot(t,players[0]));const other=await tx(t=>sharedSnapshot(t,players[1]));
  assert.equal(after.phase,'lost');assert.equal(after.balance,29900);assert.equal(other.phase,'won');assert.equal(other.balance,30900);assert.equal(after.previous.seed,seed);assert.equal(after.previous.commitment,hash);assert.notEqual(after.round.id,id);
  assert.equal((await tx(t=>sharedSnapshot(t,players[2]))).round.id,after.round.id);
  const second=after.round.id;await tx(t=>sharedAction(t,players[2],crypto.randomUUID(),{kind:'start',roundId:second,amount:500,free:false}));
  now+=12000;await tx(t=>sharedSnapshot(t,players[2]));now+=10000;
  const timeout=await tx(t=>sharedSnapshot(t,players[2]));assert.equal(timeout.balance,30000);assert.equal(timeout.phase,'won');assert.equal(timeout.previous.id,second);assert.equal(timeout.previous.outcome,'cashout');
  assert.equal(crypto.createHash('sha256').update(Buffer.from(timeout.previous.seed,'hex')).digest('hex'),timeout.previous.commitment);
 }finally{Date.now=clock;await db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

/* eslint-disable @typescript-eslint/no-require-imports */
// TEST_APP_URL and TEST_DATABASE_URL must point to an isolated disposable environment.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{Pool}=require('pg');
const base=process.env.TEST_APP_URL,url=process.env.TEST_DATABASE_URL;
test('concurrent players share a round and cannot change a revealed choice',{skip:!base||!url},async()=>{
 async function req(path,body,cookie){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json',origin:base}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const cookies=await Promise.all([0,1,2].map(async()=>{const r=await req('/api/account',{action:'register',username:'m'+randomUUID().replaceAll('-','').slice(0,16),password:'unmotdepassefort'});assert.equal(r.status,200);return r.cookie;}));
 let snap=await req('/api/pilot-chicken',null,cookies[0]);
 for(let i=0;i<40&&!(snap.data.round?.phase==='betting'&&snap.data.round.deadline-snap.data.round.serverTime>4000);i++){await new Promise(resolve=>setTimeout(resolve,1000));snap=await req('/api/pilot-chicken',null,cookies[0]);}
 const roundId=snap.data.round.id;assert.equal(snap.data.round.phase,'betting');
 const secret=await req('/api/pilot-chicken?proof='+roundId,null,cookies[0]);assert.equal(secret.status,409);assert.equal(secret.data.seed,undefined);
 const results=await Promise.all(cookies.slice(0,2).map((c,i)=>req('/api/pilot-chicken',{kind:'start',id:randomUUID(),amount:i?10000:100,free:false,roundId},c)));
 assert.deepEqual(results.map(r=>r.status),[200,200]);assert.ok(results.every(r=>r.data.round.id===roundId));
 const pool=new Pool({connectionString:url});
 try{
  await pool.query('UPDATE demo_chicken_rounds SET deadline=$2 WHERE id=$1',[roundId,Date.now()-1]);
  snap=await req('/api/pilot-chicken',null,cookies[0]);assert.equal(snap.data.round.step,1);
  const late=await req('/api/pilot-chicken',{kind:'start',id:randomUUID(),amount:100,free:false,roundId},cookies[2]);assert.equal(late.status,409);
  const choices=await Promise.all(cookies.slice(0,2).map(c=>req('/api/pilot-chicken',{kind:'next',id:randomUUID(),roundId,step:1},c)));assert.deepEqual(choices.map(r=>r.status),[200,200]);
  const changed=await req('/api/pilot-chicken',{kind:'cash',id:randomUUID(),roundId,step:1},cookies[0]);assert.equal(changed.status,409);
  const restored=await req('/api/pilot-chicken',null,cookies[0]);assert.equal(restored.data.round.chosen,true);assert.equal(restored.data.round.id,roundId);
  await pool.query('UPDATE demo_chicken_rounds SET deadline=$2 WHERE id=$1',[roundId,Date.now()-1]);
  const after=await Promise.all(cookies.slice(0,2).map(c=>req('/api/pilot-chicken',null,c)));assert.equal(after[0].data.phase,after[1].data.phase);assert.equal(after[0].data.step,after[1].data.step);
  if(after[0].data.round.id===roundId){await pool.query('UPDATE demo_chicken_rounds SET deadline=$2 WHERE id=$1',[roundId,Date.now()-1]);await req('/api/pilot-chicken',null,cookies[0]);}
  const proof=await req('/api/pilot-chicken?proof='+roundId,null,cookies[0]);assert.equal(proof.status,200);assert.equal(proof.data.id,roundId);assert.equal(require('node:crypto').createHash('sha256').update(Buffer.from(proof.data.seed,'hex')).digest('hex'),proof.data.commitment);
 }finally{await pool.end();}
});

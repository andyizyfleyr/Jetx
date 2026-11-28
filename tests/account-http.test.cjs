/* eslint-disable @typescript-eslint/no-require-imports */
// TEST_APP_URL must point to an isolated disposable server and database.
const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID,randomBytes,createHash}=require('node:crypto');const {Pool}=require('pg');
test('account preserves guest balance across devices', {skip: !process.env.TEST_APP_URL || !process.env.TEST_DATABASE_URL}, async()=>{const base=process.env.TEST_APP_URL,user='u'+randomUUID().replaceAll('-','').slice(0,15),password='motdepasse_test123';let cookie='';
async function req(path,body,ck=cookie){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json','origin':base}:{}),...(ck?{cookie:ck}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=r.headers.get('set-cookie');return {status:r.status,data:await r.json(),cookie:set?.split(';')[0]};}
let a=await req('/api/pilot-chicken');assert.equal(a.status,401);
a=await req('/api/skyjet',{kind:'place',id:randomUUID(),slot:0,amount:20000,autoTarget:null});assert.equal(a.status,401);
const token=randomBytes(32).toString('hex'),player=randomUUID();const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});
try {await pool.query('INSERT INTO demo_sessions(token_hash,player_id) VALUES($1,$2)',[createHash('sha256').update(token).digest('hex'),player]);await pool.query('INSERT INTO demo_shared_wallets(player_id,balance) VALUES($1,3000000)',[player]);} finally {await pool.end();}
cookie='chicken_session='+token;
a=await req('/api/pilot-chicken');assert.equal(a.status,401);
a=await req('/api/pilot-chicken',{kind:'start',id:randomUUID(),amount:500,difficulty:'Easy',free:false});assert.equal(a.status,401);
a=await req('/api/account',{action:'register',username:user,password});assert.equal(a.status,200);cookie=a.cookie;
a=await req('/api/pilot-chicken');assert.equal(a.data.balance,30000);
// A fresh account can only join the shared round while betting is open.
for(let i=0;i<40 && a.data.round.phase!=='betting';i++){await new Promise(resolve=>setTimeout(resolve,1000));a=await req('/api/pilot-chicken');}
assert.equal(a.data.round.phase,'betting');const roundId=a.data.round.id;
a=await req('/api/pilot-chicken',{kind:'start',id:randomUUID(),amount:500,roundId,free:false});assert.equal(a.data.balance,29500);
a=await req('/api/skyjet');assert.equal(a.data.balance,29500);
let b=await req('/api/account',{action:'login',username:user,password},'');assert.equal(b.status,200);let other=b.cookie;
a=await req('/api/pilot-chicken',undefined,other);assert.equal(a.data.balance,29500);assert.equal(a.data.phase,'playing');
const adjust=new Pool({connectionString:process.env.TEST_DATABASE_URL});try{await adjust.query('UPDATE demo_chicken_rounds SET deadline=$2 WHERE id=$1',[roundId,Date.now()-1]);}finally{await adjust.end();}
a=await req('/api/pilot-chicken',undefined,other);assert.equal(a.data.round.phase,'decision');
a=await req('/api/pilot-chicken',{kind:'cash',id:randomUUID(),roundId,step:a.data.round.step},other);assert.equal(a.data.balance,30000);
a=await req('/api/skyjet',undefined,cookie);assert.equal(a.data.balance,30000);
a=await req('/api/account',{action:'login',username:user,password:'incorrectpassword'},'');assert.equal(a.status,401);
const csrf=await fetch(base+'/api/account',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:JSON.stringify({action:'logout'})});assert.equal(csrf.status,403);
a=await req('/api/account',{action:'logout'},other);assert.equal(a.status,200);a=await req('/api/account',undefined,other);assert.equal(a.data.username,null);a=await req('/api/skyjet',undefined,other);assert.equal(a.status,401);
});

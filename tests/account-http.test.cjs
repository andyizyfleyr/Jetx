/* eslint-disable @typescript-eslint/no-require-imports */
// TEST_APP_URL must point to an isolated disposable server and database.
const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
test('account preserves guest balance across devices', {skip: !process.env.TEST_APP_URL}, async()=>{const base=process.env.TEST_APP_URL,user='u'+randomUUID().replaceAll('-','').slice(0,15),password='motdepasse_test123';let cookie='';
async function req(path,body,ck=cookie){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json','origin':base}:{}),...(ck?{cookie:ck}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=r.headers.get('set-cookie');return {status:r.status,data:await r.json(),cookie:set?.split(';')[0]};}
let a=await req('/api/pilot-chicken');cookie=a.cookie;assert.equal(a.data.balance,30000);
a=await req('/api/pilot-chicken',{kind:'start',id:randomUUID(),amount:500,difficulty:'Easy',free:false});assert.equal(a.data.balance,29500);
a=await req('/api/account',{action:'register',username:user,password});assert.equal(a.status,200);cookie=a.cookie;
a=await req('/api/skyjet');assert.equal(a.data.balance,29500);
let b=await req('/api/account',{action:'login',username:user,password},'');assert.equal(b.status,200);let other=b.cookie;
a=await req('/api/pilot-chicken',undefined,other);assert.equal(a.data.balance,29500);assert.equal(a.data.phase,'playing');
a=await req('/api/pilot-chicken',{kind:'cash',id:randomUUID()},other);assert.equal(a.data.balance,30000);
a=await req('/api/skyjet',undefined,cookie);assert.equal(a.data.balance,30000);
a=await req('/api/account',{action:'login',username:user,password:'incorrectpassword'},'');assert.equal(a.status,401);
const csrf=await fetch(base+'/api/account',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:JSON.stringify({action:'logout'})});assert.equal(csrf.status,403);
a=await req('/api/account',{action:'logout'},other);assert.equal(a.status,200);a=await req('/api/account',undefined,other);assert.equal(a.data.username,null);
});

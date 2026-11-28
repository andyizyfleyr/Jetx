import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { Pool } from 'pg';
import { ensureDemoSchema } from '@/lib/treasury/schema';
import { withTreasuryTransaction, TreasuryError } from '@/lib/treasury/transactions';
import { skyAction, skySnapshot } from '@/lib/treasury/skyjet';
import { readSchedule, readScheduleLocked } from '@/lib/modeStore';
const name='chicken_session';let pool:Pool|undefined;
function db(){if(!process.env.DATABASE_URL)throw new TreasuryError('UNAVAILABLE');return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});}
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
function validOrigin(request:NextRequest){try{return new URL(request.headers.get('origin')||request.headers.get('referer')||'').host===(request.headers.get('x-forwarded-host')||request.headers.get('host'));}catch{return false;}}
function fail(e:unknown){if(e instanceof TreasuryError && e.code==='AUTH_REQUIRED')return NextResponse.json({error:'AUTH_REQUIRED'},{status:401,headers:{'Cache-Control':'no-store'}});if(e instanceof TreasuryError && /^(INVALID_|NO_ACTIVE|GAME_IN|INSUFFICIENT)/.test(e.code))return NextResponse.json({error:e.code},{status:409});console.error('SkyJet server unavailable',e instanceof Error?e.message:'unknown');return NextResponse.json({error:'UNAVAILABLE'},{status:503});}
export async function GET(request:NextRequest){try{
 const token=request.cookies.get(name)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))throw new TreasuryError('AUTH_REQUIRED');
 await readSchedule();const database=db();await ensureDemoSchema(database);const result=await withTreasuryTransaction(database,async tx=>{
  const {rows}=await tx.query<{player_id:string}>('SELECT s.player_id FROM demo_sessions s JOIN demo_accounts a ON a.player_id=s.player_id WHERE s.token_hash=$1',[hash(token)]);
  if(!rows[0])throw new TreasuryError('AUTH_REQUIRED');const {now,rounds}=await readScheduleLocked(tx),round=rounds.find(r=>r.start<=now&&now<r.end);if(!round)throw new TreasuryError('INVALID_ROUND');return skySnapshot(tx,rows[0].player_id,now,round);
 });
 return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
export async function POST(request:NextRequest){if(!validOrigin(request))return NextResponse.json({error:'ORIGIN'},{status:403});try{
 const token=request.cookies.get(name)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))throw new TreasuryError('AUTH_REQUIRED');
 const body=await request.json();if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))throw new TreasuryError('INVALID_ACTION');
 type Action={kind:'place';slot:number;amount:number;autoTarget:number|null}|{kind:'cancel'|'cash';slot:number};
 const parse=(input:Record<string,unknown>):Action=>{if(!Number.isInteger(input.slot))throw new TreasuryError('INVALID_ACTION');const slot=input.slot as number;if(input.kind==='place'&&Number.isSafeInteger(input.amount)&&(input.autoTarget===null||typeof input.autoTarget==='number'))return {kind:'place',slot,amount:input.amount as number,autoTarget:input.autoTarget as number|null};if(input.kind==='cash'||input.kind==='cancel')return {kind:input.kind,slot};throw new TreasuryError('INVALID_ACTION');};
 const actions:Action[]=body.kind==='batch'&&Array.isArray(body.actions)&&body.actions.length>0&&body.actions.length<=2?body.actions.map(parse):[parse(body)];
 await readSchedule();const database=db();await ensureDemoSchema(database);const result=await withTreasuryTransaction(database,async tx=>{
  const {rows}=await tx.query<{player_id:string}>('SELECT s.player_id FROM demo_sessions s JOIN demo_accounts a ON a.player_id=s.player_id WHERE s.token_hash=$1',[hash(token)]);if(!rows[0])throw new TreasuryError('AUTH_REQUIRED');const player=rows[0].player_id;
  const {now,rounds}=await readScheduleLocked(tx),round=rounds.find(r=>r.start<=now&&now<r.end);if(!round)throw new TreasuryError('INVALID_ROUND');
  const next=rounds.find(r=>r.id===round.id+1);
  if(body.kind!=='batch')return skyAction(tx,player,body.id,actions[0],round,now,next);
  const prior=await tx.query<{response:unknown;matches:boolean}>('SELECT response,request=$3::jsonb AS matches FROM demo_skyjet_actions WHERE player_id=$1 AND action_id=$2',[player,body.id,JSON.stringify(actions)]);
  if(prior.rows[0]){if(!prior.rows[0].matches)throw new TreasuryError('IDEMPOTENCY_CONFLICT');return prior.rows[0].response;}
  let result:unknown;for(let i=0;i<actions.length;i++){const h=createHash('sha256').update(`${body.id}:${i}`).digest('hex');const child=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;result=await skyAction(tx,player,child,actions[i],round,now,next);}
  await tx.query('INSERT INTO demo_skyjet_actions(player_id,action_id,request,response) VALUES($1,$2,$3::jsonb,$4::jsonb)',[player,body.id,JSON.stringify(actions),JSON.stringify(result)]);return result;
 });
 return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}

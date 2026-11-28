import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { Pool } from 'pg';
import { ensureDemoSchema } from '@/lib/treasury/schema';
import { withTreasuryTransaction, TreasuryError } from '@/lib/treasury/transactions';
import { chickenAction, chickenSnapshot } from '@/lib/treasury/chicken';
import { difficulties, type Difficulty } from '@/lib/pilot-chicken/format';

const name='chicken_session';
let pool:Pool | undefined;
function db(){if(!process.env.DATABASE_URL) throw new TreasuryError('UNAVAILABLE');return pool ??= new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});}
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
function validOrigin(request:NextRequest){try{const source=request.headers.get('origin')||request.headers.get('referer')||'';return new URL(source).host===(request.headers.get('x-forwarded-host')||request.headers.get('host'));}catch{return false;}}
function fail(e:unknown){if(e instanceof TreasuryError && e.code==='AUTH_REQUIRED')return NextResponse.json({error:'AUTH_REQUIRED'},{status:401,headers:{'Cache-Control':'no-store'}});if(e instanceof TreasuryError && /^(RISK_|INVALID_|NO_ACTIVE|GAME_IN|FREE_USED|INSUFFICIENT)/.test(e.code)) return NextResponse.json({error:e.code},{status:409});console.error('Pilot Chicken server unavailable', e instanceof Error ? e.message : 'unknown');return NextResponse.json({error:'UNAVAILABLE'},{status:503});}
export async function GET(request:NextRequest){try{
 const token=request.cookies.get(name)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))throw new TreasuryError('AUTH_REQUIRED');
 const database=db();await ensureDemoSchema(database);const result=await withTreasuryTransaction(database,async tx=>{
  const {rows}=await tx.query<{player_id:string}>('SELECT s.player_id FROM demo_sessions s JOIN demo_accounts a ON a.player_id=s.player_id WHERE s.token_hash=$1',[hash(token)]);
  if(!rows[0])throw new TreasuryError('AUTH_REQUIRED');return chickenSnapshot(tx,rows[0].player_id);
 });
 return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
export async function POST(request:NextRequest){
 if(!validOrigin(request))return NextResponse.json({error:'ORIGIN'},{status:403});
 try{
  const token=request.cookies.get(name)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))throw new TreasuryError('AUTH_REQUIRED');
  const body=await request.json();const id=body?.id;
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new TreasuryError('INVALID_ACTION');
  let action:{kind:'start';amount:number;difficulty:Difficulty;free:boolean}|{kind:'next'|'cash'};
  if(body.kind==='start'&&Number.isSafeInteger(body.amount)&&difficulties.includes(body.difficulty)&&typeof body.free==='boolean') action={kind:'start',amount:body.amount,difficulty:body.difficulty,free:body.free};
  else if(body.kind==='next'||body.kind==='cash')action={kind:body.kind};else throw new TreasuryError('INVALID_ACTION');
  const database=db();await ensureDemoSchema(database);const result=await withTreasuryTransaction(database,async tx=>{const {rows}=await tx.query<{player_id:string}>('SELECT s.player_id FROM demo_sessions s JOIN demo_accounts a ON a.player_id=s.player_id WHERE s.token_hash=$1',[hash(token)]);if(!rows[0])throw new TreasuryError('AUTH_REQUIRED');return chickenAction(tx,rows[0].player_id,id,action);});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}
}

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { Pool } from 'pg';
import { withTreasuryTransaction, TreasuryError } from '@/lib/treasury/transactions';
import { chickenAction, chickenSnapshot } from '@/lib/treasury/chicken';
import { difficulties, type Difficulty } from '@/lib/pilot-chicken/format';

const name='chicken_session';
let pool:Pool | undefined;
function db(){if(process.env.DEMO_CENTRAL_ENABLED !== '1' || !process.env.DATABASE_URL) throw new TreasuryError('UNAVAILABLE');return pool ??= new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});}
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
function validOrigin(request:NextRequest){try{const source=request.headers.get('origin')||request.headers.get('referer')||'';return new URL(source).host===(request.headers.get('x-forwarded-host')||request.headers.get('host'));}catch{return false;}}
function fail(e:unknown){if(e instanceof TreasuryError && /^(RISK_|INVALID_|NO_ACTIVE|GAME_IN|FREE_USED|INSUFFICIENT)/.test(e.code)) return NextResponse.json({error:e.code},{status:409});console.error('Pilot Chicken server unavailable', e instanceof Error ? e.message : 'unknown');return NextResponse.json({error:'UNAVAILABLE'},{status:503});}
export async function GET(request:NextRequest){
 try{
  const incoming=request.cookies.get(name)?.value;
  const token=incoming&&/^[a-f0-9]{64}$/.test(incoming)?incoming:randomBytes(32).toString('hex');
  const result=await withTreasuryTransaction(db(),async tx=>{
   const h=hash(token); const rows=await tx.query<{player_id:string}>('SELECT player_id FROM demo_sessions WHERE token_hash=$1',[h]);
   let player=rows.rows[0]?.player_id;
   if(!player){player=randomUUID();await tx.query('INSERT INTO demo_sessions(token_hash,player_id) VALUES($1,$2)',[h,player]);}
   return chickenSnapshot(tx,player);
  });
  const response=NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(name,token,{httpOnly:true,secure:request.nextUrl.protocol==='https:' || request.headers.get('x-forwarded-proto')==='https',sameSite:'lax',path:'/',maxAge:60*60*24*365});return response;
 }catch(e){return fail(e);}
}
export async function POST(request:NextRequest){
 if(!validOrigin(request))return NextResponse.json({error:'ORIGIN'},{status:403});
 try{
  const token=request.cookies.get(name)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))throw new TreasuryError('INVALID_SESSION');
  const body=await request.json();const id=body?.id;
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new TreasuryError('INVALID_ACTION');
  let action:{kind:'start';amount:number;difficulty:Difficulty;free:boolean}|{kind:'next'|'cash'};
  if(body.kind==='start'&&Number.isSafeInteger(body.amount)&&difficulties.includes(body.difficulty)&&typeof body.free==='boolean') action={kind:'start',amount:body.amount,difficulty:body.difficulty,free:body.free};
  else if(body.kind==='next'||body.kind==='cash')action={kind:body.kind};else throw new TreasuryError('INVALID_ACTION');
  const result=await withTreasuryTransaction(db(),async tx=>{const {rows}=await tx.query<{player_id:string}>('SELECT player_id FROM demo_sessions WHERE token_hash=$1',[hash(token)]);if(!rows[0])throw new TreasuryError('INVALID_SESSION');return chickenAction(tx,rows[0].player_id,id,action);});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}
}

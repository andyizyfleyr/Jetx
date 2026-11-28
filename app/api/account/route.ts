import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { NextResponse, type NextRequest } from 'next/server';
import { Pool } from 'pg';
import { ensureDemoSchema } from '@/lib/treasury/schema';
import { withTreasuryTransaction } from '@/lib/treasury/transactions';

const scrypt = promisify(scryptCallback);
const cookieName = 'chicken_session';
let pool: Pool | undefined;
const db = () => {
 if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
 return pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
};
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const validToken = (value?:string) => value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
const originOK = (req:NextRequest) => { try { return new URL(req.headers.get('origin') || req.headers.get('referer') || '').host === (req.headers.get('x-forwarded-host') || req.headers.get('host')); } catch { return false; } };
// Login throttling is serialized per identifier, not under the global treasury lock.
async function withLoginTransaction<T>(database:Pool, fn:(tx:import('pg').PoolClient)=>Promise<T>):Promise<T>{
 const tx=await database.connect();try{await tx.query('BEGIN');await tx.query("SET LOCAL lock_timeout = '5s'");const result=await fn(tx);await tx.query('COMMIT');return result;}catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
}
const error = (message:string,status:number) => NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
const setCookie = (res:NextResponse,req:NextRequest,token:string) => res.cookies.set(cookieName,token,{httpOnly:true,secure:req.nextUrl.protocol==='https:' || req.headers.get('x-forwarded-proto')==='https',sameSite:'lax',path:'/',maxAge:31536000});
export async function GET(req:NextRequest){
 try {
  const database=db(); await ensureDemoSchema(database);
  const token=validToken(req.cookies.get(cookieName)?.value);
  if(!token) return NextResponse.json({username:null},{headers:{'Cache-Control':'no-store'}});
  const {rows}=await database.query<{username:string}>('SELECT a.username FROM demo_sessions s JOIN demo_accounts a ON a.player_id=s.player_id WHERE s.token_hash=$1',[digest(token)]);
  return NextResponse.json({username:rows[0]?.username ?? null},{headers:{'Cache-Control':'no-store'}});
 } catch {return error('Service indisponible.',503);}
}
export async function POST(req:NextRequest){
 if(!originOK(req))return error('Requête refusée.',403);
 try {
  if(Number(req.headers.get('content-length') || 0)>4096) return error('Requête trop longue.',400);
  const body=await req.json();
  if(!body || !['register','login','logout'].includes(body.action)) return error('Requête invalide.',400);
  const database=db(); await ensureDemoSchema(database);
  const current=validToken(req.cookies.get(cookieName)?.value);
  if(body.action==='logout'){
   if(current) await database.query('DELETE FROM demo_sessions WHERE token_hash=$1',[digest(current)]);
   const res=NextResponse.json({ok:true});res.cookies.set(cookieName,'',{httpOnly:true,secure:req.nextUrl.protocol==='https:'||req.headers.get('x-forwarded-proto')==='https',sameSite:'lax',path:'/',maxAge:0});return res;
  }
  if(typeof body.username!=='string'||typeof body.password!=='string')return error('Identifiants invalides.',400);
  const username=body.username.trim().toLowerCase();const password=body.password;
  if(!/^[a-z0-9_]{3,24}$/.test(username) || password.length<10 || Buffer.byteLength(password)>128) return error('Identifiant : 3 à 24 lettres non accentuées, chiffres ou underscores. Mot de passe : 10 à 128 caractères.',400);
  const token=randomBytes(32).toString('hex');
  if(body.action==='register'){
   const salt=randomBytes(16).toString('hex'); const hash=(await scrypt(password,salt,64) as Buffer).toString('hex');
   const result=await withTreasuryTransaction(database,async tx=>{
    const prior=current?await tx.query<{player_id:string;account:string|null}>('SELECT s.player_id,a.username AS account FROM demo_sessions s LEFT JOIN demo_accounts a ON a.player_id=s.player_id WHERE s.token_hash=$1',[digest(current)]):null;
    if(prior?.rows[0]?.account)return 'already';
    const player=prior?.rows[0]?.player_id ?? randomUUID();
    const added=await tx.query('INSERT INTO demo_accounts(player_id,username,password_salt,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING player_id',[player,username,salt,hash]);
    if(!added.rowCount)return 'taken';
    if(current)await tx.query('DELETE FROM demo_sessions WHERE token_hash=$1',[digest(current)]);
    await tx.query('INSERT INTO demo_sessions(token_hash,player_id) VALUES($1,$2)',[digest(token),player]);return 'ok';
   });
   if(result!=='ok')return error(result==='already'?'Vous êtes déjà connecté.':'Cet identifiant est déjà utilisé.',409);
  } else {
   const result=await withLoginTransaction(database,async tx=>{
    const key='user:'+username;
    await tx.query('INSERT INTO demo_login_limits(key) VALUES($1) ON CONFLICT DO NOTHING',[key]);
    const limit=await tx.query<{locked:boolean}>('SELECT locked_until > now() AS locked FROM demo_login_limits WHERE key=$1 FOR UPDATE',[key]);
    if(limit.rows[0].locked)return 'locked';
    const found=await tx.query<{player_id:string;password_salt:string;password_hash:string}>('SELECT player_id,password_salt,password_hash FROM demo_accounts WHERE username=$1',[username]);
    const account=found.rows[0];const salt=account?.password_salt ?? '00000000000000000000000000000000';
    const actual=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(account?.password_hash ?? '00'.repeat(64),'hex');
    if(!account||expected.length!==actual.length||!timingSafeEqual(actual,expected)){
     await tx.query("UPDATE demo_login_limits SET failures=CASE WHEN updated_at < now()-interval '15 minutes' THEN 1 ELSE failures+1 END, locked_until=CASE WHEN updated_at >= now()-interval '15 minutes' AND failures+1 >= 5 THEN now()+interval '15 minutes' ELSE NULL END, updated_at=now() WHERE key=$1",[key]);return 'invalid';
    }
    await tx.query('DELETE FROM demo_login_limits WHERE key=$1',[key]);
    if(current)await tx.query('DELETE FROM demo_sessions WHERE token_hash=$1',[digest(current)]);
    await tx.query('INSERT INTO demo_sessions(token_hash,player_id) VALUES($1,$2)',[digest(token),account.player_id]);return 'ok';
   });
   if(result!=='ok')return error(result==='locked'?'Trop de tentatives. Réessayez dans 15 minutes.':'Identifiant ou mot de passe incorrect.',result==='locked'?429:401);
  }
  const res=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});setCookie(res,req,token);return res;
 } catch(e) {console.error('Account service unavailable',e instanceof Error?e.message:'unknown');return error('Service indisponible.',503);}
}

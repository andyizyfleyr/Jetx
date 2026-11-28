'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './style.css';

export default function AccountPage(){
 const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [account,setAccount]=useState<string|null>(null);
 const [mode,setMode]=useState<'login'|'register'>('register');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/account',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();setAccount(data.username);}).catch(()=>{if(!controller.signal.aborted)setMessage('Service indisponible. Réessayez plus tard.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[]);
 async function send(action:'register'|'login'|'logout'){
  setBusy(true);setMessage('');try{
   const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,username,password})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Service indisponible.');
   // Full navigation clears client game state after changing the session cookie.
   window.location.href = window.location.origin + '/';
  }catch(e){setMessage(e instanceof Error?e.message:'Service indisponible.');setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();void send(mode);}
 return <main className="account-page"><div className="account-card"><Link className="account-back" href="/">← Retour aux jeux</Link><div className="account-mark">✦ SKYJET</div><h1>Mon compte</h1><p>Un compte est nécessaire pour jouer à SkyJet et Pilot Chicken.</p>{loading?<p>Connexion…</p>:account?<><p>Connecté en tant que <strong>{account}</strong>. Ton solde est disponible sur tes autres appareils lorsque tu te connectes avec ce compte.</p><button className="account-primary" disabled={busy} onClick={()=>void send('logout')}>Se déconnecter</button></>:<><div className="account-tabs"><button type="button" aria-pressed={mode==='register'} onClick={()=>{setMode('register');setMessage('');}}>Créer un compte</button><button type="button" aria-pressed={mode==='login'} onClick={()=>{setMode('login');setMessage('');}}>Se connecter</button></div><p>{mode==='register'?'Crée ton compte pour conserver ton solde actuel et le retrouver sur un autre appareil.':'La connexion remplace la session invitée actuelle par celle du compte, sans fusion des soldes. Termine tes parties invitées avant de continuer.'}</p><form onSubmit={submit}><label>Identifiant<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" placeholder="3 à 24 caractères"/></label><label>Mot de passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='register'?'new-password':'current-password'} required minLength={10} maxLength={128} placeholder="10 caractères minimum"/></label><button className="account-primary" disabled={busy}>{busy?'Veuillez patienter…':mode==='register'?'Créer mon compte':'Se connecter'}</button></form><p className="account-note">Conserve bien ton mot de passe : la récupération n’est pas encore disponible.</p></>}{message&&<p className="account-error" role="alert">{message}</p>}</div></main>;
}

'use client';
import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { useGame } from '@/store/game';
export const colorClass = (value:number) => value >= 10 ? 'gold' : value >= 2 ? 'green' : 'neutral';
export default function MultiplierHistory(){ const history=useGame(s=>s.history); const [open,setOpen]=useState(false); return <div className="history-wrap"><div className="history-scroll">{history.map((r,i)=><span className={`history-pill ${colorClass(r.value)}`} key={i}>{r.value.toFixed(2)}x</span>)}</div><button className="round-button history-toggle" aria-label="Afficher l’historique" onClick={()=>setOpen(!open)}>{open?<X size={19}/>:<ChevronDown size={19}/>}</button>{open&&<div className="history-expanded"><div className="history-title">Historique des manches <button onClick={()=>setOpen(false)} aria-label="Fermer"><X size={16}/></button></div><div className="history-grid">{history.map((r,i)=><span className={`history-pill ${colorClass(r.value)}`} key={i}>{r.value.toFixed(2)}x</span>)}</div></div>}</div>; }

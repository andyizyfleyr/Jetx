'use client';
import { useState } from 'react';
import { History, ChevronDown, X } from 'lucide-react';
import type { Result } from '@/hooks/pilot-chicken/useGame';
import { formatMultiplier } from '@/lib/pilot-chicken/format';
export default function HistoryBar({results}:{results:Result[]}){const [open,setOpen]=useState(false);return <div className="pc-history-wrap"><div className="pc-history-short">{results.length?results.slice(0,5).map(r=><span key={r.id} className={r.multiplier>=10?'pink':r.multiplier>=2?'purple':'blue'}>{formatMultiplier(r.multiplier)}</span>):<span className="empty">Aucun résultat</span>}</div><button className="pc-history-toggle" onClick={()=>setOpen(!open)} aria-label="Historique des résultats" aria-expanded={open}><History size={15}/><ChevronDown size={14}/></button>{open&&<div className="pc-history-pop"><div><strong>Derniers résultats</strong><button onClick={()=>setOpen(false)} aria-label="Fermer"><X size={15}/></button></div><section>{results.length?results.map(r=><span key={r.id} className={r.multiplier>=10?'pink':r.multiplier>=2?'purple':'blue'}>{formatMultiplier(r.multiplier)}</span>):<p>Aucune manche jouée.</p>}</section></div>}</div>}

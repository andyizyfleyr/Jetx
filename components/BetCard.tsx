'use client';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useGame, type Bet } from '@/store/game';
import { playSound } from '@/lib/audio';
const money=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function BetCard({bet,index}:{bet:Bet;index:number}) { const [amount,setAmount]=useState('100'); const {multiplier,place,cancel,cash,sound,balance}=useGame(); const value=Number(amount); return <motion.div layout={false} initial={false} animate={{opacity:1}} className={`bet-card ${bet.status}`}>
 {bet.status==='empty'?<><div className="amount-control"><button aria-label={`Diminuer la mise ${index+1}`} onClick={()=>setAmount(String(Math.max(1,(Number(amount)||1)-10)))}><Minus size={14}/></button><label><span className="sr-only">Montant de la mise {index+1}</span><span>$</span><input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)} /></label><button aria-label={`Augmenter la mise ${index+1}`} onClick={()=>setAmount(String((Number(amount)||0)+10))}><Plus size={14}/></button></div><div className="quick-bets">{[10,50,100,500].map(n=><button key={n} onClick={()=>setAmount(String(n))}>{n}</button>)}</div><button className="bet-button bet-green" disabled={!Number.isFinite(value)||value<1||value>balance} onClick={()=>place(index,value)}>Miser <span>↗</span></button></>:<><div className="bet-caption">{bet.status==='active'?'Vous gagnez':'En attente de la prochaine manche'}</div><div className="bet-value">$ {money(bet.status==='active'?Math.floor(bet.amount*multiplier*100)/100:bet.amount)}</div><button className={`bet-button ${bet.status==='active'?'bet-green':'bet-red'}`} onClick={()=>{if(bet.status==='active'){if(cash(index))playSound('cash',sound);}else cancel(index);}}>{bet.status==='active'?'Encaisser':'Annuler'}</button></>}
 </motion.div>; }

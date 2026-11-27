'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useGame } from '@/store/game';
export default function MultiplierDisplay(){const {phase,multiplier,countdown,players,bets}=useGame(); const reduced=useReducedMotion(); const count=players.length+bets.filter(b=>b.status==='active'||(phase==='WAITING'&&b.status==='queued')).length;
 return <div className="center-display">{phase==='WAITING'?<><div className="waiting-label">PROCHAIN DÉCOLLAGE</div><div className="countdown">{countdown}<span>s</span></div><div className="loading-track"><span style={{width:`${(5-countdown)*20}%`}}/></div><div className="waiting-sub">Préparez vos mises</div></>:<>{phase==='CRASHED'&&<motion.div initial={reduced?false:{opacity:0,scale:.8}} animate={{opacity:1,scale:1}} transition={{type:'spring',duration:.45}} className="crash-label">Envolé !</motion.div>}<div className={`multiplier ${phase==='CRASHED'?'crashed':''} ${multiplier >= 100 ? 'multiplier-wide' : ''}`}>{multiplier.toFixed(2)}<span>x</span></div></>}<div className="bet-count">{count} Mises</div></div>;
}

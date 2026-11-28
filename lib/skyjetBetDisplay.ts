/** Presentation only: the server remains authoritative for settlement and cash-out. */
export function displayBetStatus(bet:{status:'empty'|'queued'|'active';roundId?:number},phase:'WAITING'|'FLYING'|'CRASHED',roundId:number):'empty'|'queued'|'active'|'settling' {
 if(bet.status==='empty')return 'empty';
 if(bet.roundId!==undefined && bet.roundId>roundId && bet.status==='queued')return 'queued';
 if(bet.roundId!==roundId || phase==='CRASHED')return 'settling';
 if(phase==='WAITING')return bet.status==='queued'?'queued':'settling';
 return 'active';
}

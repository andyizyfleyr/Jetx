import { skyjetProfitLimit } from './treasury/skyjetRisk';
import { isValidBetAmount } from './betLimits';
/** Estimates are advisory; the server repeats the check under the treasury lock. */
export function requiredRiskCents(amount:number, maxProfit:number, autoCash:boolean, autoTarget:number):number|null {
 if(!isValidBetAmount(amount)||!Number.isFinite(maxProfit)||maxProfit<=0 || (autoCash&&(!Number.isFinite(autoTarget)||autoTarget<1.01||autoTarget>10000)))return null;
 const stake=Math.round(amount*100),cap=Math.round(maxProfit*100);
 if(!Number.isSafeInteger(stake)||!Number.isSafeInteger(cap))return null;
 return Number(skyjetProfitLimit(BigInt(stake),BigInt(cap),autoCash?autoTarget:null));
}
export function canCoverBets(amounts:number[],balance:number,budgetCents:number,maxProfit:number,autoCash:boolean,autoTarget:number):boolean {
 if(!amounts.length||!Number.isSafeInteger(budgetCents)||budgetCents<0)return false;
 let risk=0,stake=0;
 for(const amount of amounts){const required=requiredRiskCents(amount,maxProfit,autoCash,autoTarget);if(required===null)return false;risk+=required;stake+=Math.round(amount*100);}
 return risk<=budgetCents && stake<=Math.round(balance*100);
}

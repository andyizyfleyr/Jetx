/** Auto cashout bounds the payable profit just as the hard house cap does.
 * Round upward to cover floating-point rounding of a target payout in cents. */
export function skyjetProfitLimit(stake:bigint, houseCap:bigint, autoTarget:number|null):bigint {
 if(autoTarget===null)return houseCap;
 const targetProfit=BigInt(Math.max(0,Math.ceil(Number(stake)*autoTarget)-Number(stake)));
 return targetProfit < houseCap ? targetProfit : houseCap;
}

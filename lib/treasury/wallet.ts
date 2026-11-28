import 'server-only';
import type { PoolClient } from 'pg';
import { reserveRisk, closeRisk, TreasuryError } from './transactions';

type GameName = 'skyjet' | 'pilot-chicken';
type Wager = { player_id: string; game: GameName; stake: string; funded_stake: string; status: string; payout: string | null };

// All functions require the transaction and locked treasury row from
// withTreasuryTransaction. They are internal: server game engines must validate
// player identity, stake limits, free-bet entitlement and every outcome.
export async function createDemoWallet(tx: PoolClient, playerId: string, game: GameName, operationId: string) {
  const initial = game === 'skyjet' ? BigInt(2132985) : BigInt(3000000);
  const result = await tx.query(`INSERT INTO demo_wallets (player_id, game, balance) VALUES ($1,$2,$3)
    ON CONFLICT (player_id, game) DO NOTHING RETURNING balance`, [playerId, game, initial.toString()]);
  if (result.rows.length) await tx.query("INSERT INTO demo_wallet_events (operation_id,player_id,game,kind,amount,balance_after) VALUES ($1,$2,$3,'initial',$4,$4)", [operationId, playerId, game, initial.toString()]);
  return result.rows.length > 0;
}

export async function openWager(tx: PoolClient, args: { playerId: string; game: GameName; betId: string; operationId: string; stake: bigint; fundedStake: bigint; risk: bigint }) {
  if (args.stake <= BigInt(0) || args.fundedStake < BigInt(0) || args.fundedStake > args.stake) throw new TreasuryError('INVALID_STAKE');
  const prior = await tx.query<Wager>('SELECT player_id, game, stake, funded_stake, status, payout FROM demo_wagers WHERE bet_id = $1', [args.betId]);
  if (prior.rows[0]) {
    const b = prior.rows[0];
    if (b.player_id !== args.playerId || b.game !== args.game || BigInt(b.stake) !== args.stake || BigInt(b.funded_stake) !== args.fundedStake) throw new TreasuryError('IDEMPOTENCY_CONFLICT');
    const ev = await tx.query('SELECT 1 FROM demo_wallet_events WHERE operation_id = $1 AND bet_id = $2 AND kind = $3', [args.operationId, args.betId, 'stake']);
    if (!ev.rows.length) throw new TreasuryError('BET_ALREADY_EXISTS');
    return { applied: false };
  }
  const balance = await tx.query<{ balance: string }>('UPDATE demo_wallets SET balance = balance - $3::bigint WHERE player_id=$1 AND game=$2 AND balance >= $3::bigint RETURNING balance', [args.playerId, args.game, args.fundedStake.toString()]);
  if (!balance.rows[0]) throw new TreasuryError('INSUFFICIENT_BALANCE');
  await reserveRisk(tx, { ...args, proposedRisk: args.risk });
  await tx.query("INSERT INTO demo_wagers(bet_id,player_id,game,stake,funded_stake,status) VALUES ($1,$2,$3,$4,$5,'open')", [args.betId,args.playerId,args.game,args.stake.toString(),args.fundedStake.toString()]);
  await tx.query("INSERT INTO demo_wallet_events(operation_id,player_id,game,bet_id,kind,amount,balance_after) VALUES ($1,$2,$3,$4,'stake',$5,$6)", [args.operationId,args.playerId,args.game,args.betId,(-args.fundedStake).toString(),balance.rows[0].balance]);
  return { applied: true };
}

export async function finishWager(tx: PoolClient, args: { playerId: string; betId: string; operationId: string; payout: bigint; cancel?: boolean }) {
  if (args.payout < BigInt(0)) throw new TreasuryError('INVALID_PAYOUT');
  const result = await tx.query<Wager>('SELECT player_id,game,stake,funded_stake,status,payout FROM demo_wagers WHERE bet_id=$1 FOR UPDATE', [args.betId]);
  const bet = result.rows[0];
  if (!bet || bet.player_id !== args.playerId) throw new TreasuryError('INVALID_BET');
  const prior = await tx.query<{ amount: string; kind: string; bet_id: string }>('SELECT amount,kind,bet_id FROM demo_wallet_events WHERE operation_id=$1', [args.operationId]);
  if (prior.rows[0]) {
    const e = prior.rows[0];
    if (e.bet_id !== args.betId || e.kind !== (args.cancel ? 'refund' : 'payout') || BigInt(e.amount) !== args.payout) throw new TreasuryError('IDEMPOTENCY_CONFLICT');
    return { applied: false };
  }
  const funded = BigInt(bet.funded_stake);
  if (bet.status !== 'open' || (args.cancel && args.payout !== funded)) throw new TreasuryError('INVALID_SETTLEMENT');
  await closeRisk(tx, { betId: args.betId, playerId: args.playerId, operationId: args.operationId, cancel: args.cancel, houseLoss: args.cancel ? BigInt(0) : args.payout - funded });
  const balance = await tx.query<{ balance: string }>('UPDATE demo_wallets SET balance=balance+$3::bigint WHERE player_id=$1 AND game=$2 RETURNING balance', [args.playerId,bet.game,args.payout.toString()]);
  await tx.query('UPDATE demo_wagers SET status=$2, payout=$3 WHERE bet_id=$1', [args.betId,args.cancel ? 'cancelled':'settled',args.payout.toString()]);
  await tx.query('INSERT INTO demo_wallet_events(operation_id,player_id,game,bet_id,kind,amount,balance_after) VALUES ($1,$2,$3,$4,$5,$6,$7)', [args.operationId,args.playerId,bet.game,args.betId,args.cancel?'refund':'payout',args.payout.toString(),balance.rows[0].balance]);
  return { applied: true };
}

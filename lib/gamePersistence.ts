import { BET_COUNT, useGame, type Bet } from '@/store/game';

const KEY = 'skyjet-local-game-v1';

// Only local player state belongs here. The server remains authoritative for
// round timing and results; on reconnect the engine reconciles pending bets.
export function restoreAndPersistGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        const data = saved as Record<string, unknown>;
        const patch: Partial<ReturnType<typeof useGame.getState>> = {};
        if (typeof data.balance === 'number' && Number.isFinite(data.balance) && data.balance >= 0) patch.balance = data.balance;
        for (const key of ['sound', 'animations', 'autoCash', 'autoPlay'] as const) {
          if (typeof data[key] === 'boolean') patch[key] = data[key];
        }
        if (typeof data.autoTarget === 'number' && Number.isFinite(data.autoTarget) && data.autoTarget >= 1.01) patch.autoTarget = data.autoTarget;
        if (Array.isArray(data.draftAmounts) && data.draftAmounts.length === BET_COUNT && data.draftAmounts.every((v: unknown) => typeof v === 'string' && v.length <= 10 && /^[0-9.,]*$/.test(v))) patch.draftAmounts = data.draftAmounts;
        if (Array.isArray(data.bets) && data.bets.length === BET_COUNT && data.bets.every(validBet)) patch.bets = data.bets;
        useGame.setState(patch);
      }
    }
  } catch { /* Unavailable or invalid storage must not prevent play. */ }

  let last = '';
  const save = () => {
    const { balance, bets, draftAmounts, sound, animations, autoCash, autoTarget, autoPlay } = useGame.getState();
    const next = JSON.stringify({ balance, bets, draftAmounts, sound, animations, autoCash, autoTarget, autoPlay });
    if (next === last) return;
    try { localStorage.setItem(KEY, next); last = next; } catch { /* Storage can be disabled or full. */ }
  };
  save();
  return useGame.subscribe(save);
}

function validBet(value: unknown): value is Bet {
  if (!value || typeof value !== 'object') return false;
  const bet = value as Record<string, unknown>;
  return typeof bet.amount === 'number' && Number.isFinite(bet.amount) && bet.amount >= 0 &&
    typeof bet.lastAmount === 'number' && Number.isFinite(bet.lastAmount) && bet.lastAmount >= 0 &&
    (bet.status === 'empty' || ((bet.status === 'queued' || bet.status === 'active') && Number.isSafeInteger(bet.roundId))) ;
}

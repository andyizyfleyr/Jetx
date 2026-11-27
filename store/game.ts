import { create } from 'zustand';

export type Phase = 'WAITING' | 'FLYING' | 'CRASHED';
export type Bet = { amount: number; status: 'empty' | 'queued' | 'active'; lastAmount: number; result?: { type: 'won' | 'lost'; amount: number } };
export type Round = { value: number; time: string };
export type Player = { name: string; stake: number; target: number; cashed: boolean };
type Game = {
  feedback: { id: number; text: string; kind: 'info' | 'success' | 'error' } | null; invalidBets: number[];
  notify: (text: string, kind?: 'info' | 'success' | 'error') => void; clearFeedback: (id: number) => void;
  phase: Phase; multiplier: number; countdown: number; balance: number; bets: Bet[];
  history: Round[]; players: Player[]; online: number; autoCash: boolean; autoTarget: number; autoPlay: boolean; sound: boolean; animations: boolean;
  set: (patch: Partial<Game>) => void; place: (index: number, amount: number) => void; placeAll: (amounts: number[]) => 'ok' | 'invalid' | 'insufficient' | 'none'; cancel: (index: number) => void;
  cash: (index: number) => number; cancelAll: () => void; cashAll: () => number; startFlight: () => void; crash: () => void; startWaiting: () => void;
};
const names = ['a..7', 'd..4', 'm..9', 'j..2', 's..8', 'k..1', 'b..5', 'r..3', 't..6', 'n..0'];
const makePlayers = (): Player[] => Array.from({ length: 50 + Math.floor(Math.random() * 101) }, (_, i) => ({ name: names[i % names.length], stake: [10, 25, 50, 100, 200, 500][Math.floor(Math.random() * 6)], target: 1.05 + Math.random() * 5, cashed: false }));
const initialHistory = [1.00, 2.19, 1.08, 1.20, 35.06, 55.38, 3.94, 1.72, 8.23].map(value => ({ value, time: '--:--' }));
let feedbackId = 0;
export const useGame = create<Game>((set, get) => ({
  feedback: null, invalidBets: [],
  notify: (text, kind = 'info') => set({ feedback: { id: ++feedbackId, text, kind } }),
  clearFeedback: id => set(s => s.feedback?.id === id ? { feedback: null } : s),
  phase: 'WAITING', multiplier: 1, countdown: 5, balance: 21329.85,
  bets: Array.from({ length: 4 }, () => ({ amount: 100, status: 'empty', lastAmount: 0 })),
  history: initialHistory, players: [], online: 2060, autoCash: false, autoTarget: 2, autoPlay: false, sound: true, animations: true,
  set: patch => set(patch),
  place: (index, amount) => set(s => {
    amount = Math.round(amount * 100) / 100;
    if (!Number.isFinite(amount) || amount < 1 || amount > s.balance || s.bets[index].status !== 'empty') return s;
    const bets = s.bets.map((b, i) => i === index ? { amount, lastAmount: amount, status: 'queued' as const, result: undefined } : b);
    return { bets, balance: Math.round((s.balance - amount) * 100) / 100 };
  }),
  // Place every currently empty card in one transaction, or none at all.
  placeAll: amounts => {
    const s = get();
    const free = s.bets.map((bet, i) => bet.status === 'empty' ? i : -1).filter(i => i !== -1);
    if (!free.length) return 'none';
    const values = free.map(i => Math.round(amounts[i] * 100) / 100);
    if (values.some(value => !Number.isFinite(value) || value < 1)) return 'invalid';
    const totalCents = values.reduce((total, value) => total + Math.round(value * 100), 0);
    if (totalCents > Math.round(s.balance * 100)) return 'insufficient';
    set({ balance: (Math.round(s.balance * 100) - totalCents) / 100,
      bets: s.bets.map((bet, i) => bet.status === 'empty' ? { ...bet, amount: Math.round(amounts[i] * 100) / 100, lastAmount: Math.round(amounts[i] * 100) / 100, status: 'queued', result: undefined } : bet),
    });
    return 'ok';
  },
  cancel: index => set(s => {
    const bet = s.bets[index]; if (bet.status !== 'queued') return s;
    return { balance: Math.round((s.balance + bet.amount) * 100) / 100, bets: s.bets.map((b, i) => i === index ? { ...b, status: 'empty' as const } : b) };
  }),
  cash: index => {
    const s = get(); const bet = s.bets[index];
    if (s.phase !== 'FLYING' || bet.status !== 'active') return 0;
    const gain = Math.floor(bet.amount * s.multiplier * 100) / 100;
    set({ balance: Math.round((s.balance + gain) * 100) / 100, bets: s.bets.map((b, i) => i === index ? { ...b, status: 'empty', result: { type: 'won', amount: gain } } : b) }); return gain;
  },
  cancelAll: () => get().bets.forEach((b, i) => { if (b.status === 'queued') get().cancel(i); }),
  cashAll: () => get().bets.reduce((sum, b, i) => sum + (b.status === 'active' ? get().cash(i) : 0), 0),
  startFlight: () => set(s => ({ phase: 'FLYING', multiplier: 1, bets: s.bets.map(b => b.status === 'queued' ? { ...b, status: 'active' } : b) })),
  crash: () => set(s => ({ phase: 'CRASHED', history: [{ value: s.multiplier, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }, ...s.history].slice(0, 40), bets: s.bets.map(b => b.status === 'active' ? { ...b, status: 'empty', result: { type: 'lost', amount: b.amount } } : b) })),
  startWaiting: () => set(s => {
    let balance = s.balance;
    const bets = s.bets.map(b => {
      if (s.autoPlay && b.status === 'empty' && b.lastAmount > 0 && b.lastAmount <= balance) { balance = Math.round((balance - b.lastAmount) * 100) / 100; return { ...b, amount: b.lastAmount, status: 'queued' as const, result: undefined }; }
      return b;
    });
    return { phase: 'WAITING', countdown: 5, multiplier: 1, bets, balance, players: makePlayers(), online: 2050 + Math.floor(Math.random() * 110) };
  }),
}));

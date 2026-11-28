import { create } from 'zustand';
import { MIN_BET, QUICK_BETS } from '@/lib/betLimits';

export const BET_COUNT = 2;
export type Phase = 'WAITING' | 'FLYING' | 'CRASHED';
export type Bet = { amount: number; status: 'empty' | 'queued' | 'active'; lastAmount: number; capPayout?: number; roundId?: number; result?: { type: 'won' | 'lost'; amount: number; roundId?: number } };
export type Round = { value: number; time: string };
export type Player = { name: string; stake: number; target: number; cashed: boolean };
type Game = {
  feedback: { id: number; text: string; kind: 'info' | 'success' | 'error' } | null; invalidBets: number[];
  notify: (text: string, kind?: 'info' | 'success' | 'error') => void; clearFeedback: (id: number) => void;
  actionPending: boolean; pendingSlots: number[]; syncReady: boolean; roundId: number; syncNow: () => boolean; ping: number | null;
  phase: Phase; multiplier: number; countdown: number; balance: number; maxProfit: number; riskBudgetCents: number; usedRoundId: number | null; usedSlots: number[]; bets: Bet[]; draftAmounts: string[];
  history: Round[]; players: Player[]; online: number; autoCash: boolean; autoTarget: number; autoPlay: boolean; sound: boolean; animations: boolean;
  set: (patch: Partial<Game>) => void;
};
const names = ['a..7', 'd..4', 'm..9', 'j..2', 's..8', 'k..1', 'b..5', 'r..3', 't..6', 'n..0'];
export const makePlayers = (): Player[] => Array.from({ length: 50 + Math.floor(Math.random() * 101) }, (_, i) => ({ name: names[i % names.length], stake: QUICK_BETS[Math.floor(Math.random() * QUICK_BETS.length)], target: 1.05 + Math.random() * 5, cashed: false }));
const initialHistory = [1.00, 2.19, 1.08, 1.20, 35.06, 55.38, 3.94, 1.72, 8.23].map(value => ({ value, time: '--:--' }));
let feedbackId = 0;
export const useGame = create<Game>((set) => ({
  feedback: null, invalidBets: [],
  notify: (text, kind = 'info') => set({ feedback: { id: ++feedbackId, text, kind } }),
  clearFeedback: id => set(s => s.feedback?.id === id ? { feedback: null } : s),
  actionPending: false, pendingSlots: [], syncReady: false, roundId: -1, syncNow: () => false, ping: null,
  phase: 'WAITING', multiplier: 1, countdown: 5, balance: 0, maxProfit: 0, riskBudgetCents: 0, usedRoundId:null, usedSlots:[],
  bets: Array.from({ length: BET_COUNT }, () => ({ amount: MIN_BET, status: 'empty', lastAmount: 0 })),
  draftAmounts: Array.from({ length: BET_COUNT }, () => String(MIN_BET)),
  history: initialHistory, players: [], online: 2060, autoCash: false, autoTarget: 2, autoPlay: false, sound: true, animations: true,
  set: patch => set(patch),
}));

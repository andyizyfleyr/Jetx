'use client';
import { useRemoteGame } from './useRemoteGame';
export type Result = { id: string; multiplier: number; bet: number; payout: number; won: boolean; free: boolean };
/** Game outcomes and balances are exclusively server-side. */
export function useGame(){ return useRemoteGame(true); }

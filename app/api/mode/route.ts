import { changeMode } from '@/lib/modeStore';
import { GAME_MODES, type GameMode } from '@/lib/sharedRounds';

export async function POST(request: Request) {
  // Public controls are intentional, but a foreign website cannot trigger them silently.
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try { if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: 'Origine refusée.' }, { status: 403 }); }
  catch { return Response.json({ error: 'Origine refusée.' }, { status: 403 }); }
  let mode: unknown;
  try { ({ mode } = await request.json()); } catch { return Response.json({ error: 'Requête invalide.' }, { status: 400 }); }
  if (typeof mode !== 'string' || !(GAME_MODES as readonly string[]).includes(mode)) return Response.json({ error: 'Mode invalide.' }, { status: 400 });
  try { return Response.json(await changeMode(mode as GameMode), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Stockage indisponible ou non configuré.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}

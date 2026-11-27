import { readSchedule } from '@/lib/modeStore';

export async function GET() {
  try {
    const data = await readSchedule();
    return Response.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0', 'CDN-Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Synchronisation indisponible' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

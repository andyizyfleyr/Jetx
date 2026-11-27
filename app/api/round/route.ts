import { getSharedSchedule } from '@/lib/sharedRounds';

// No persistence or credentials: UTC is the shared authority for this demo.
export async function GET() {
  const serverTime = Date.now();
  return Response.json({ serverTime, rounds: getSharedSchedule(serverTime) }, {
    headers: { 'Cache-Control': 'no-store, max-age=0', 'CDN-Cache-Control': 'no-store' },
  });
}

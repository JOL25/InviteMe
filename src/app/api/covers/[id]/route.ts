import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { hasDatabase } from '@/lib/env';
import { query } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasDatabase() || !z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const user = await currentUser();
  const { rows } = await query<{ bytes: Buffer; content_type: string }>(
    `select c.bytes,c.content_type from covers c join events e on e.id=c.event_id
     where e.id=$1 and c.path=e.cover_path and (e.published_at is not null or e.owner_id=$2)`,
    [id, user?.id ?? null],
  );
  if (!rows[0]) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(rows[0].bytes), {
    headers: {
      'Content-Type': rows[0].content_type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

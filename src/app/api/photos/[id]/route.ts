import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { hasDatabase } from '@/lib/env';
import { ownerQuery } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasDatabase() || !z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const user = await currentUser();
  const { rows } = await ownerQuery<{ bytes: Buffer; content_type: string }>(
    user?.id ?? null,
    'select * from public.read_gallery_photo($1)',
    [id],
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

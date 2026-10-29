import { z } from 'zod';
import { hasDatabase } from '@/lib/env';
import { currentUser } from '@/lib/auth';
import { findOwnedEvent } from '@/lib/event-store';
import { query } from '@/lib/db';
import type { RSVP } from '@/types/database';
import { csvHeader, rsvpCsvRow } from '@/lib/csv';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasDatabase())
    return Response.json({ error: 'Servicio no disponible.' }, { status: 503 });
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: 'Evento no disponible.' }, { status: 404 });
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Inicia sesión.' }, { status: 401 });
  let event;
  let cutoff: string | undefined;
  try {
    event = await findOwnedEvent(id, user.id);
    if (!event)
      return Response.json({ error: 'Evento no disponible.' }, { status: 404 });
    cutoff = (
      await query<{ created_at: string }>(
        `select r.created_at from rsvps r join events e on e.id=r.event_id where r.event_id=$1 and e.owner_id=$2 order by r.created_at desc limit 1`,
        [id, user.id],
      )
    ).rows[0]?.created_at;
  } catch {
    return Response.json(
      { error: 'No pudimos preparar la exportación.' },
      { status: 503 },
    );
  }
  const encoder = new TextEncoder();
  let page = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (page === 0) {
          controller.enqueue(encoder.encode(csvHeader));
          if (!cutoff) {
            controller.close();
            return;
          }
        }
        const { rows: data } = await query<RSVP>(
          `select r.* from rsvps r join events e on e.id=r.event_id where r.event_id=$1 and e.owner_id=$2 and r.created_at <= $3
           order by r.created_at,r.id limit 1000 offset $4`,
          [id, user.id, cutoff, page * 1000],
        );
        controller.enqueue(
          encoder.encode((data ?? []).map(rsvpCsvRow).join('')),
        );
        page += 1;
        if (!data || data.length < 1000) controller.close();
      } catch {
        controller.error(new Error('Exportación interrumpida.'));
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}-respuestas.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
